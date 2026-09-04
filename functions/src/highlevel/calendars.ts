import { hlRequest } from './client'

export interface HighLevelCalendar {
  id: string
  name: string
  locationId: string
}

export function listCalendars(uid: string, locationId: string) {
  return hlRequest<{ calendars: HighLevelCalendar[] }>(uid, '/calendars/', { query: { locationId } })
}

export function getFreeSlots(
  uid: string,
  calendarId: string,
  startDate: number,
  endDate: number,
  opts: { timezone?: string; userId?: string } = {},
) {
  return hlRequest<Record<string, { slots: string[] }>>(uid, `/calendars/${calendarId}/free-slots`, {
    query: { startDate, endDate, ...opts },
  })
}

export function getCalendarEvents(
  uid: string,
  locationId: string,
  startTime: number,
  endTime: number,
  opts: { calendarId?: string; userId?: string; groupId?: string },
) {
  return hlRequest<{ events: unknown[] }>(uid, '/calendars/events', {
    query: { locationId, startTime, endTime, ...opts },
  })
}
