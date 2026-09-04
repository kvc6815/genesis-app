import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { pathToDocId } from './fileDocId'

export async function persistGeneratedFiles(
  projectId: string,
  files: Map<string, string>,
): Promise<void> {
  if (files.size === 0) return

  const db = getFirestore()
  const batch = db.batch()

  for (const [path, content] of files) {
    const ref = db.doc(`projects/${projectId}/files/${pathToDocId(path)}`)
    batch.set(ref, { path, content, updatedAt: FieldValue.serverTimestamp() })
  }
  batch.set(db.doc(`projects/${projectId}`), { updatedAt: FieldValue.serverTimestamp() }, { merge: true })

  await batch.commit()

  // fileCount can't just be incremented by files.size — some of these paths
  // may be overwrites of already-existing files, not new ones. A fresh count
  // after the write is the only way to stay correct.
  const countSnapshot = await db.collection(`projects/${projectId}/files`).count().get()
  await db.doc(`projects/${projectId}`).set({ fileCount: countSnapshot.data().count }, { merge: true })
}
