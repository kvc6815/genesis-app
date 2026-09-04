import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from './useAuth'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface SseEvent {
  type: 'token' | 'file_start' | 'file_end' | 'complete' | 'error'
  data?: string
  path?: string
  message?: string
}

export function useGeneration(projectId: Ref<string | undefined>) {
  const { user } = useAuth()

  // Persisted turns (projects/{id}/messages), synced live. The in-progress
  // assistant reply is kept out of this until it finishes, so it isn't
  // written to Firestore on every token — see `pendingAssistant`.
  const persistedMessages = ref<ChatMessage[]>([])
  const pendingAssistant = ref<ChatMessage | null>(null)
  const messages = computed<ChatMessage[]>(() =>
    pendingAssistant.value ? [...persistedMessages.value, pendingAssistant.value] : persistedMessages.value,
  )

  const liveFiles = ref<Record<string, string>>({})
  const streamingFiles = ref<Set<string>>(new Set())
  const streaming = ref(false)
  const error = ref<string | null>(null)
  let source: EventSource | null = null
  let unsubscribeMessages: (() => void) | null = null

  watch(
    projectId,
    (id) => {
      unsubscribeMessages?.()
      unsubscribeMessages = null
      persistedMessages.value = []

      if (!id) return
      const q = query(collection(db, `projects/${id}/messages`), orderBy('createdAt'))
      unsubscribeMessages = onSnapshot(q, (snapshot) => {
        persistedMessages.value = snapshot.docs.map((d) => d.data() as ChatMessage)
      })
    },
    { immediate: true },
  )

  function stop() {
    source?.close()
    source = null
    streaming.value = false
  }

  async function persistAssistantReply() {
    if (!pendingAssistant.value || !projectId.value) return
    const content = pendingAssistant.value.content
    pendingAssistant.value = null
    if (!content.trim()) return
    await addDoc(collection(db, `projects/${projectId.value}/messages`), {
      role: 'assistant',
      content,
      createdAt: serverTimestamp(),
    })
  }

  async function send(prompt: string) {
    if (!user.value || !projectId.value || streaming.value) return

    stop()
    error.value = null

    await addDoc(collection(db, `projects/${projectId.value}/messages`), {
      role: 'user',
      content: prompt,
      createdAt: serverTimestamp(),
    })
    pendingAssistant.value = { role: 'assistant', content: '' }
    liveFiles.value = {}
    streamingFiles.value = new Set()
    streaming.value = true

    const url = new URL('generateStream', `${import.meta.env.VITE_FUNCTIONS_BASE_URL}/`)
    url.searchParams.set('projectId', projectId.value)
    url.searchParams.set('message', prompt)
    url.searchParams.set('idToken', await user.value.getIdToken())

    source = new EventSource(url.toString())

    source.onmessage = (event) => {
      let data: SseEvent
      try {
        data = JSON.parse(event.data)
      } catch {
        return
      }

      if (data.type === 'token') {
        if (data.path) {
          liveFiles.value = { ...liveFiles.value, [data.path]: (liveFiles.value[data.path] ?? '') + data.data }
        } else if (pendingAssistant.value) {
          pendingAssistant.value.content += data.data ?? ''
        }
      } else if (data.type === 'file_start' && data.path) {
        streamingFiles.value = new Set(streamingFiles.value).add(data.path)
        if (!(data.path in liveFiles.value)) liveFiles.value = { ...liveFiles.value, [data.path]: '' }
      } else if (data.type === 'file_end' && data.path) {
        const next = new Set(streamingFiles.value)
        next.delete(data.path)
        streamingFiles.value = next
      } else if (data.type === 'complete') {
        streaming.value = false
        source?.close()
        source = null
        void persistAssistantReply()
      } else if (data.type === 'error') {
        error.value = data.message ?? 'Generation failed'
        streaming.value = false
        source?.close()
        source = null
        void persistAssistantReply()
      }
    }

    source.onerror = () => {
      // EventSource auto-retries by default, which would resend the same
      // prompt and could duplicate/confuse a generation already in progress
      // server-side. Close explicitly instead and surface a clear error.
      if (streaming.value) {
        error.value = 'Connection lost during generation. Please try again.'
        streaming.value = false
        void persistAssistantReply()
      }
      source?.close()
      source = null
    }
  }

  onUnmounted(() => {
    stop()
    unsubscribeMessages?.()
  })

  return { messages, liveFiles, streamingFiles, streaming, error, send, stop }
}
