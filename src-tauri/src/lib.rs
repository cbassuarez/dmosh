mod license;

use std::path::PathBuf;

use serde::Serialize;
use tauri::ipc::{Channel, Response};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Runtime};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressMsg {
    progress: f32,
    phase: String,
}

fn write_temp(dir: &std::path::Path, name: &str, bytes: &[u8]) -> Result<PathBuf, String> {
    let p = dir.join(name);
    std::fs::write(&p, bytes).map_err(|e| e.to_string())?;
    Ok(p)
}

/// Datamosh one or two clips with the native engine. Input clips are passed as
/// raw bytes (Tauri transfers ArrayBuffers efficiently); the moshed MP4 is
/// returned as bytes. Heavy work runs off the UI thread.
#[tauri::command]
async fn mosh(
    app: AppHandle,
    input_a: Vec<u8>,
    input_b: Option<Vec<u8>>,
    options: dmosh_core::MoshOptions,
    on_progress: Channel<ProgressMsg>,
) -> Result<Response, String> {
    // Gate before doing any work (no-op in self-compiled builds).
    license::check(&app)?;
    let result = tauri::async_runtime::spawn_blocking(move || -> Result<Vec<u8>, String> {
        let work = std::env::temp_dir().join(format!(
            "dmosh-job-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        std::fs::create_dir_all(&work).map_err(|e| e.to_string())?;

        let mut inputs = vec![write_temp(&work, "a.in", &input_a)?];
        if let Some(b) = input_b {
            inputs.push(write_temp(&work, "b.in", &b)?);
        }

        let progress = |p: f32, phase: &str| {
            let _ = on_progress.send(ProgressMsg { progress: p, phase: phase.to_string() });
        };
        let out = dmosh_core::mosh(&inputs, &options, &progress)?;
        let bytes = std::fs::read(&out).map_err(|e| e.to_string())?;

        // Best-effort cleanup of both the job inputs and the engine's work dir.
        let _ = std::fs::remove_dir_all(&work);
        if let Some(parent) = out.parent() {
            let _ = std::fs::remove_dir_all(parent);
        }
        Ok(bytes)
    })
    .await
    .map_err(|e| e.to_string())??;

    // Count a successful mosh against the trial (no-op in self-compiled builds).
    license::note_use(&app);
    Ok(Response::new(result))
}

/// Write the moshed bytes to a path the user chose via the native Save dialog.
#[tauri::command]
async fn write_file(path: String, data: Vec<u8>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || std::fs::write(&path, &data).map_err(|e| e.to_string()))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn license_status(app: AppHandle) -> license::Status {
    license::status(&app)
}

#[tauri::command]
fn activate(app: AppHandle, key: String) -> Result<license::Status, String> {
    license::activate(&app, &key)
}

/// Point the engine at the bundled ffmpeg sidecar (placed next to the executable
/// by Tauri's `externalBin`). An explicit `DMOSH_FFMPEG` env wins; otherwise we
/// fall through to a system `ffmpeg` on PATH (e.g. self-compiled dev runs).
fn configure_ffmpeg() {
    if std::env::var_os("DMOSH_FFMPEG").is_some() {
        return;
    }
    let name = if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" };
    if let Ok(exe) = std::env::current_exe() {
        if let Some(sidecar) = exe.parent().map(|d| d.join(name)) {
            if sidecar.exists() {
                std::env::set_var("DMOSH_FFMPEG", sidecar);
            }
        }
    }
}

/// Native app menu. Custom items emit a "menu" event the frontend acts on
/// (open/save/mosh/links); standard items (quit, copy/paste, …) are handled by
/// the OS so the license-key field and friends behave natively.
fn build_menu<R: Runtime>(handle: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let app_menu = Submenu::with_items(
        handle,
        "dmosh",
        true,
        &[
            &PredefinedMenuItem::about(handle, Some("dmosh"), None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::hide(handle, None)?,
            &PredefinedMenuItem::quit(handle, None)?,
        ],
    )?;
    let file = Submenu::with_items(
        handle,
        "File",
        true,
        &[
            &MenuItem::with_id(handle, "open", "Open Clip…", true, Some("CmdOrCtrl+O"))?,
            &MenuItem::with_id(handle, "save", "Save Result…", true, Some("CmdOrCtrl+S"))?,
            &PredefinedMenuItem::separator(handle)?,
            &MenuItem::with_id(handle, "mosh", "Mosh", true, Some("CmdOrCtrl+Enter"))?,
        ],
    )?;
    let edit = Submenu::with_items(
        handle,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(handle, None)?,
            &PredefinedMenuItem::redo(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::cut(handle, None)?,
            &PredefinedMenuItem::copy(handle, None)?,
            &PredefinedMenuItem::paste(handle, None)?,
            &PredefinedMenuItem::select_all(handle, None)?,
        ],
    )?;
    let help = Submenu::with_items(
        handle,
        "Help",
        true,
        &[
            &MenuItem::with_id(handle, "github", "dmosh on GitHub", true, None::<&str>)?,
            &MenuItem::with_id(handle, "sponsor", "Sponsor dmosh", true, None::<&str>)?,
        ],
    )?;
    Menu::with_items(handle, &[&app_menu, &file, &edit, &help])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    configure_ffmpeg();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .menu(|handle| build_menu(handle))
        .on_menu_event(|app, event| {
            let id = event.id().0.as_str();
            if matches!(id, "open" | "save" | "mosh" | "github" | "sponsor") {
                let _ = app.emit("menu", id);
            }
        })
        .invoke_handler(tauri::generate_handler![mosh, write_file, license_status, activate])
        .run(tauri::generate_context!())
        .expect("error while running dmosh");
}
