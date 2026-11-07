#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri::{menu::{CheckMenuItem, Menu, MenuItem}, tray::TrayIconBuilder, Emitter, Manager};
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


#[derive(serde::Serialize, Default)]
struct NowPlaying { available: bool, title: String, artist: String, playing: bool, source: String }

#[cfg(windows)]
mod media {
    use super::NowPlaying;
    use windows::Media::Control::{GlobalSystemMediaTransportControlsSession as Sess, GlobalSystemMediaTransportControlsSessionManager as Mgr, GlobalSystemMediaTransportControlsSessionPlaybackStatus as PS};
    use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
    fn session() -> windows::core::Result<Option<Sess>> {
        unsafe { let _ = CoInitializeEx(None, COINIT_MULTITHREADED); }
        let m = Mgr::RequestAsync()?.get()?;
        if let Ok(list) = m.GetSessions() {
            for s in list {
                let playing = s.GetPlaybackInfo().and_then(|i| i.PlaybackStatus()).map(|st| st == PS::Playing).unwrap_or(false);
                if playing { return Ok(Some(s)); }
            }
        }
        Ok(m.GetCurrentSession().ok())
    }
    pub fn now() -> Result<NowPlaying, String> {
        let s = match session().map_err(|e| e.to_string())? { Some(s) => s, None => return Ok(NowPlaying::default()) };
        let p = s.TryGetMediaPropertiesAsync().and_then(|a| a.get()).map_err(|e| e.to_string())?;
        let playing = s.GetPlaybackInfo().and_then(|i| i.PlaybackStatus()).map(|st| st == PS::Playing).unwrap_or(false);
        Ok(NowPlaying {
            available: true,
            title: p.Title().map(|t| t.to_string()).unwrap_or_default(),
            artist: p.Artist().map(|t| t.to_string()).unwrap_or_default(),
            playing, source: "system".into(),
        })
    }
    pub fn ctl(action: &str, _source: &str) -> Result<(), String> {
        let s = session().map_err(|e| e.to_string())?.ok_or("no player")?;
        let r = match action { "toggle" => s.TryTogglePlayPauseAsync(), "next" => s.TrySkipNextAsync(), _ => s.TrySkipPreviousAsync() };
        r.and_then(|a| a.get()).map(|_| ()).map_err(|e| e.to_string())
    }
}

#[cfg(target_os = "macos")]
mod media {
    use super::NowPlaying;
    use std::process::Command;
    fn osa(script: &str) -> String {
        Command::new("osascript").args(["-e", script]).output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string()).unwrap_or_default()
    }
    use std::ffi::CStr;
    use std::os::raw::{c_char, c_int};
    extern "C" {
        fn ib_now_playing(title: *mut c_char, tl: c_int, artist: *mut c_char, al: c_int, playing: *mut c_int) -> c_int;
        fn ib_send(cmd: c_int) -> c_int;
    }
    fn system_now() -> Option<NowPlaying> {
        let mut t = [0 as c_char; 256];
        let mut a = [0 as c_char; 256];
        let mut pl: c_int = 0;
        let ok = unsafe { ib_now_playing(t.as_mut_ptr(), 256, a.as_mut_ptr(), 256, &mut pl) };
        if ok != 1 { return None; }
        let title = unsafe { CStr::from_ptr(t.as_ptr()) }.to_string_lossy().to_string();
        let artist = unsafe { CStr::from_ptr(a.as_ptr()) }.to_string_lossy().to_string();
        if title.is_empty() { return None; }
        Some(NowPlaying { available: true, title, artist, playing: pl == 1, source: "system".into() })
    }
    pub fn now() -> Result<NowPlaying, String> {
        if let Some(n) = system_now() { return Ok(n); }
        let procs = osa("tell application \"System Events\" to get name of every process");
        for app in ["Spotify", "Music"] {
            if !procs.split(", ").any(|p| p == app) { continue; }
            let script = format!("tell application \"{a}\"\nif player state is not stopped then return (player state as text) & \"|\" & (name of current track) & \"|\" & (artist of current track)\nend tell\nreturn \"\"", a = app);
            let out = osa(&script);
            let parts: Vec<&str> = out.splitn(3, '|').collect();
            if parts.len() == 3 {
                return Ok(NowPlaying { available: true, title: parts[1].into(), artist: parts[2].into(), playing: parts[0] == "playing", source: app.into() });
            }
        }
        Ok(NowPlaying::default())
    }
    pub fn ctl(action: &str, source: &str) -> Result<(), String> {
        if source == "system" {
            let cmd = match action { "toggle" => 2, "next" => 4, _ => 5 };
            return if unsafe { ib_send(cmd) } == 1 { Ok(()) } else { Err("no player".into()) };
        }
        let app = match source { "Spotify" => "Spotify", "Music" => "Music", _ => return Err("no player".into()) };
        let verb = match action { "toggle" => "playpause", "next" => "next track", _ => "previous track" };
        osa(&format!("tell application \"{}\" to {}", app, verb));
        Ok(())
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
mod media {
    use super::NowPlaying;
    pub fn now() -> Result<NowPlaying, String> { Ok(NowPlaying::default()) }
    pub fn ctl(_: &str, _: &str) -> Result<(), String> { Err("unsupported OS".into()) }
}

#[tauri::command] fn now_playing() -> Result<NowPlaying, String> { media::now() }
#[tauri::command] fn media_control(action: String, source: String) -> Result<(), String> { media::ctl(&action, &source) }

#[tauri::command] fn get_volume() -> Result<f32, String> { vol::get() }
#[tauri::command] fn set_volume(level: f32) -> Result<(), String> { vol::set(level) }

/// Resize the island and keep it centred at the top of its monitor.
static NOTCH: std::sync::OnceLock<f64> = std::sync::OnceLock::new();

#[cfg(target_os = "macos")]
extern "C" {
    fn ib_raise(w: *mut std::ffi::c_void);
    fn ib_notch_height() -> f64;
    fn ib_animate(w: *mut std::ffi::c_void, width: f64, height: f64, top: f64, dur: f64);
}

#[tauri::command]
fn resize_island(win: tauri::WebviewWindow, w: f64, h: f64) {
    let _ = win.set_size(tauri::LogicalSize::new(w, h));
    if let Ok(Some(m)) = win.current_monitor() {
        let s = m.scale_factor();
        let x = m.position().x as f64 / s + (m.size().width as f64 / s - w) / 2.0;
        let y = m.position().y as f64 / s + NOTCH.get().copied().unwrap_or(0.0);
        let _ = win.set_position(tauri::LogicalPosition::new(x, y));
    }
}

use std::sync::atomic::{AtomicU64, Ordering};
static ANIM: AtomicU64 = AtomicU64::new(0);

#[cfg(windows)]
fn win_animate(win: tauri::WebviewWindow, w: f64, h: f64, ms: u64) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{SetWindowPos, SWP_NOACTIVATE, SWP_NOZORDER};
    let id = ANIM.fetch_add(1, Ordering::SeqCst) + 1;
    let (m, from) = match (win.current_monitor(), win.outer_size()) {
        (Ok(Some(m)), Ok(s)) => (m, s),
        _ => { let _ = win.set_size(tauri::LogicalSize::new(w, h)); return; }
    };
    let hwnd = match win.hwnd() { Ok(h) => h.0 as isize, Err(_) => return };
    let sc = m.scale_factor();
    let (tw, th) = ((w * sc).round(), (h * sc).round());
    let (fw, fh) = (from.width as f64, from.height as f64);
    let (mx, my, mw) = (m.position().x as f64, m.position().y as f64, m.size().width as f64);
    std::thread::spawn(move || {
        let t0 = Instant::now();
        loop {
            if ANIM.load(Ordering::SeqCst) != id { return; }
            let p = (t0.elapsed().as_millis() as f64 / ms as f64).min(1.0);
            let e = 1.0 - (1.0 - p).powi(3);
            let (cw, ch) = (fw + (tw - fw) * e, fh + (th - fh) * e);
            let x = mx + (mw - cw) / 2.0;
            unsafe {
                let _ = SetWindowPos(HWND(hwnd as *mut std::ffi::c_void), None, x as i32, my as i32, cw as i32, ch as i32, SWP_NOZORDER | SWP_NOACTIVATE);
            }
            if p >= 1.0 { return; }
            std::thread::sleep(std::time::Duration::from_millis(8));
        }
    });
}

/// Smooth, native-side resize (one call from the UI; no per-frame messaging).
#[tauri::command]
fn animate_island(win: tauri::WebviewWindow, w: f64, h: f64, ms: u64) {
    let ms = ms.max(1);
    #[cfg(target_os = "macos")]
    { if let Ok(p) = win.ns_window() { unsafe { ib_animate(p, w, h, NOTCH.get().copied().unwrap_or(0.0), ms as f64 / 1000.0) }; } }
    #[cfg(windows)]
    { win_animate(win, w, h, ms); }
    #[cfg(not(any(windows, target_os = "macos")))]
    { let _ = ms; resize_island(win, w, h); }
}

/// Only allows opening claude.ai in the default browser.
#[tauri::command]
fn open_claude() {
    let url = "https://claude.ai";
    #[cfg(windows)] { let _ = std::process::Command::new("cmd").args(["/c", "start", "", url]).spawn(); }
    #[cfg(target_os = "macos")] { let _ = std::process::Command::new("open").arg(url).spawn(); }
}

// ---------- live activity monitor (CPU, RAM, network, battery) ----------
use std::sync::Mutex;
use std::time::Instant;
use sysinfo::{Networks, System};

struct Monitor { sys: System, nets: Networks, last: Instant }
impl Monitor {
    fn new() -> Self {
        let mut sys = System::new();
        sys.refresh_cpu_usage();
        Monitor { sys, nets: Networks::new_with_refreshed_list(), last: Instant::now() }
    }
}

#[derive(serde::Serialize)]
struct Stats { cpu: f32, mem_used: u64, mem_total: u64, down: u64, up: u64, battery: i32, charging: bool }

#[cfg(windows)]
fn power() -> (i32, bool) {
    use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
    let mut s = SYSTEM_POWER_STATUS::default();
    unsafe {
        if GetSystemPowerStatus(&mut s).is_ok() {
            let b = if s.BatteryLifePercent == 255 { -1 } else { s.BatteryLifePercent as i32 };
            return (b, s.ACLineStatus == 1);
        }
    }
    (-1, false)
}

#[cfg(target_os = "macos")]
fn power() -> (i32, bool) {
    let out = std::process::Command::new("pmset").args(["-g", "batt"]).output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string()).unwrap_or_default();
    let charging = out.contains("AC Power");
    if let Some(i) = out.find('%') {
        let digits: String = out[..i].chars().rev().take_while(|c| c.is_ascii_digit()).collect::<Vec<_>>().into_iter().rev().collect();
        if let Ok(v) = digits.parse::<i32>() { return (v, charging); }
    }
    (-1, charging)
}

#[cfg(not(any(windows, target_os = "macos")))]
fn power() -> (i32, bool) { (-1, false) }

#[tauri::command]
fn get_stats(st: tauri::State<Mutex<Monitor>>) -> Stats {
    let mut m = st.lock().unwrap();
    m.sys.refresh_cpu_usage();
    m.sys.refresh_memory();
    m.nets.refresh();
    let secs = m.last.elapsed().as_secs_f64().max(0.2);
    m.last = Instant::now();
    let (mut rx, mut tx) = (0u64, 0u64);
    for (_, d) in m.nets.iter() { rx += d.received(); tx += d.transmitted(); }
    let (battery, charging) = power();
    Stats {
        cpu: m.sys.global_cpu_usage(),
        mem_used: m.sys.used_memory(), mem_total: m.sys.total_memory(),
        down: (rx as f64 / secs) as u64, up: (tx as f64 / secs) as u64,
        battery, charging,
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .manage(Mutex::new(Monitor::new()))
        .invoke_handler(tauri::generate_handler![get_volume, set_volume, resize_island, open_claude, now_playing, media_control, get_stats, animate_island])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory); // no Dock icon
            #[cfg(target_os = "macos")]
            {
                let _ = NOTCH.set(unsafe { ib_notch_height() });
                if let Some(w) = app.get_webview_window("main") {
                    if let Ok(p) = w.ns_window() { unsafe { ib_raise(p) }; }
                }
            }
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
