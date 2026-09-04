<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useProjectFiles } from '@/composables/useProjectFiles'
import { useGeneration } from '@/composables/useGeneration'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import VueMonacoEditor from '@guolao/vue-monaco-editor'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)

const { files } = useProjectFiles(projectId)
const { messages, liveFiles, streamingFiles, streaming, error, send } = useGeneration(projectId)

const prompt = ref('')
const activePath = ref<string | undefined>(undefined)
const savingPath = ref<string | undefined>(undefined)

// Every known path — persisted files plus anything currently/just streamed in
// that Firestore hasn't synced back yet.
const allPaths = computed(() => {
  const set = new Set(files.value.map((f) => f.path))
  for (const p of Object.keys(liveFiles.value)) set.add(p)
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
  if (activePath.value in liveFiles.value) return liveFiles.value[activePath.value]
  return files.value.find((f) => f.path === activePath.value)?.content ?? ''
})

const activeFileId = computed(() => files.value.find((f) => f.path === activePath.value)?.id ?? null)
const isStreamingActive = computed(() => (activePath.value ? streamingFiles.value.has(activePath.value) : false))

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
    await updateDoc(doc(db, `projects/${projectId.value}/files`, activeFileId.value), {
      content: value,
      updatedAt: serverTimestamp(),
    })
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
                <span v-if="streamingFiles.has(p)" class="h-1.5 w-1.5 rounded-full bg-amber-500" />
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

      <!-- Preview (Phase 4b) -->
      <div class="flex min-h-0 flex-col border-l">
        <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground">Preview</div>
        <div class="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
          Live preview lands in Phase 4b —<br />generated apps don't run here yet.
        </div>
      </div>
    </div>
  </main>
</template>
