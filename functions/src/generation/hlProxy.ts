import { onRequest } from 'firebase-functions/v2/https'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import '../admin'
import { getContact, searchContacts } from '../highlevel/contacts'
import { getMessages, searchConversations } from '../highlevel/conversations'
import { getCalendarEvents, listCalendars } from '../highlevel/calendars'

// The HTTP surface generated preview code calls (via a Firebase Hosting
// rewrite of /api/hl/**), proxying the Phase 2c HL wrappers. Generated code
// never sees a HighLevel token — only its own Firebase idToken + projectId,
// which this function verifies before doing anything.
export const hlProxy = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' })
    return
  }

  const idToken = req.query.idToken
  const projectId = req.query.projectId
  if (typeof idToken !== 'string' || typeof projectId !== 'string') {
    res.status(400).json({ error: 'missing idToken or projectId' })
    return
  }

  let uid: string
  try {
    uid = (await getAuth().verifyIdToken(idToken)).uid
  } catch {
    res.status(401).json({ error: 'invalid idToken' })
    return
  }

  const projectDoc = await getFirestore().doc(`projects/${projectId}`).get()
  const project = projectDoc.data()
  if (!projectDoc.exists || project?.ownerId !== uid) {
    res.status(403).json({ error: 'not your project' })
    return
  }

  const locationId = project?.locationId
  if (!locationId) {
    res.status(400).json({ error: 'project has no connected HighLevel location' })
    return
  }

  const segments = req.path.replace(/^\/api\/hl\/?/, '').split('/').filter(Boolean)

  try {
    if (segments.length === 1 && segments[0] === 'contacts') {
      const query = typeof req.query.query === 'string' ? req.query.query : undefined
      const pageLimit = req.query.pageLimit ? Number(req.query.pageLimit) : undefined
      res.json(await searchContacts(uid, locationId, { query, pageLimit }))
      return
    }
    if (segments.length === 2 && segments[0] === 'contacts') {
      res.json(await getContact(uid, segments[1]))
      return
    }
    if (segments.length === 1 && segments[0] === 'conversations') {
      const limit = req.query.limit ? Number(req.query.limit) : undefined
      res.json(await searchConversations(uid, locationId, { limit }))
      return
    }
    if (segments.length === 3 && segments[0] === 'conversations' && segments[2] === 'messages') {
      const limit = req.query.limit ? Number(req.query.limit) : undefined
      res.json(await getMessages(uid, segments[1], { limit }))
      return
    }
    if (segments.length === 1 && segments[0] === 'calendars') {
      res.json(await listCalendars(uid, locationId))
      return
    }
    if (segments.length === 2 && segments[0] === 'calendars' && segments[1] === 'events') {
      const startTime = Number(req.query.startTime)
      const endTime = Number(req.query.endTime)
      const calendarId = typeof req.query.calendarId === 'string' ? req.query.calendarId : undefined
      res.json(await getCalendarEvents(uid, locationId, startTime, endTime, { calendarId }))
      return
    }

    res.status(404).json({ error: `no route for ${req.path}` })
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) })
  }
})
