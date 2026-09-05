import { FieldValue, getFirestore } from 'firebase-admin/firestore'

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
    // Stamp a fresh updatedAt for the restore itself rather than copying the
    // snapshot's frozen one — a restore is a new write to the live files NOW,
    // and the frontend's preview cache-busting keys off this timestamp to
    // detect that content changed.
    batch.set(db.doc(`projects/${projectId}/files/${doc.id}`), {
      ...doc.data(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }
  batch.set(
    db.doc(`projects/${projectId}`),
    { fileCount: snapshotFiles.size, activeSnapshotId: snapshotId },
    { merge: true },
  )

  await batch.commit()
}
