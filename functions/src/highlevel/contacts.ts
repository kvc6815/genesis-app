import { hlRequest } from './client'

export interface HighLevelContact {
  id: string
  name?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  locationId: string
}

export function getContact(uid: string, contactId: string) {
  return hlRequest<{ contact: HighLevelContact }>(uid, `/contacts/${contactId}`)
}

export function searchContacts(
  uid: string,
  locationId: string,
  opts: { query?: string; pageLimit?: number } = {},
) {
  return hlRequest<{ contacts: HighLevelContact[]; total: number }>(uid, '/contacts/search', {
    method: 'POST',
    body: { locationId, ...opts },
  })
}

export function createContact(
  uid: string,
  locationId: string,
  data: Record<string, unknown>,
) {
  return hlRequest<{ new: boolean; contact: HighLevelContact }>(uid, '/contacts/upsert', {
    method: 'POST',
    body: { locationId, ...data },
  })
}

export function updateContact(uid: string, contactId: string, data: Record<string, unknown>) {
  return hlRequest<{ succeeded: boolean; contact: HighLevelContact }>(uid, `/contacts/${contactId}`, {
    method: 'PUT',
    body: data,
  })
}
