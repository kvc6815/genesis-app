import { logger } from 'firebase-functions'
import type { HighLevelTokenResponse } from './tokenExchange'
import { searchLocationsForCompany } from './locations'
import { exchangeForLocationToken } from './locationToken'

// HL's chooselocation consent screen can still grant a Company-level token
// even when the user picks a specific sub-account (root cause unconfirmed —
// see docs/KNOWN_GAPS.md). When that happens and the company has exactly one
// location, upgrade to a location-scoped token automatically so the user is
// never asked to find/paste a location ID themselves.
export async function autoUpgradeToLocationToken(
  uid: string,
  token: HighLevelTokenResponse,
): Promise<HighLevelTokenResponse> {
  if (token.userType !== 'Company' || token.locationId || !token.companyId) {
    return token
  }

  try {
    const locations = await searchLocationsForCompany(token.access_token, token.companyId)

    if (locations.length === 0) {
      logger.warn(`HL OAuth: company ${token.companyId} has no locations to auto-upgrade to (uid=${uid})`)
      return token
    }
    if (locations.length > 1) {
      logger.warn(
        `HL OAuth: company ${token.companyId} has ${locations.length} locations, ` +
          `cannot auto-select one (uid=${uid}) — known gap, see docs/KNOWN_GAPS.md`,
      )
      return token
    }

    return await exchangeForLocationToken(token.access_token, token.companyId, locations[0].id)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    logger.warn(`HL OAuth: auto-upgrade to location token failed for uid=${uid}: ${detail}`)
    return token
  }
}
