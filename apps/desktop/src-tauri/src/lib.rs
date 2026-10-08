// MadScope Tauri library entry point.
//
// The desktop app ships its render engine inside the bundle:
//   resources/engine/{node[.exe], server.cjs, node_modules/, browsers/}
// On startup the app spawns `node server.cjs` (the same @madscope/core
// engine the CLI uses), waits until http://127.0.0.1:4220 answers, then
// shows the main window. The child is killed on exit. All screenshots
// and baselines live in the app data dir (MADSCOPE_DATA_DIR).
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{Manager, RunEvent};

const ENGINE_PORT: u16 = 4220;

struct EngineState {
    child: Mutex<Option<Child>>,
}

fn engine_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().resource_dir().ok().map(|d| d.join("engine"))
}

fn node_bin(engine: &PathBuf) -> PathBuf {
    #[cfg(windows)]
    {
        engine.join("node.exe")
    }
    #[cfg(not(windows))]
    {
        engine.join("node")
    }
}

fn spawn_engine(app: &tauri::AppHandle) -> Option<Child> {
    let engine = engine_dir(app)?;
    let node = node_bin(&engine);
    let server = engine.join("server.cjs");
    if !node.exists() || !server.exists() {
        eprintln!("MadScope engine missing from bundle resources; UI will show the error state");
        return None;
    }
    let data_dir = app.path().app_data_dir().ok()?;
    std::fs::create_dir_all(&data_dir).ok()?;
    Command::new(node)
        .arg(server)
        .env("MADSCOPE_PORT", ENGINE_PORT.to_string())
        .env("MADSCOPE_DATA_DIR", &data_dir)
        .env("PLAYWRIGHT_BROWSERS_PATH", engine.join("browsers"))
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .ok()
}

/// Block until the engine answers /api/health (or timeout; the UI then
/// shows its own error state instead of hanging on a blank window).
fn wait_for_engine() {
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(120) {
        if let Ok(mut stream) = TcpStream::connect(("127.0.0.1", ENGINE_PORT)) {
            let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
            if stream.write_all(b"GET /api/health HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n").is_ok() {
                let mut buf = [0u8; 512];
                if let Ok(n) = stream.read(&mut buf) {
                    if String::from_utf8_lossy(&buf[..n]).contains("200") {
                        return;
                    }
                }
            }
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    eprintln!("MadScope engine did not become ready in time");
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let child = spawn_engine(&app.handle());
            app.manage(EngineState {
                child: Mutex::new(child),
            });
            let window = app.get_webview_window("main").expect("main window missing");
            std::thread::spawn(move || {
                wait_for_engine();
                let _ = window.show();
                let _ = window.set_focus();
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running MadScope")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(state) = app.try_state::<EngineState>() {
                    if let Ok(mut guard) = state.child.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }
                }
            }
        })
}
