import { onUnmounted, ref, watch } from 'vue'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from './useAuth'
import { useHighLevelConnection } from './useHighLevelConnection'

export interface Project {
  id: string
  name: string
  description: string
  ownerId: string
  locationId: string | null
  deleted: boolean
  fileCount?: number
  snapshotCount?: number
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

const projects = ref<Project[]>([])
const loading = ref(true)

let unsubscribe: (() => void) | null = null

function subscribe(uid: string | undefined) {
  unsubscribe?.()
  unsubscribe = null

  if (!uid) {
    projects.value = []
    loading.value = false
    return
  }

  loading.value = true
  const q = query(
    collection(db, 'projects'),
    where('ownerId', '==', uid),
    where('deleted', '==', false),
    orderBy('updatedAt', 'desc'),
  )
  unsubscribe = onSnapshot(q, (snapshot) => {
    projects.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Project)
    loading.value = false
  })
}

export function useProjects() {
  const { user } = useAuth()
  const { status } = useHighLevelConnection()

  watch(user, (u) => subscribe(u?.uid), { immediate: true })
  onUnmounted(() => unsubscribe?.())

  async function createProject(name: string, description: string) {
    if (!user.value) throw new Error('Must be signed in to create a project')

    await addDoc(collection(db, 'projects'), {
      name,
      description,
      ownerId: user.value.uid,
      locationId: status.value.locationId,
      deleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async function softDeleteProject(projectId: string) {
    await updateDoc(doc(db, 'projects', projectId), {
      deleted: true,
      updatedAt: serverTimestamp(),
    })
  }

  return { projects, loading, createProject, softDeleteProject }
}
