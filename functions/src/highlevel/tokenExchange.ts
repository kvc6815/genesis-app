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

export async function exchangeAuthorizationCode(code: string): Promise<HighLevelTokenResponse> {
  const body = new URLSearchParams({
    client_id: requireEnv('HL_CLIENT_ID'),
    client_secret: requireEnv('HL_CLIENT_SECRET'),
    grant_type: 'authorization_code',
    code,
    user_type: 'Location',
    redirect_uri: requireEnv('HL_REDIRECT_URI'),
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    throw new Error(`HL token exchange failed: ${response.status} ${await response.text()}`)
  }
  return (await response.json()) as HighLevelTokenResponse
}

export async function refreshAccessToken(refreshToken: string): Promise<HighLevelTokenResponse> {
  const body = new URLSearchParams({
    client_id: requireEnv('HL_CLIENT_ID'),
    client_secret: requireEnv('HL_CLIENT_SECRET'),
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    user_type: 'Location',
    redirect_uri: requireEnv('HL_REDIRECT_URI'),
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    throw new Error(`HL token refresh failed: ${response.status} ${await response.text()}`)
  }
  return (await response.json()) as HighLevelTokenResponse
}
