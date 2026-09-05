import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import '../admin'
import { restoreSnapshot } from './restoreSnapshot'

interface RestoreSnapshotData {
  projectId: string
  snapshotId: string
}

export const restoreProjectSnapshot = onCall<RestoreSnapshotData>(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required')

  const { projectId, snapshotId } = request.data ?? {}
  if (!projectId || !snapshotId) {
    throw new HttpsError('invalid-argument', 'projectId and snapshotId are required')
  }

  const projectDoc = await getFirestore().doc(`projects/${projectId}`).get()
  if (!projectDoc.exists || projectDoc.data()?.ownerId !== uid) {
    throw new HttpsError('permission-denied', 'Not your project')
  }

  await restoreSnapshot(projectId, snapshotId)
  return { ok: true }
})
