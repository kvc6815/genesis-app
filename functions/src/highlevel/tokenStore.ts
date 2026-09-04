import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import type { HighLevelTokenResponse } from './tokenExchange'

export interface HighLevelTokenDoc {
  accessToken: string
  refreshToken: string
  expiresAt: number
  scope: string
  userType: 'Company' | 'Location'
  locationId: string | null
  companyId: string | null
}

function tokenDocRef(uid: string) {
  return getFirestore().doc(`users/${uid}/highlevelToken/token`)
}

export async function saveHighLevelToken(uid: string, token: HighLevelTokenResponse) {
  const doc: HighLevelTokenDoc = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    scope: token.scope,
    userType: token.userType,
    locationId: token.locationId ?? null,
    companyId: token.companyId ?? null,
  }
  await tokenDocRef(uid).set(doc)
  await getFirestore()
    .doc(`users/${uid}`)
    .set(
      {
        highlevel: {
          connected: true,
          locationId: token.locationId ?? null,
          companyId: token.companyId ?? null,
          connectedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    )
}

export async function getHighLevelToken(uid: string): Promise<HighLevelTokenDoc | null> {
  const snapshot = await tokenDocRef(uid).get()
  return snapshot.exists ? (snapshot.data() as HighLevelTokenDoc) : null
}

export async function updateHighLevelToken(uid: string, token: HighLevelTokenResponse) {
  const doc: Partial<HighLevelTokenDoc> = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    scope: token.scope,
  }
  await tokenDocRef(uid).set(doc, { merge: true })
}
