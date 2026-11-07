#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri::{menu::{CheckMenuItem, Menu, MenuItem}, tray::TrayIconBuilder, Emitter};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

#[cfg(windows)]
mod vol {
    use windows::Win32::Media::Audio::{eMultimedia, eRender, Endpoints::IAudioEndpointVolume, IMMDeviceEnumerator, MMDeviceEnumerator};
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};
    fn ep() -> windows::core::Result<IAudioEndpointVolume> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let e: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
            let d = e.GetDefaultAudioEndpoint(eRender, eMultimedia)?;
            d.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None)
        }
    }
    pub fn get() -> Result<f32, String> { unsafe { ep().and_then(|v| v.GetMasterVolumeLevelScalar()).map_err(|e| e.to_string()) } }
    pub fn set(l: f32) -> Result<(), String> {
        unsafe { ep().and_then(|v| v.SetMasterVolumeLevelScalar(l.clamp(0.0, 1.0), std::ptr::null())).map_err(|e| e.to_string()) }
    }
}

#[cfg(target_os = "macos")]
mod vol {
    use std::process::Command;
    pub fn get() -> Result<f32, String> {
        let o = Command::new("osascript").args(["-e", "output volume of (get volume settings)"]).output().map_err(|e| e.to_string())?;
        String::from_utf8_lossy(&o.stdout).trim().parse::<f32>().map(|v| v / 100.0).map_err(|e| e.to_string())
    }
    pub fn set(l: f32) -> Result<(), String> {
        let n = (l.clamp(0.0, 1.0) * 100.0).round() as i32;
        Command::new("osascript").args(["-e", &format!("set volume output volume {}", n)]).status().map(|_| ()).map_err(|e| e.to_string())
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
mod vol {
    pub fn get() -> Result<f32, String> { Err("unsupported OS".into()) }
    pub fn set(_: f32) -> Result<(), String> { Err("unsupported OS".into()) }
}

#[tauri::command] fn get_volume() -> Result<f32, String> { vol::get() }
#[tauri::command] fn set_volume(level: f32) -> Result<(), String> { vol::set(level) }

/// Resize the island and keep it centred at the top of its monitor.
#[tauri::command]
fn resize_island(win: tauri::WebviewWindow, w: f64, h: f64) {
    let _ = win.set_size(tauri::LogicalSize::new(w, h));
    if let Ok(Some(m)) = win.current_monitor() {
        let s = m.scale_factor();
        let x = m.position().x as f64 / s + (m.size().width as f64 / s - w) / 2.0;
        let y = m.position().y as f64 / s;
        let _ = win.set_position(tauri::LogicalPosition::new(x, y));
    }
}

/// Only allows opening claude.ai in the default browser.
#[tauri::command]
fn open_claude() {
    let url = "https://claude.ai";
    #[cfg(windows)] { let _ = std::process::Command::new("cmd").args(["/c", "start", "", url]).spawn(); }
    #[cfg(target_os = "macos")] { let _ = std::process::Command::new("open").arg(url).spawn(); }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .invoke_handler(tauri::generate_handler![get_volume, set_volume, resize_island, open_claude])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory); // no Dock icon
            let al = app.autolaunch();
            let auto = CheckMenuItem::with_id(app, "auto", "Launch at login", true, al.is_enabled().unwrap_or(false), None::<&str>)?;
            let notch = MenuItem::with_id(app, "notch", "Notch shape", true, None::<&str>)?;
            let circle = MenuItem::with_id(app, "circle", "Circle shape", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit IslandBar", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&notch, &circle, &auto, &quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, ev| match ev.id.as_ref() {
                    "quit" => app.exit(0),
                    "auto" => {
                        let al = app.autolaunch();
                        if al.is_enabled().unwrap_or(false) { let _ = al.disable(); } else { let _ = al.enable(); }
                    }
                    id => { let _ = app.emit("shape", id); }
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running IslandBar");
}
