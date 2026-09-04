import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import '../admin'
import { exchangeAuthorizationCode } from './tokenExchange'
import { saveHighLevelToken } from './tokenStore'
import { consumeOAuthState } from './oauthState'

function redirectToDashboard(hl: 'connected' | 'error', reason?: string) {
  const url = new URL(`${process.env.FRONTEND_URL}/dashboard`)
  url.searchParams.set('hl', hl)
  if (reason) url.searchParams.set('reason', reason)
  return url.toString()
}

export const hlOAuthCallback = onRequest(async (req, res) => {
  const { code, state, error } = req.query

  if (error) {
    logger.warn('HL OAuth denied or errored', { error })
    res.redirect(redirectToDashboard('error', 'denied'))
    return
  }

  if (typeof code !== 'string' || typeof state !== 'string') {
    logger.warn('HL OAuth callback missing code/state', { query: req.query })
    res.redirect(redirectToDashboard('error', 'missing_params'))
    return
  }

  const uid = await consumeOAuthState(state)
  if (!uid) {
    logger.warn('HL OAuth callback with invalid/expired state')
    res.redirect(redirectToDashboard('error', 'invalid_state'))
    return
  }

  try {
    const token = await exchangeAuthorizationCode(code)
    await saveHighLevelToken(uid, token)
    logger.info('HL OAuth connected', { uid, locationId: token.locationId })
    res.redirect(redirectToDashboard('connected'))
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    logger.error(`HL OAuth token exchange failed for uid=${uid}: ${detail}`)
    res.redirect(redirectToDashboard('error', 'token_exchange_failed'))
  }
})
