# dmosh license fulfillment

A tiny serverless webhook: when Stripe reports a completed checkout, it mints an
offline Ed25519 license key (the same format `licctl` and the app use) and emails
it to the buyer. Standard Web APIs, so it runs on Cloudflare Workers (default
here), Deno Deploy, or Vercel/Netlify Edge.

## One-time setup

1. **Make a keypair** (if you haven't): from the repo root,
   `cargo run -p licctl -- keygen`. Bake the **public** key into
   `src-tauri/src/license.rs`; keep the **private** seed for the secret below.
2. **Install + deploy:**
   ```bash
   cd fulfillment
   npm install
   npx wrangler login
   npm run deploy            # prints your worker URL
   ```
3. **Set secrets** (never commit these):
   ```bash
   npx wrangler secret put LICENSE_PRIVATE_KEY     # the base64url seed from keygen
   npx wrangler secret put RESEND_API_KEY          # from resend.com
   npx wrangler secret put STRIPE_WEBHOOK_SECRET   # from the Stripe step below
   ```
   Set `FROM_EMAIL` and `DOWNLOAD_URL` in `wrangler.toml` (or the dashboard).
4. **Point Stripe at it:** Stripe Dashboard → Developers → Webhooks → add the
   worker URL, listening for **`checkout.session.completed`**. Copy its signing
   secret into `STRIPE_WEBHOOK_SECRET`.

That's it. On each sale the buyer gets their download link + key by email; they
paste the key into the app to activate. Failures return non-2xx so Stripe retries.

## Verify it works

```bash
npm test          # proves JS-minted keys equal `licctl sign` and pass `licctl verify`
```

Then send a Stripe **test** webhook (Dashboard → Webhooks → Send test event) and
confirm the email arrives.

## Notes

- Email goes through [Resend](https://resend.com); swap `sendEmail()` in
  `src/worker.mjs` for any provider with an HTTP API.
- Keys are verified entirely offline in the app — this service is only touched at
  purchase time. The private seed lives only as a worker secret.
