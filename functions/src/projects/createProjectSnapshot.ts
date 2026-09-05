import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import '../admin'
import { createSnapshot } from './createSnapshot'

interface CreateSnapshotData {
  projectId: string
}

// Manual checkpoint, triggered by a "Save Snapshot" button — unlike
// generation, which always snapshots on completion, edits made directly in
// the editor never do. Debouncing that automatically was considered and
// rejected: it would spam one version per pause-in-typing, making v1, v2,
// v3… meaningless. A manual step keeps snapshot history to points the user
// actually decided were worth keeping.
export const createProjectSnapshot = onCall<CreateSnapshotData>(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required')

  const { projectId } = request.data ?? {}
  if (!projectId) throw new HttpsError('invalid-argument', 'projectId is required')

  const projectDoc = await getFirestore().doc(`projects/${projectId}`).get()
  if (!projectDoc.exists || projectDoc.data()?.ownerId !== uid) {
    throw new HttpsError('permission-denied', 'Not your project')
  }

  const snapshotId = await createSnapshot(projectId, 'Manual save')
  return { snapshotId }
})
