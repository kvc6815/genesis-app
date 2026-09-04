import { onRequest } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import '../admin'
import { searchContacts } from './contacts'
import { searchConversations, getMessages } from './conversations'
import { listCalendars, getCalendarEvents } from './calendars'

// Temporary — proves the Phase 2c wrappers hit real HL endpoints and get
// real data back. Remove before Phase 5 hardening.
export const hlSmokeTest = onRequest(async (req, res) => {
  const uid = req.query.uid
  if (typeof uid !== 'string') {
    res.status(400).json({ error: 'pass ?uid=<firebase uid>' })
    return
  }

  const userDoc = await getFirestore().doc(`users/${uid}`).get()
  const locationId = userDoc.data()?.highlevel?.locationId
  if (!locationId) {
    res.status(400).json({ error: `no highlevel.locationId on users/${uid}` })
    return
  }

  const results: Record<string, unknown> = { locationId }

  try {
    results.contacts = await searchContacts(uid, locationId, { pageLimit: 5 })
  } catch (err) {
    results.contacts = { error: err instanceof Error ? err.message : String(err) }
  }

  try {
    const conversations = await searchConversations(uid, locationId, { limit: 5 })
    results.conversations = conversations

    const firstConversationId = conversations.conversations[0]?.id
    if (firstConversationId) {
      try {
        results.messages = await getMessages(uid, firstConversationId, { limit: 5 })
      } catch (err) {
        results.messages = { error: err instanceof Error ? err.message : String(err) }
      }
    }
  } catch (err) {
    results.conversations = { error: err instanceof Error ? err.message : String(err) }
  }

  try {
    const calendars = await listCalendars(uid, locationId)
    results.calendars = calendars

    const firstCalendarId = calendars.calendars[0]?.id
    if (firstCalendarId) {
      const now = Date.now()
      const in30Days = now + 30 * 24 * 60 * 60 * 1000
      try {
        results.calendarEvents = await getCalendarEvents(uid, locationId, now, in30Days, {
          calendarId: firstCalendarId,
        })
      } catch (err) {
        results.calendarEvents = { error: err instanceof Error ? err.message : String(err) }
      }
    }
  } catch (err) {
    results.calendars = { error: err instanceof Error ? err.message : String(err) }
  }

  res.json(results)
})
