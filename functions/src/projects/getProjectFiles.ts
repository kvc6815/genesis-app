import { getFirestore } from 'firebase-admin/firestore'
import { docIdToPath } from './fileDocId'

export interface ProjectFile {
  path: string
  content: string
}

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const snapshot = await getFirestore().collection(`projects/${projectId}/files`).get()
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return { path: (data.path as string) ?? docIdToPath(doc.id), content: (data.content as string) ?? '' }
  })
}
