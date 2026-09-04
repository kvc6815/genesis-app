import { getFirestore } from 'firebase-admin/firestore'

const MAX_STATE_AGE_MS = 10 * 60 * 1000

export async function consumeOAuthState(token: string): Promise<string | null> {
  const ref = getFirestore().doc(`oauthStates/${token}`)
  const snapshot = await ref.get()
  if (!snapshot.exists) return null

  const data = snapshot.data() as { uid: string; createdAt: FirebaseFirestore.Timestamp }
  await ref.delete()

  const age = Date.now() - data.createdAt.toMillis()
  if (age > MAX_STATE_AGE_MS) return null

  return data.uid
}
