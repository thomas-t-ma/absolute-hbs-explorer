use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri_plugin_dialog::DialogExt;

const MAX_WORKBOOK_BYTES: u64 = 60 * 1024 * 1024;

#[derive(Serialize)]
struct PickedWorkbook {
    name: String,
    path: String,
    contents: String,
}

fn valid_workbook(path: &PathBuf) -> Result<(), String> {
    if !path.is_file() || !path.extension().is_some_and(|x| x.eq_ignore_ascii_case("xlsx")) {
        return Err("Select an existing .xlsx workbook.".to_string());
    }
    Ok(())
}

// Only explicitly named files in fixed, local folders are opened automatically.
// Never include identified data in the application bundle or version control.
const DEFAULT_WORKBOOK: &str = "HbS_Absolute_Values.xlsx";

fn read_workbook(path: &Path) -> Result<PickedWorkbook, String> {
    let path = path.to_path_buf();
    valid_workbook(&path)?;
    let size = std::fs::metadata(&path).map_err(|e| e.to_string())?.len();
    if size > MAX_WORKBOOK_BYTES {
        return Err("The workbook exceeds 60 MB.".into());
    }
    let contents = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(PickedWorkbook {
        name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
        path: path.to_string_lossy().to_string(),
        contents: STANDARD.encode(contents),
    })
}

fn data_locations(executable: &Path, home: Option<&Path>) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    // Windows: .../Absolute HbS Explorer.exe -> containing directory
    // macOS: .../Absolute HbS Explorer.app/Contents/MacOS/executable
    //         -> directory CONTAINING the .app, not inside the bundle
    #[cfg(target_os = "macos")]
    if let Some(app_folder) = executable.ancestors().nth(4) {
        dirs.push(app_folder.to_path_buf());
    }
    #[cfg(not(target_os = "macos"))]
    if let Some(dir) = executable.parent() {
        dirs.push(dir.to_path_buf());
    }
    // A stable location for Macs with the application in /Applications.
    if let Some(home) = home {
        dirs.push(home.join("Documents").join("Absolute HbS Explorer"));
    }
    // When running `tauri dev`, allow Data/ beside the project source.
    #[cfg(debug_assertions)]
    if let Ok(dev_dir) = std::env::current_dir() {
        dirs.push(dev_dir);
    }
    let mut paths = Vec::new();
    for dir in dirs {
        for path in [dir.join("Data").join(DEFAULT_WORKBOOK), dir.join(DEFAULT_WORKBOOK)] {
            if !paths.contains(&path) {
                paths.push(path);
            }
        }
    }
    paths
}

#[tauri::command]
fn load_default_workbook() -> Result<Option<PickedWorkbook>, String> {
    let executable = std::env::current_exe().map_err(|e| e.to_string())?;
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from);
    for path in data_locations(&executable, home.as_deref()) {
        if path.is_file() {
            return read_workbook(&path).map(Some);
        }
    }
    Ok(None)
}

#[tauri::command]
fn pick_and_read_workbook(app: tauri::AppHandle) -> Result<Option<PickedWorkbook>, String> {
    let chosen = app
        .dialog()
        .file()
        .add_filter("Excel workbooks", &["xlsx"])
        .blocking_pick_file();
    let Some(chosen) = chosen else { return Ok(None); };
    let path = chosen.into_path().map_err(|e| e.to_string())?;
    read_workbook(&path).map(Some)
}

#[tauri::command]
fn open_workbook(path: String) -> Result<(), String> {
    let file = PathBuf::from(path);
    valid_workbook(&file)?;
    open::that(&file).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![load_default_workbook, pick_and_read_workbook, open_workbook])
        .run(tauri::generate_context!())
        .expect("Could not launch Absolute HbS Explorer");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn known_folders_only() {
        let root = PathBuf::from("/Users/example/HbS Explorer/Absolute HbS Explorer.app/Contents/MacOS/explorer");
        let home = PathBuf::from("/Users/example");
        let paths = data_locations(&root, Some(&home));
        assert!(paths.contains(&home.join("Documents/Absolute HbS Explorer/Data/HbS_Absolute_Values.xlsx")));
        assert!(paths.iter().all(|p| p.file_name().and_then(|v| v.to_str()) == Some(DEFAULT_WORKBOOK)));
    }
}
