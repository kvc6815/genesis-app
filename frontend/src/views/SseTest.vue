<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

const message = ref('')
const log = ref<string[]>([])
const streaming = ref(false)
let source: EventSource | null = null

function stopStream() {
  source?.close()
  source = null
  streaming.value = false
}

function startStream() {
  stopStream()
  log.value = []
  streaming.value = true

  const url = new URL('sseEcho', `${import.meta.env.VITE_FUNCTIONS_BASE_URL}/`)
  if (message.value.trim()) url.searchParams.set('message', message.value.trim())

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
        Dev-only page proving the SSE pipe works (fake echo, no LLM) before Phase 3 wires up
        real generation.
      </p>
      <div class="flex gap-2">
        <Input v-model="message" placeholder="Message to echo back" @keydown.enter="startStream" />
        <Button :disabled="streaming" @click="startStream">
          {{ streaming ? 'Streaming…' : 'Test Stream' }}
        </Button>
      </div>
      <Card class="h-80 overflow-y-auto p-4 font-mono text-xs">
        <p v-if="log.length === 0" class="text-muted-foreground">No events yet.</p>
        <div v-for="(line, i) in log" :key="i">{{ line }}</div>
      </Card>
    </div>
  </main>
</template>
