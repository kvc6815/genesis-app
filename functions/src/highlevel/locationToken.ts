import { logger } from 'firebase-functions'
import type { HighLevelTokenResponse } from './tokenExchange'

const LOCATION_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/locationToken'

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

export async function exchangeForLocationToken(
  companyAccessToken: string,
  companyId: string,
  locationId: string,
): Promise<HighLevelTokenResponse> {
  logger.info('HL POST /oauth/locationToken request', {
    body: { companyId, locationId },
    headers: { Authorization: '<redacted>', Version: '2021-07-28', 'Content-Type': 'application/json' },
  })

  const response = await fetch(LOCATION_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${companyAccessToken}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyId, locationId }),
  })

  if (!response.ok) {
    const text = await response.text()
    logger.warn(`HL POST /oauth/locationToken failed: ${response.status} ${text}`)
    throw new Error(`HL locationToken exchange failed: ${response.status} ${text}`)
  }
  const token = (await response.json()) as HighLevelTokenResponse
  logger.info('HL POST /oauth/locationToken response', redactedResponse(token))
  return token
}
