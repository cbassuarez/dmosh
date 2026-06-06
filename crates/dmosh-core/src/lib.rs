//! dmosh native engine — AVI frame surgery + ffmpeg orchestration. Shared by the
//! Tauri desktop app (and usable from any Rust front-end / CLI).

pub mod avi;
pub mod mosh;
pub mod ops;

pub use mosh::{mosh, MoshOptions, Progress};
