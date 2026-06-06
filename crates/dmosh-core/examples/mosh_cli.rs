//! Tiny CLI over the native engine — for verification and as a seed for a future
//! standalone `dmosh` binary. Usage: mosh_cli <input> [effect] [output]
use dmosh_core::{mosh, MoshOptions};
use std::path::PathBuf;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("usage: mosh_cli <input> [effect] [output.mp4]");
        std::process::exit(2);
    }
    let input = PathBuf::from(&args[1]);
    let effect = args.get(2).cloned().unwrap_or_else(|| "bloom".to_string());
    let output = args.get(3).cloned().unwrap_or_else(|| "/tmp/dmosh_out.mp4".to_string());

    let opts = MoshOptions {
        effect,
        intensity: 0.7,
        max_dimension: 480,
        keep_audio: false,
        seed: 0x6d6f_7368,
        range: None,
        drop_i: true,
        drop_p: false,
        repeat: None,
    };

    match mosh(&[input], &opts, &|p, phase| eprintln!("{:>3.0}%  {phase}", p * 100.0)) {
        Ok(path) => {
            std::fs::copy(&path, &output).expect("copy output");
            println!("wrote {output}");
        }
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(1);
        }
    }
}
