// dmosh license fulfillment — a Stripe webhook that mints a license key on
// purchase and emails it to the buyer. Standard Web APIs (fetch, crypto.subtle),
// so it runs on Cloudflare Workers, Deno Deploy, or Vercel/Netlify Edge.
//
// Secrets:  STRIPE_WEBHOOK_SECRET, LICENSE_PRIVATE_KEY, RESEND_API_KEY
// Vars:     FROM_EMAIL, DOWNLOAD_URL
import { mintKey } from './license.mjs'

const enc = new TextEncoder()

/** Verify Stripe's `Stripe-Signature` header (HMAC-SHA256 over `t.payload`). */
async function verifyStripe(payload, header, secret, toleranceSec = 300) {
  if (!header) return false
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')))
  const { t, v1 } = parts
  if (!t || !v1) return false
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return false
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`))
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
  // constant-time-ish compare
  if (hex.length !== v1.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i)
  return diff === 0
}

function emailHtml(env, key) {
  return `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a">
      <h2 style="margin:0 0 8px">Thanks for buying dmosh desktop</h2>
      <p style="color:#555">Download the app, then paste your license key into it to activate.</p>
      <p><a href="${env.DOWNLOAD_URL}" style="display:inline-block;background:#ff5135;color:#fff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:8px">Download dmosh desktop</a></p>
      <p style="margin:16px 0 4px;color:#555">Your license key:</p>
      <pre style="background:#f0f0ef;padding:12px;border-radius:8px;white-space:pre-wrap;word-break:break-all;font-size:13px">${key}</pre>
      <p style="color:#888;font-size:13px">Open dmosh desktop → it runs a free trial → paste this key to unlock it permanently. Keep this email; the key works offline, forever.</p>
    </div>`
}

async function sendEmail(env, to, key) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to,
      subject: 'Your dmosh desktop license key',
      html: emailHtml(env, key),
    }),
  })
  if (!res.ok) throw new Error(`email send failed: ${res.status} ${await res.text()}`)
}

export default {
  async fetch(request, env) {
    if (request.method === 'GET') return new Response('dmosh fulfillment: ok')
    if (request.method !== 'POST') return new Response('method not allowed', { status: 405 })

    const payload = await request.text()
    if (!(await verifyStripe(payload, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET))) {
      return new Response('invalid signature', { status: 400 })
    }

    let event
    try {
      event = JSON.parse(payload)
    } catch {
      return new Response('bad json', { status: 400 })
    }
    if (event.type !== 'checkout.session.completed') return new Response('ignored', { status: 200 })

    const session = event.data.object
    const email = session.customer_details?.email || session.customer_email
    if (!email) return new Response('no email on session', { status: 200 })

    try {
      const key = await mintKey(env.LICENSE_PRIVATE_KEY, email)
      await sendEmail(env, email, key)
    } catch (e) {
      // Non-2xx → Stripe retries with backoff, so a transient failure self-heals.
      return new Response(`fulfillment error: ${e.message}`, { status: 500 })
    }
    return new Response('ok', { status: 200 })
  },
}
