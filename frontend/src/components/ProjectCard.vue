<script setup lang="ts">
import { computed } from 'vue'
import type { Timestamp } from 'firebase/firestore'
import type { Project } from '@/composables/useProjects'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

const props = defineProps<{ project: Project }>()
const emit = defineEmits<{ delete: [projectId: string] }>()

function formatRelativeTime(ts: Timestamp | null): string {
  if (!ts) return 'just now'
  const seconds = Math.floor((Date.now() - ts.toMillis()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const updatedLabel = computed(() => formatRelativeTime(props.project.updatedAt))
</script>

<template>
  <Card class="gap-3 py-4">
    <CardHeader class="flex flex-row items-start justify-between gap-2">
      <div class="flex flex-col gap-1">
        <CardTitle class="text-base">{{ project.name }}</CardTitle>
        <CardDescription class="line-clamp-2">{{ project.description || 'No description' }}</CardDescription>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" class="h-6 w-6 shrink-0">⋮</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" @click="emit('delete', project.id)">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </CardHeader>
    <div class="flex items-center justify-between px-6 text-xs text-muted-foreground">
      <span>0 files · 0 snapshots</span>
      <span>{{ updatedLabel }}</span>
    </div>
  </Card>
</template>
