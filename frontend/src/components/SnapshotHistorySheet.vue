<script setup lang="ts">
import { computed } from 'vue'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
import { useSnapshots } from '@/composables/useSnapshots'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet'

const props = defineProps<{ projectId: string }>()
const projectId = computed(() => props.projectId)

const { snapshots, activeSnapshotId, restoring, saving, error, restore, save } = useSnapshots(projectId)
</script>

<template>
  <Sheet>
    <SheetTrigger as-child>
      <Button variant="outline" size="sm">Snapshots</Button>
    </SheetTrigger>
    <SheetContent side="right" class="flex flex-col gap-4 p-4">
      <SheetHeader class="p-0">
        <SheetTitle>Snapshots</SheetTitle>
        <SheetDescription>
          One is created automatically after every successful generation. Save one manually to
          checkpoint edits you've made directly in the editor.
        </SheetDescription>
      </SheetHeader>

      <Button size="sm" :disabled="saving" @click="save">
        {{ saving ? 'Saving…' : 'Save Snapshot' }}
      </Button>

      <p v-if="error" class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{{ error }}</p>
      <p v-if="snapshots.length === 0" class="text-sm text-muted-foreground">No snapshots yet.</p>

      <div class="flex flex-1 flex-col gap-2 overflow-y-auto">
        <div
          v-for="s in snapshots"
          :key="s.id"
          class="flex items-center justify-between rounded-md border p-3 text-sm"
          :class="s.id === activeSnapshotId ? 'border-green-500/50 bg-green-500/5' : ''"
        >
          <div class="flex items-center gap-2">
            <span
              v-if="s.id === activeSnapshotId"
              class="h-2 w-2 shrink-0 rounded-full bg-green-500"
              title="Current"
            />
            <div class="flex flex-col gap-0.5">
              <span class="font-medium">v{{ s.version }}</span>
              <span class="text-xs text-muted-foreground">
                {{ formatRelativeTime(s.createdAt) }} · {{ s.fileCount }} file{{ s.fileCount === 1 ? '' : 's' }}
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            :disabled="restoring || s.id === activeSnapshotId"
            @click="restore(s.id)"
          >
            {{ s.id === activeSnapshotId ? 'Current' : restoring ? 'Restoring…' : 'Restore' }}
          </Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
