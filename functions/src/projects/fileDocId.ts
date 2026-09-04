// Firestore doc IDs can't contain "/", so a file's path (e.g. "src/App.vue")
// can't be used directly as the doc ID within the flat `files` subcollection.
// base64url is reversible and always produces valid characters.
export function pathToDocId(path: string): string {
  return Buffer.from(path, 'utf8').toString('base64url')
}

export function docIdToPath(docId: string): string {
  return Buffer.from(docId, 'base64url').toString('utf8')
}
