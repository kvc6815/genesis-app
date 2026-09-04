import { logger } from 'firebase-functions'

const BASE_URL = 'https://services.leadconnectorhq.com'

export interface HighLevelLocation {
  id: string
  name: string
}

export async function searchLocationsForCompany(
  companyAccessToken: string,
  companyId: string,
): Promise<HighLevelLocation[]> {
  const url = new URL('/locations/search', BASE_URL)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('limit', '100')

  logger.info(`HL GET ${url.pathname}${url.search} request`, {
    headers: { Authorization: '<redacted>', Version: 'v3' },
  })

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${companyAccessToken}`,
      Version: 'v3',
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    logger.warn(`HL GET ${url.pathname} failed: ${response.status} ${text}`)
    throw new Error(`HL locations search failed: ${response.status} ${text}`)
  }
  const data = (await response.json()) as { locations: HighLevelLocation[] }
  logger.info(`HL GET ${url.pathname} response`, { count: data.locations.length, locations: data.locations })
  return data.locations
}
