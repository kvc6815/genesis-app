<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Project } from '@/composables/useProjects'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
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
const router = useRouter()

function open() {
  router.push({ name: 'project-workspace', params: { id: props.project.id } })
}

const updatedLabel = computed(() => formatRelativeTime(props.project.updatedAt))
</script>

<template>
  <Card class="cursor-pointer gap-3 py-4 hover:border-foreground/30" @click="open">
    <CardHeader class="flex flex-row items-start justify-between gap-2">
      <div class="flex flex-col gap-1">
        <CardTitle class="text-base">{{ project.name }}</CardTitle>
        <CardDescription class="line-clamp-2">{{ project.description || 'No description' }}</CardDescription>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" class="h-6 w-6 shrink-0" @click.stop>⋮</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" @click="emit('delete', project.id)">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </CardHeader>
    <div class="flex items-center justify-between px-6 text-xs text-muted-foreground">
      <span>{{ project.fileCount ?? 0 }} files · {{ project.snapshotCount ?? 0 }} snapshots</span>
      <span>{{ updatedLabel }}</span>
    </div>
  </Card>
</template>
