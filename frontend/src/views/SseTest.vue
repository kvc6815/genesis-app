<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/composables/useAuth'
import { useProjects } from '@/composables/useProjects'

const { user } = useAuth()
const { projects } = useProjects()

const message = ref('')
const projectId = ref('')
const log = ref<string[]>([])
const streaming = ref(false)
const endpoint = ref<'generateStream' | 'sseEcho'>('generateStream')
let source: EventSource | null = null

function stopStream() {
  source?.close()
  source = null
  streaming.value = false
}

async function startStream() {
  stopStream()
  log.value = []
  streaming.value = true

  const url = new URL(endpoint.value, `${import.meta.env.VITE_FUNCTIONS_BASE_URL}/`)
  if (message.value.trim()) url.searchParams.set('message', message.value.trim())

  if (endpoint.value === 'generateStream') {
    if (!projectId.value || !user.value) {
      log.value.push('{"type":"error","message":"pick a project first"}')
      streaming.value = false
      return
    }
    url.searchParams.set('projectId', projectId.value)
    url.searchParams.set('idToken', await user.value.getIdToken())
  }

  source = new EventSource(url.toString())
  source.onmessage = (event) => {
    log.value.push(event.data)
    try {
      const parsed = JSON.parse(event.data)
      if (parsed.type === 'complete' || parsed.type === 'error') stopStream()
    } catch {
      // ignore malformed lines, they still show up in the raw log
    }
  }
  source.onerror = () => {
    log.value.push('{"type":"error","message":"connection error"}')
    stopStream()
  }
}

onUnmounted(stopStream)
</script>

<template>
  <main class="min-h-screen bg-background p-6">
    <div class="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 class="font-semibold">SSE test harness</h1>
      <p class="text-sm text-muted-foreground">
        Dev-only page. "Claude" hits the real generation endpoint, persisting files + a
        snapshot to the selected project (Phase 3c). "Echo" is the original fake/no-LLM
        stream from Phase 2b, kept for pure transport debugging.
      </p>
      <div class="flex gap-2 text-sm">
        <Button
          :variant="endpoint === 'generateStream' ? 'default' : 'outline'"
          size="sm"
          @click="endpoint = 'generateStream'"
        >
          Claude
        </Button>
        <Button :variant="endpoint === 'sseEcho' ? 'default' : 'outline'" size="sm" @click="endpoint = 'sseEcho'">
          Echo
        </Button>
      </div>
      <select
        v-if="endpoint === 'generateStream'"
        v-model="projectId"
        class="h-9 rounded-md border bg-background px-3 text-sm"
      >
        <option value="" disabled>Select a project…</option>
        <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <div class="flex gap-2">
        <Input v-model="message" placeholder="Prompt / message" @keydown.enter="startStream" />
        <Button :disabled="streaming" @click="startStream">
          {{ streaming ? 'Streaming…' : 'Test Stream' }}
        </Button>
      </div>
      <Card class="h-80 overflow-y-auto p-4 font-mono text-xs whitespace-pre-wrap">
        <p v-if="log.length === 0" class="text-muted-foreground">No events yet.</p>
        <div v-for="(line, i) in log" :key="i">{{ line }}</div>
      </Card>
    </div>
  </main>
</template>
