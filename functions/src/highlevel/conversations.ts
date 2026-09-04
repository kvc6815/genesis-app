import { hlRequest } from './client'

export interface HighLevelConversation {
  id: string
  contactId: string
  locationId: string
  lastMessageBody?: string
  lastMessageType?: string
  unreadCount?: number
  fullName?: string
}

export function searchConversations(
  uid: string,
  locationId: string,
  opts: { limit?: number; query?: string; contactId?: string } = {},
) {
  return hlRequest<{ conversations: HighLevelConversation[]; total: number }>(uid, '/conversations/search', {
    query: { locationId, ...opts },
  })
}

export function getMessages(uid: string, conversationId: string, opts: { limit?: number } = {}) {
  return hlRequest<{ messages: { messages: unknown[]; nextPage: boolean; lastMessageId?: string } }>(
    uid,
    `/conversations/${conversationId}/messages`,
    { query: opts },
  )
}

export function sendMessage(
  uid: string,
  contactId: string,
  type: string,
  message: string,
) {
  return hlRequest<{ conversationId: string; messageId: string }>(uid, '/conversations/messages', {
    method: 'POST',
    body: { contactId, type, message },
  })
}
