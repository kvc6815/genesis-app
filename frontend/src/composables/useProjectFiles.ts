import { onUnmounted, ref, watch, type Ref } from 'vue'
import { collection, onSnapshot, orderBy, query, type Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface ProjectFile {
  id: string
  path: string
  content: string
  updatedAt: Timestamp | null
}

export function useProjectFiles(projectId: Ref<string | undefined>) {
  const files = ref<ProjectFile[]>([])
  const loading = ref(true)
  let unsubscribe: (() => void) | null = null

  watch(
    projectId,
    (id) => {
      unsubscribe?.()
      unsubscribe = null

      if (!id) {
        files.value = []
        loading.value = false
        return
      }

      loading.value = true
      const q = query(collection(db, `projects/${id}/files`), orderBy('path'))
      unsubscribe = onSnapshot(q, (snapshot) => {
        files.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ProjectFile)
        loading.value = false
      })
    },
    { immediate: true },
  )

  onUnmounted(() => unsubscribe?.())

  return { files, loading }
}
