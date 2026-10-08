// MadScope Tauri library entry point.
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running MadScope");
}
