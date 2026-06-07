import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    env: process.env,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: options.capture ? 'utf8' : undefined,
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    const rendered = [command, ...commandArgs].join(' ')
    if (options.capture) {
      process.stdout.write(result.stdout || '')
      process.stderr.write(result.stderr || '')
    }
    throw new Error(`${rendered} exited with ${result.status}`)
  }

  return result
}

function walkFiles(dir, predicate, hits = []) {
  if (!existsSync(dir)) return hits
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      walkFiles(path, predicate, hits)
    } else if (predicate(path)) {
      hits.push(path)
    }
  }
  return hits
}

function verifyMacosBundle() {
  const app = resolve(root, 'target/release/bundle/macos/dmosh.app')
  if (!existsSync(app)) {
    throw new Error(`macOS app bundle was not produced: ${app}`)
  }

  run('codesign', ['--verify', '--deep', '--strict', '--verbose=4', app])

  const details = run('codesign', ['-dv', '--verbose=4', app], { capture: true })
  const signatureDetails = `${details.stdout || ''}${details.stderr || ''}`
  process.stderr.write(signatureDetails)

  if (signatureDetails.includes('Info.plist=not bound') || signatureDetails.includes('Sealed Resources=none')) {
    throw new Error('macOS app bundle has an incomplete signature resource seal')
  }

  const dmgs = walkFiles(resolve(root, 'target/release/bundle/dmg'), (path) => extname(path) === '.dmg')
  if (dmgs.length === 0) {
    throw new Error('macOS DMG was not produced')
  }

  for (const dmg of dmgs) {
    run('hdiutil', ['verify', dmg])
  }

  const hasAppleSigning = Boolean(process.env.APPLE_CERTIFICATE)
  const hasNotarization =
    Boolean(process.env.APPLE_API_KEY && process.env.APPLE_API_ISSUER) ||
    Boolean(process.env.APPLE_ID && process.env.APPLE_PASSWORD && process.env.APPLE_TEAM_ID)

  if (hasAppleSigning && hasNotarization) {
    run('spctl', ['-a', '-vvv', '-t', 'exec', app])
    for (const dmg of dmgs) {
      run('spctl', ['-a', '-vvv', '-t', 'install', dmg])
    }
  } else {
    console.warn('[release-check] macOS bundle is ad-hoc signed only; Gatekeeper will require Open Anyway on first launch.')
  }
}

try {
  run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tauri', ...args])
  if (process.platform === 'darwin' && args[0] === 'build') {
    verifyMacosBundle()
  }
} catch (error) {
  console.error(`[release-check] ${error.message}`)
  process.exit(1)
}
