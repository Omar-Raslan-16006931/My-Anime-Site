// Passkey (WebAuthn) helpers — thin wrappers over Supabase Auth's native,
// experimental passkey API (requires @supabase/supabase-js >= 2.105.0 and
// `auth.experimental.passkey = true`, set in ../supabase.js).
import { supabase } from '../supabase'

// Rough capability check so we only show passkey UI where it can work.
export const passkeysSupported = () =>
  typeof window !== 'undefined' &&
  !!window.PublicKeyCredential &&
  typeof supabase.auth.signInWithPasskey === 'function'

// Register a passkey for the currently signed-in user. Supabase derives a
// friendly name from the authenticator (e.g. "iCloud Keychain").
export async function registerPasskey() {
  const { data, error } = await supabase.auth.registerPasskey()
  if (error) throw error
  return data
}

// Sign in with a discoverable passkey — no email/username needed.
export async function loginWithPasskey() {
  const { data, error } = await supabase.auth.signInWithPasskey()
  if (error) throw error
  return data
}

export async function listPasskeys() {
  const { data, error } = await supabase.auth.passkey.list()
  if (error) throw error
  return data || []
}

export async function renamePasskey(passkeyId, friendlyName) {
  const { error } = await supabase.auth.passkey.update({ passkeyId, friendlyName })
  if (error) throw error
  return true
}

export async function deletePasskey(passkeyId) {
  const { error } = await supabase.auth.passkey.delete({ passkeyId })
  if (error) throw error
  return true
}
