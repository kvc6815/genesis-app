import { onUnmounted, ref, watch } from 'vue'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from './useAuth'

interface HighLevelStatus {
  connected: boolean
  locationId: string | null
  companyId: string | null
}

const status = ref<HighLevelStatus>({ connected: false, locationId: null, companyId: null })
const loading = ref(true)

let unsubscribe: (() => void) | null = null

function subscribe(uid: string | undefined) {
  unsubscribe?.()
  unsubscribe = null

  if (!uid) {
    status.value = { connected: false, locationId: null, companyId: null }
    loading.value = false
    return
  }

  loading.value = true
  unsubscribe = onSnapshot(doc(db, 'users', uid), (snapshot) => {
    const highlevel = snapshot.data()?.highlevel
    status.value = {
      connected: Boolean(highlevel?.connected),
      locationId: highlevel?.locationId ?? null,
      companyId: highlevel?.companyId ?? null,
    }
    loading.value = false
  })
}

export function useHighLevelConnection() {
  const { user } = useAuth()

  watch(user, (u) => subscribe(u?.uid), { immediate: true })
  onUnmounted(() => unsubscribe?.())

  async function buildConnectUrl(): Promise<string> {
    if (!user.value) throw new Error('Must be signed in to connect HighLevel')

    const token = crypto.randomUUID()
    await setDoc(doc(db, 'oauthStates', token), {
      uid: user.value.uid,
      createdAt: serverTimestamp(),
    })

    const url = new URL(import.meta.env.VITE_HL_INSTALL_URL)
    url.searchParams.set('state', token)
    return url.toString()
  }

  return { status, loading, buildConnectUrl }
}
