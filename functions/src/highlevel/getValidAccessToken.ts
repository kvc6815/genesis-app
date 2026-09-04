import '../admin'
import { refreshAccessToken } from './tokenExchange'
import { getHighLevelToken, updateHighLevelToken } from './tokenStore'

const EXPIRY_BUFFER_MS = 60 * 1000

export async function getValidAccessToken(uid: string): Promise<string> {
  const token = await getHighLevelToken(uid)
  if (!token) {
    throw new Error(`No HighLevel token stored for user ${uid}`)
  }

  if (Date.now() < token.expiresAt - EXPIRY_BUFFER_MS) {
    return token.accessToken
  }

  const refreshed = await refreshAccessToken(token.refreshToken, token.userType)
  await updateHighLevelToken(uid, refreshed)
  return refreshed.access_token
}
