//! License gate. The model (per the Ardour reference):
//!   * Self-compiled builds (default features) are fully unlocked — no key, no
//!     trial. None of the crypto below is even compiled in.
//!   * Official builds (`--features licensed`) run a trial of `TRIAL_MOSHES`
//!     successful moshes, then require an offline Ed25519-signed key.
//!
//! Keys are verified entirely offline against a baked-in public key — no server.
use serde::Serialize;
#[cfg(not(feature = "licensed"))]
use tauri::AppHandle;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    /// "unlocked" | "trial" | "licensed" | "expired"
    pub mode: &'static str,
    /// Remaining trial moshes (only meaningful for "trial").
    pub remaining: u32,
}

#[cfg(not(feature = "licensed"))]
const UNLOCKED: Status = Status { mode: "unlocked", remaining: 0 };

#[cfg(not(feature = "licensed"))]
pub fn status(_app: &AppHandle) -> Status {
    UNLOCKED
}
#[cfg(not(feature = "licensed"))]
pub fn check(_app: &AppHandle) -> Result<(), String> {
    Ok(())
}
#[cfg(not(feature = "licensed"))]
pub fn note_use(_app: &AppHandle) {}
#[cfg(not(feature = "licensed"))]
pub fn activate(_app: &AppHandle, _key: &str) -> Result<Status, String> {
    Ok(UNLOCKED)
}

#[cfg(feature = "licensed")]
mod imp {
    use super::Status;
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD as B64, Engine};
    use ed25519_dalek::{Signature, Verifier, VerifyingKey};
    use serde::{Deserialize, Serialize};
    use std::path::{Path, PathBuf};
    use tauri::{AppHandle, Manager};

    // Replace with your real public key from `licctl keygen`. While it's the
    // placeholder, no key validates (trial still works), so this fails safe.
    const PUBLIC_KEY_B64: &str = "REPLACE_WITH_YOUR_ED25519_PUBLIC_KEY";
    const TRIAL_MOSHES: u32 = 10;

    #[derive(Serialize, Deserialize, Default)]
    #[serde(rename_all = "camelCase")]
    struct State {
        key: Option<String>,
        trial_used: u32,
    }

    fn public_key() -> Option<[u8; 32]> {
        B64.decode(PUBLIC_KEY_B64).ok()?.try_into().ok()
    }

    /// Verify a `base64url(message).base64url(signature)` key against a public key.
    pub fn verify(public: &[u8; 32], key: &str) -> bool {
        let Some((m, s)) = key.split_once('.') else { return false };
        let (Ok(msg), Ok(sig_bytes)) = (B64.decode(m), B64.decode(s)) else { return false };
        let Ok(sig_arr): Result<[u8; 64], _> = sig_bytes.try_into() else { return false };
        let Ok(vk) = VerifyingKey::from_bytes(public) else { return false };
        vk.verify(&msg, &Signature::from_bytes(&sig_arr)).is_ok()
    }

    fn load_at(path: &Path) -> State {
        std::fs::read(path)
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or_default()
    }
    fn save_at(path: &Path, st: &State) -> Result<(), String> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        std::fs::write(path, serde_json::to_vec(st).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
    }
    fn is_licensed(st: &State, pk: Option<[u8; 32]>) -> bool {
        matches!((&st.key, pk), (Some(k), Some(pk)) if verify(&pk, k))
    }
    fn status_from(st: &State, pk: Option<[u8; 32]>) -> Status {
        if is_licensed(st, pk) {
            return Status { mode: "licensed", remaining: 0 };
        }
        let remaining = TRIAL_MOSHES.saturating_sub(st.trial_used);
        if remaining > 0 {
            Status { mode: "trial", remaining }
        } else {
            Status { mode: "expired", remaining: 0 }
        }
    }

    // --- path + pubkey core (no Tauri; fully testable) ---
    pub fn status_at(path: &Path, pk: Option<[u8; 32]>) -> Status {
        status_from(&load_at(path), pk)
    }
    pub fn note_use_at(path: &Path, pk: Option<[u8; 32]>) {
        let mut st = load_at(path);
        if is_licensed(&st, pk) {
            return;
        }
        st.trial_used = st.trial_used.saturating_add(1);
        let _ = save_at(path, &st);
    }
    pub fn activate_at(path: &Path, pk: Option<[u8; 32]>, key: &str) -> Result<Status, String> {
        let pk = pk.ok_or("this build has no license public key configured")?;
        if !verify(&pk, key) {
            return Err("That license key isn't valid.".into());
        }
        let mut st = load_at(path);
        st.key = Some(key.to_string());
        save_at(path, &st)?;
        Ok(status_from(&st, Some(pk)))
    }

    // --- AppHandle wrappers (production) ---
    fn store_path(app: &AppHandle) -> Option<PathBuf> {
        let dir = app.path().app_data_dir().ok()?;
        std::fs::create_dir_all(&dir).ok()?;
        Some(dir.join("license.json"))
    }
    pub fn status(app: &AppHandle) -> Status {
        match store_path(app) {
            Some(p) => status_at(&p, public_key()),
            None => Status { mode: "trial", remaining: TRIAL_MOSHES },
        }
    }
    pub fn check(app: &AppHandle) -> Result<(), String> {
        if status(app).mode == "expired" {
            Err("Trial finished — enter a license key to keep moshing.".into())
        } else {
            Ok(())
        }
    }
    pub fn note_use(app: &AppHandle) {
        if let Some(p) = store_path(app) {
            note_use_at(&p, public_key());
        }
    }
    pub fn activate(app: &AppHandle, key: &str) -> Result<Status, String> {
        let p = store_path(app).ok_or("could not resolve the app data directory")?;
        activate_at(&p, public_key(), key)
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use ed25519_dalek::{Signer, SigningKey};
        use rand_core::{OsRng, RngCore};

        fn keypair() -> SigningKey {
            let mut seed = [0u8; 32];
            OsRng.fill_bytes(&mut seed);
            SigningKey::from_bytes(&seed)
        }
        // Mint a key byte-for-byte the way `licctl sign` does.
        fn mint(sk: &SigningKey, msg: &str) -> String {
            let sig = sk.sign(msg.as_bytes());
            format!("{}.{}", B64.encode(msg.as_bytes()), B64.encode(sig.to_bytes()))
        }
        fn tmp_store() -> PathBuf {
            let nanos = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let dir = std::env::temp_dir().join(format!("dmosh-lic-{}-{}", std::process::id(), nanos));
            std::fs::create_dir_all(&dir).unwrap();
            dir.join("license.json")
        }

        #[test]
        fn verify_accepts_minted_rejects_forgeries() {
            let sk = keypair();
            let pk = sk.verifying_key().to_bytes();
            assert!(verify(&pk, &mint(&sk, "buyer@example.com")));
            assert!(!verify(&pk, "garbage.key"));
            assert!(!verify(&keypair().verifying_key().to_bytes(), &mint(&sk, "buyer@example.com")));
        }

        #[test]
        fn full_trial_then_activate_flow() {
            let sk = keypair();
            let pk = Some(sk.verifying_key().to_bytes());
            let store = tmp_store();

            // Fresh install → full trial.
            let s = status_at(&store, pk);
            assert_eq!(s.mode, "trial");
            assert_eq!(s.remaining, TRIAL_MOSHES);

            // Burn the whole trial → expired, gate would block.
            for _ in 0..TRIAL_MOSHES {
                note_use_at(&store, pk);
            }
            assert_eq!(status_at(&store, pk).mode, "expired");

            // Activate with a key minted exactly like licctl → licensed + persists.
            let licensed = activate_at(&store, pk, &mint(&sk, "buyer@example.com")).unwrap();
            assert_eq!(licensed.mode, "licensed");
            assert_eq!(status_at(&store, pk).mode, "licensed");

            // Licensed use no longer counts against (or re-locks) the trial.
            note_use_at(&store, pk);
            assert_eq!(status_at(&store, pk).mode, "licensed");

            // A bad key is rejected and leaves the store in trial.
            let other = tmp_store();
            assert!(activate_at(&other, pk, "not-a-real-key").is_err());
            assert_eq!(status_at(&other, pk).mode, "trial");

            std::fs::remove_dir_all(store.parent().unwrap()).ok();
            std::fs::remove_dir_all(other.parent().unwrap()).ok();
        }
    }
}

#[cfg(feature = "licensed")]
pub use imp::{activate, check, note_use, status};
