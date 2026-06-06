// License status for the desktop (Tauri) build. The web app and self-compiled
// desktop builds always report "unlocked" — gating only exists in official
// `--features licensed` builds, enforced in Rust (src-tauri/src/license.rs).

export interface LicenseStatus {
  mode: 'unlocked' | 'trial' | 'licensed' | 'expired'
  remaining: number
}

const UNLOCKED: LicenseStatus = { mode: 'unlocked', remaining: 0 }

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  if (!isTauri()) return UNLOCKED
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<LicenseStatus>('license_status')
  } catch {
    return UNLOCKED
  }
}

export async function activateLicense(key: string): Promise<LicenseStatus> {
  const { invoke } = await import('@tauri-apps/api/core')
  return await invoke<LicenseStatus>('activate', { key })
}
