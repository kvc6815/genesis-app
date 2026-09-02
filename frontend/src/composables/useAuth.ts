import { ref, watch } from 'vue'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

const user = ref<User | null>(null)
const authReady = ref(false)

onAuthStateChanged(auth, (firebaseUser) => {
  user.value = firebaseUser
  authReady.value = true
})

async function signUp(email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await setDoc(doc(db, 'users', credential.user.uid), {
    email: credential.user.email,
    createdAt: serverTimestamp(),
  })
}

function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

function signOut() {
  return firebaseSignOut(auth)
}

function waitForAuthReady() {
  if (authReady.value) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const stop = watch(authReady, (ready) => {
      if (ready) {
        stop()
        resolve()
      }
    })
  })
}

export function useAuth() {
  return { user, authReady, signUp, signIn, signOut, waitForAuthReady }
}
