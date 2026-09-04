import { logger } from 'firebase-functions'

const TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token'

export interface HighLevelTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  scope: string
  userType: 'Company' | 'Location'
  companyId?: string
  locationId?: string
  userId?: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

// Never log access_token/refresh_token/client_secret in cleartext — they're
// real bearer credentials. Log everything else so the request/response shape
// is inspectable in Cloud Logging without exposing usable secrets.
function redactedRequestBody(body: URLSearchParams): Record<string, string> {
  const redacted: Record<string, string> = {}
  for (const [key, value] of body.entries()) {
    redacted[key] = key === 'client_secret' || key === 'refresh_token' ? '<redacted>' : value
  }
  return redacted
}

function redactedResponse(token: HighLevelTokenResponse) {
  return {
    token_type: token.token_type,
    expires_in: token.expires_in,
    scope: token.scope,
    userType: token.userType,
    companyId: token.companyId,
    locationId: token.locationId,
    userId: token.userId,
    hasAccessToken: Boolean(token.access_token),
    hasRefreshToken: Boolean(token.refresh_token),
  }
}

export async function exchangeAuthorizationCode(code: string): Promise<HighLevelTokenResponse> {
  const body = new URLSearchParams({
    client_id: requireEnv('HL_CLIENT_ID'),
    client_secret: requireEnv('HL_CLIENT_SECRET'),
    grant_type: 'authorization_code',
    code,
    user_type: 'Location',
    redirect_uri: requireEnv('HL_REDIRECT_URI'),
  })

  logger.info('HL POST /oauth/token (authorization_code) request', { body: redactedRequestBody(body) })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    logger.warn(`HL POST /oauth/token (authorization_code) failed: ${response.status} ${text}`)
    throw new Error(`HL token exchange failed: ${response.status} ${text}`)
  }
  const token = (await response.json()) as HighLevelTokenResponse
  logger.info('HL POST /oauth/token (authorization_code) response', redactedResponse(token))
  return token
}

export async function refreshAccessToken(
  refreshToken: string,
  userType: 'Company' | 'Location',
): Promise<HighLevelTokenResponse> {
  const body = new URLSearchParams({
    client_id: requireEnv('HL_CLIENT_ID'),
    client_secret: requireEnv('HL_CLIENT_SECRET'),
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    user_type: userType,
    redirect_uri: requireEnv('HL_REDIRECT_URI'),
  })

  logger.info('HL POST /oauth/token (refresh_token) request', { body: redactedRequestBody(body) })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    logger.warn(`HL POST /oauth/token (refresh_token) failed: ${response.status} ${text}`)
    throw new Error(`HL token refresh failed: ${response.status} ${text}`)
  }
  const token = (await response.json()) as HighLevelTokenResponse
  logger.info('HL POST /oauth/token (refresh_token) response', redactedResponse(token))
  return token
}
