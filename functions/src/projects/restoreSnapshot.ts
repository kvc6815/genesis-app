import { getFirestore } from 'firebase-admin/firestore'

export async function restoreSnapshot(projectId: string, snapshotId: string): Promise<void> {
  const db = getFirestore()
  const [liveFiles, snapshotFiles] = await Promise.all([
    db.collection(`projects/${projectId}/files`).get(),
    db.collection(`projects/${projectId}/snapshots/${snapshotId}/files`).get(),
  ])

  const snapshotDocIds = new Set(snapshotFiles.docs.map((d) => d.id))
  const batch = db.batch()

  for (const doc of liveFiles.docs) {
    if (!snapshotDocIds.has(doc.id)) {
      batch.delete(doc.ref)
    }
  }
  for (const doc of snapshotFiles.docs) {
    batch.set(db.doc(`projects/${projectId}/files/${doc.id}`), doc.data())
  }

  await batch.commit()
}
