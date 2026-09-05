import { onRequest } from 'firebase-functions/v2/https'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import '../admin'
import { pathToDocId } from '../projects/fileDocId'

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
}

// Serves a project's files for the live preview at
// /preview/{projectId}/{idToken}/{filePath}. The idToken lives in the PATH
// (not a query param) specifically so that relative sibling loads from
// index.html — <link href="style.css">, <script src="app.js"> — inherit it
// automatically via normal relative-URL resolution; a query string on the
// top-level src would not propagate to those requests.
export const previewFile = onRequest(async (req, res) => {
  const segments = req.path.replace(/^\/preview\/?/, '').split('/').filter(Boolean)
  const [projectId, idToken, ...fileParts] = segments
  const filePath = fileParts.join('/')

  if (!projectId || !idToken || !filePath) {
    res.status(400).send('bad preview URL')
    return
  }

  let uid: string
  try {
    uid = (await getAuth().verifyIdToken(idToken)).uid
  } catch {
    res.status(401).send('invalid idToken')
    return
  }

  const db = getFirestore()
  const projectDoc = await db.doc(`projects/${projectId}`).get()
  if (!projectDoc.exists || projectDoc.data()?.ownerId !== uid) {
    res.status(403).send('not your project')
    return
  }

  const fileDoc = await db.doc(`projects/${projectId}/files/${pathToDocId(filePath)}`).get()
  if (!fileDoc.exists) {
    res.status(404).send(`no file: ${filePath}`)
    return
  }

  let content = (fileDoc.data()?.content as string | undefined) ?? ''
  const ext = filePath.split('.').pop() ?? ''
  res.set('Content-Type', CONTENT_TYPES[ext] ?? 'text/plain; charset=utf-8')
  res.set('Cache-Control', 'no-store')

  if (filePath === 'index.html') {
    const inject = `<script>window.GENESIS_PROJECT_ID=${JSON.stringify(projectId)};window.GENESIS_ID_TOKEN=${JSON.stringify(idToken)};<\/script>`
    content = content.includes('<head>') ? content.replace('<head>', `<head>${inject}`) : inject + content
  }

  res.send(content)
})
