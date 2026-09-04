import { logger } from 'firebase-functions'
import { getValidAccessToken } from './getValidAccessToken'

const BASE_URL = 'https://services.leadconnectorhq.com'

interface RequestOptions {
  method?: string
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
}

export async function hlRequest<T>(uid: string, path: string, options: RequestOptions = {}): Promise<T> {
  const accessToken = await getValidAccessToken(uid)
  const url = new URL(path, BASE_URL)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const method = options.method ?? 'GET'
  logger.info(`HL ${method} ${url.pathname}${url.search} request`, {
    headers: { Authorization: '<redacted>', Version: 'v3' },
    body: options.body ?? undefined,
  })

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Version: 'v3',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const responseText = await response.text()
  if (!response.ok) {
    logger.warn(`HL ${method} ${url.pathname} failed: ${response.status} ${responseText}`)
    throw new Error(`HL API ${method} ${path} failed: ${response.status} ${responseText}`)
  }

  logger.info(`HL ${method} ${url.pathname} response`, { status: response.status, body: responseText })
  return JSON.parse(responseText) as T
}
