import { FieldValue, getFirestore } from 'firebase-admin/firestore'

export async function createSnapshot(projectId: string, label?: string): Promise<string> {
  const db = getFirestore()
  const [filesSnapshot, projectDoc] = await Promise.all([
    db.collection(`projects/${projectId}/files`).get(),
    db.doc(`projects/${projectId}`).get(),
  ])
  const version = ((projectDoc.data()?.snapshotCount as number | undefined) ?? 0) + 1

  const snapshotRef = db.collection(`projects/${projectId}/snapshots`).doc()
  const batch = db.batch()

  batch.set(snapshotRef, {
    createdAt: FieldValue.serverTimestamp(),
    label: label ?? null,
    fileCount: filesSnapshot.size,
    version,
  })
  for (const doc of filesSnapshot.docs) {
    batch.set(snapshotRef.collection('files').doc(doc.id), doc.data())
  }
  batch.set(
    db.doc(`projects/${projectId}`),
    { snapshotCount: FieldValue.increment(1), activeSnapshotId: snapshotRef.id },
    { merge: true },
  )

  await batch.commit()
  return snapshotRef.id
}
