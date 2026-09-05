<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useProjectFiles } from '@/composables/useProjectFiles'
import { useGeneration } from '@/composables/useGeneration'
import { useAuth } from '@/composables/useAuth'
import SnapshotHistorySheet from '@/components/SnapshotHistorySheet.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import VueMonacoEditor from '@guolao/vue-monaco-editor'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)

const { user } = useAuth()
const { files } = useProjectFiles(projectId)
const { messages, liveFiles, streamingFiles, streaming, error, send } = useGeneration(projectId)

// Fresh enough for a dev-scoped preview session; doesn't auto-refresh on
// expiry (~1h) — see docs/KNOWN_GAPS.md.
const previewToken = ref('')
watch(
  user,
  async (u) => {
    previewToken.value = u ? await u.getIdToken() : ''
  },
  { immediate: true },
)

const previewIndexFile = computed(() => files.value.find((f) => f.path === 'index.html'))

// Forces a genuinely fresh fetch whenever the served content changes — a
// `src` string alone won't reload if the URL is unchanged, unlike the
// srcdoc string this replaced. Belt-and-suspenders: this cache-busting
// query param plus the `:key` remount below plus `Cache-Control: no-store`
// on the response. The query string only affects the top-level navigation —
// it does NOT get inherited by sibling relative loads (style.css, app.js),
// so it can't interfere with those picking up the path-embedded idToken.
//
// Deliberately keyed off the MAX updatedAt across ALL files, not just
// index.html: the system prompt tells Claude it doesn't need to re-emit
// index.html when only style.css/app.js changed, so index.html's own
// timestamp can stay identical across a restore that genuinely changes what
// the preview renders — watching only that one file missed real changes.
const previewVersion = computed(() =>
  files.value.reduce((max, f) => Math.max(max, f.updatedAt?.toMillis() ?? 0), 0),
)

const previewUrl = computed(() => {
  if (!previewIndexFile.value || !previewToken.value) return ''
  return `/preview/${projectId.value}/${previewToken.value}/index.html?v=${previewVersion.value}`
})

const prompt = ref('')
const activePath = ref<string | undefined>(undefined)
const savingPath = ref<string | undefined>(undefined)

// `liveFiles` is only trustworthy WHILE a generation is actively streaming —
// it holds the in-progress buffer for live typing effects. Once streaming
// stops (complete, error, or abort), Firestore's `files` is already the
// up-to-date source of truth (persistence happens before `complete` fires),
// so it must take priority again — otherwise a stale path/content from the
// last generation lingers indefinitely (e.g. after a snapshot restore,
// which never touches `liveFiles` at all) until a full page reload resets it.
const allPaths = computed(() => {
  const set = new Set(files.value.map((f) => f.path))
  if (streaming.value) {
    for (const p of Object.keys(liveFiles.value)) set.add(p)
  }
  return Array.from(set).sort()
})

watchEffect(() => {
  if (!activePath.value && allPaths.value.length > 0) {
    activePath.value = allPaths.value[0]
  }
  if (activePath.value && !allPaths.value.includes(activePath.value)) {
    activePath.value = allPaths.value[0] ?? undefined
  }
})

const activeContent = computed(() => {
  if (!activePath.value) return ''
  if (streaming.value && activePath.value in liveFiles.value) return liveFiles.value[activePath.value]
  return files.value.find((f) => f.path === activePath.value)?.content ?? ''
})

const activeFileId = computed(() => files.value.find((f) => f.path === activePath.value)?.id ?? null)
const isStreamingActive = computed(
  () => streaming.value && !!activePath.value && streamingFiles.value.has(activePath.value),
)

function languageForPath(path: string): string {
  const ext = path.split('.').pop() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    vue: 'html',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
  }
  return map[ext] ?? 'plaintext'
}

async function onEditorChange(value: string | undefined) {
  if (streaming.value || !activeFileId.value || value === undefined) return
  savingPath.value = activePath.value
  try {
    await Promise.all([
      updateDoc(doc(db, `projects/${projectId.value}/files`, activeFileId.value), {
        content: value,
        updatedAt: serverTimestamp(),
      }),
      // A manual edit diverges the live files from whichever snapshot was
      // active, so no snapshot should show as "current" until the next
      // generation or restore.
      updateDoc(doc(db, 'projects', projectId.value), { activeSnapshotId: null }),
    ])
  } finally {
    savingPath.value = undefined
  }
}

async function onSend() {
  const text = prompt.value.trim()
  if (!text) return
  prompt.value = ''
  await send(text)
}

watch(projectId, () => {
  activePath.value = undefined
})
</script>

<template>
  <main class="flex h-screen flex-col bg-background">
    <header class="flex items-center justify-between border-b px-4 py-2">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="sm" @click="router.push({ name: 'dashboard' })">← Projects</Button>
        <Badge v-if="streaming" variant="outline" class="gap-1.5">
          <span class="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          generating…
        </Badge>
      </div>
      <SnapshotHistorySheet :project-id="projectId" />
    </header>

    <div class="grid min-h-0 flex-1 grid-cols-[320px_1fr_1fr] overflow-hidden">
      <!-- Chat -->
      <div class="flex min-h-0 flex-col border-r">
        <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <div
            v-for="(m, i) in messages"
            :key="i"
            class="rounded-md px-3 py-2 text-sm whitespace-pre-wrap"
            :class="m.role === 'user' ? 'self-end bg-primary/10 max-w-[85%]' : 'self-start bg-muted max-w-[90%]'"
          >
            {{ m.content || (m.role === 'assistant' && streaming ? '…' : '') }}
          </div>
          <p v-if="error" class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{{ error }}</p>
        </div>
        <form class="flex gap-2 border-t p-3" @submit.prevent="onSend">
          <Input v-model="prompt" placeholder="Describe a change…" :disabled="streaming" />
          <Button type="submit" :disabled="streaming || !prompt.trim()">↑</Button>
        </form>
      </div>

      <!-- Editor -->
      <div class="flex min-h-0 flex-col overflow-hidden">
        <Tabs v-if="allPaths.length > 0" v-model="activePath" class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div class="w-full overflow-x-auto border-b">
            <TabsList class="w-max justify-start rounded-none bg-transparent px-2">
              <TabsTrigger
                v-for="p in allPaths"
                :key="p"
                :value="p"
                class="shrink-0 gap-1.5 text-xs"
              >
                {{ p }}
                <span v-if="streaming && streamingFiles.has(p)" class="h-1.5 w-1.5 rounded-full bg-amber-500" />
              </TabsTrigger>
            </TabsList>
          </div>
          <div class="relative min-h-0 flex-1">
            <VueMonacoEditor
              :key="activePath"
              :value="activeContent"
              :language="activePath ? languageForPath(activePath) : 'plaintext'"
              theme="vs"
              height="100%"
              width="100%"
              :options="{ readOnly: streaming || isStreamingActive, minimap: { enabled: false }, fontSize: 13 }"
              @update:value="onEditorChange"
            />
            <span v-if="savingPath === activePath" class="absolute right-3 top-2 text-xs text-muted-foreground">
              saving…
            </span>
          </div>
        </Tabs>
        <div v-else class="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No files yet — describe what to build in the chat.
        </div>
      </div>

      <!-- Preview -->
      <div class="flex min-h-0 flex-col border-l">
        <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground">Preview</div>
        <iframe
          v-if="previewUrl"
          :key="previewVersion"
          :src="previewUrl"
          class="min-h-0 flex-1 bg-white"
          title="Live preview"
        />
        <div v-else class="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
          No index.html yet —<br />generate something to see it render here.
        </div>
      </div>
    </div>
  </main>
</template>
