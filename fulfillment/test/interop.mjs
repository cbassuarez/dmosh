// Proves the webhook's JS-minted keys are accepted by the app: a key minted by
// mintKey() must (a) equal what `licctl sign` produces (Ed25519 is deterministic)
// and (b) pass `licctl verify` against the public key. Run: npm test
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert'
import { mintKey } from '../src/license.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const cargo = (args) => execSync(`cargo run -q -p licctl -- ${args}`, { cwd: repoRoot }).toString()

// 1. Generate a keypair like the project owner would.
const keygen = cargo('keygen')
const pub = keygen.match(/public\s+\(.*?:\s*(\S+)/)[1]
const priv = keygen.match(/private\s+\(.*?:\s*(\S+)/)[1]

const buyer = 'buyer@example.com'

// 2. Mint in JS (what the webhook does).
const jsKey = mintKey(priv, buyer)

// 3. Deterministic: licctl signs the same bytes → identical key.
const rustKey = cargo(`sign ${priv} ${buyer}`).trim()
assert.strictEqual(jsKey, rustKey, 'JS-minted key must equal licctl sign output')

// 4. The app's verifier accepts it (licctl verify exits 0 on valid).
const verdict = cargo(`verify ${pub} ${jsKey}`).trim()
assert.strictEqual(verdict, 'valid', 'licctl verify must accept the JS-minted key')

// 5. A tampered key is rejected.
let rejected = false
try {
  cargo(`verify ${pub} ${jsKey.slice(0, -2)}xy`)
} catch {
  rejected = true
}
assert.ok(rejected, 'a tampered key must be rejected')

console.log('interop OK — webhook keys match licctl and validate in the app')
