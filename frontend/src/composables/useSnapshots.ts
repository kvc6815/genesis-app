import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import { collection, doc, onSnapshot, orderBy, query, type Timestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'

export interface ProjectSnapshot {
  id: string
  createdAt: Timestamp | null
  fileCount: number
  label: string | null
  version: number
}

const restoreProjectSnapshot = httpsCallable<{ projectId: string; snapshotId: string }, { ok: boolean }>(
  functions,
  'restoreProjectSnapshot',
)

export function useSnapshots(projectId: Ref<string | undefined>) {
  const rawSnapshots = ref<ProjectSnapshot[]>([])
  const activeSnapshotId = ref<string | null>(null)
  const restoring = ref(false)
  const error = ref<string | null>(null)
  let unsubscribeSnapshots: (() => void) | null = null
  let unsubscribeProject: (() => void) | null = null

  watch(
    projectId,
    (id) => {
      unsubscribeSnapshots?.()
      unsubscribeProject?.()
      unsubscribeSnapshots = null
      unsubscribeProject = null
      rawSnapshots.value = []
      activeSnapshotId.value = null

      if (!id) return

      const q = query(collection(db, `projects/${id}/snapshots`), orderBy('version', 'desc'))
      unsubscribeSnapshots = onSnapshot(q, (snap) => {
        rawSnapshots.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProjectSnapshot)
      })
      unsubscribeProject = onSnapshot(doc(db, 'projects', id), (snap) => {
        activeSnapshotId.value = (snap.data()?.activeSnapshotId as string | undefined) ?? null
      })
    },
    { immediate: true },
  )

  onUnmounted(() => {
    unsubscribeSnapshots?.()
    unsubscribeProject?.()
  })

  // Active snapshot pinned to the top, everything else newest-version-first.
  const snapshots = computed(() =>
    [...rawSnapshots.value].sort((a, b) => {
      if (a.id === activeSnapshotId.value) return -1
      if (b.id === activeSnapshotId.value) return 1
      return b.version - a.version
    }),
  )

  async function restore(snapshotId: string) {
    if (!projectId.value || restoring.value) return
    restoring.value = true
    error.value = null
    try {
      await restoreProjectSnapshot({ projectId: projectId.value, snapshotId })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Restore failed'
    } finally {
      restoring.value = false
    }
  }

  return { snapshots, activeSnapshotId, restoring, error, restore }
}
