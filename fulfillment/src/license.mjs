// Mint a dmosh license key, byte-for-byte compatible with `licctl sign` and the
// app's offline verifier (src-tauri/src/license.rs). A key is
//   base64url(message) "." base64url(ed25519_signature)
// where `message` is the buyer's email and the signature is over its raw bytes,
// made with the same 32-byte Ed25519 seed your `licctl keygen` printed.
import { sha512 } from '@noble/hashes/sha512'
import * as ed from '@noble/ed25519'

// @noble/ed25519 v2 needs a sha512 implementation wired in for sync signing.
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m))

function b64urlEncode(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** privateB64url: the base64url 32-byte seed from `licctl keygen`. */
export function mintKey(privateB64url, message) {
  const seed = b64urlDecode(privateB64url)
  if (seed.length !== 32) throw new Error('LICENSE_PRIVATE_KEY must be a 32-byte base64url seed')
  const msg = new TextEncoder().encode(message)
  const sig = ed.sign(msg, seed)
  return `${b64urlEncode(msg)}.${b64urlEncode(sig)}`
}
