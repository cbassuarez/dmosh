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
use ed25519_dalek::{Signer, SigningKey};

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
        _ => {
            eprintln!("usage: licctl keygen | licctl sign <private_b64> <message>");
            std::process::exit(2);
        }
    }
}
