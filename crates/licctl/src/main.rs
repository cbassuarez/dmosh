//! Offline license tooling for dmosh.
//!
//!   licctl keygen                         → prints a keypair (bake the public
//!                                           key into src-tauri, keep the private)
//!   licctl sign <private_b64> <message>   → prints a license key for a buyer
//!                                           (message is e.g. their email)
//!
//! Keys are `base64url(message).base64url(ed25519_signature)` — verified offline
//! in the app against the baked public key. No server, no phone-home.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD as B64, Engine};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("keygen") => {
            let sk = SigningKey::generate(&mut rand_core::OsRng);
            println!("public  (bake into src-tauri/src/license.rs): {}", B64.encode(sk.verifying_key().to_bytes()));
            println!("private (keep secret, never ship):            {}", B64.encode(sk.to_bytes()));
        }
        Some("sign") => {
            let (Some(priv_b64), Some(message)) = (args.get(2), args.get(3)) else {
                eprintln!("usage: licctl sign <private_b64> <message>");
                std::process::exit(2);
            };
            let bytes = B64.decode(priv_b64).expect("invalid base64 private key");
            let arr: [u8; 32] = bytes.try_into().expect("private key must be 32 bytes");
            let sk = SigningKey::from_bytes(&arr);
            let sig = sk.sign(message.as_bytes());
            println!("{}.{}", B64.encode(message.as_bytes()), B64.encode(sig.to_bytes()));
        }
        Some("verify") => {
            let (Some(pub_b64), Some(key)) = (args.get(2), args.get(3)) else {
                eprintln!("usage: licctl verify <public_b64> <key>");
                std::process::exit(2);
            };
            let pk: [u8; 32] = B64
                .decode(pub_b64)
                .expect("invalid base64 public key")
                .try_into()
                .expect("public key must be 32 bytes");
            let vk = VerifyingKey::from_bytes(&pk).expect("invalid public key");
            let ok = key.split_once('.').is_some_and(|(m, s)| {
                let (Ok(msg), Ok(sig_bytes)) = (B64.decode(m), B64.decode(s)) else { return false };
                let Ok(sig_arr): Result<[u8; 64], _> = sig_bytes.try_into() else { return false };
                vk.verify(&msg, &Signature::from_bytes(&sig_arr)).is_ok()
            });
            if ok {
                println!("valid");
            } else {
                eprintln!("INVALID");
                std::process::exit(1);
            }
        }
        _ => {
            eprintln!("usage: licctl keygen | licctl sign <private_b64> <message> | licctl verify <public_b64> <key>");
            std::process::exit(2);
        }
    }
}
