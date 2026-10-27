# Absolute HbS Explorer

Offline research dashboard for absolute HbS time-series measurements. The target user is a PI on macOS; development can be done from Windows.

See [QUICK_START.md](QUICK_START.md) for the shortest setup, the portable Mac app layout, and GitHub build steps.

### How it works

- **High / low drive** (home view): patient ranking with exploratory cohort-relative labels, based on median positive HbS increase over 7–90-day consecutive-sample intervals across the full record (minimum 3 rising intervals); insufficient-sample patients are not classified.
- **Patient graphs**: synchronized date / g/dL axes, black line and dots with optional amber rapid-rise highlights.
- **Compare patients**: group colors (high red, low blue, insufficient gray), distinct line styles within each group. No segment-highlighting colors in this overlay.
- **Point inspection**: click a dot to view its value, timing, derived rate, source calculation and Excel sheet/row. It can open the source workbook through the native OS; automatic cell selection in Excel is not yet available.
- **Names**: the `FullName` column is displayed by default when present, with a screen-share hiding toggle. The local original workbook remains outside the source repository.
- **Automatically opens data** in the native app: looks for `Data/HbS_Absolute_Values.xlsx` beside the Mac `.app` / Windows `.exe`, and also checks `~/Documents/Absolute HbS Explorer/Data/` on Mac. Browser preview still requires manual file selection.

### Windows preview

Install Node.js LTS, then run `Start-Windows-Preview.bat`. Or use `npm install && npm test && npm run dev`. To run the native desktop application on Windows, Rust and Visual Studio C++ Build Tools are additionally needed. These are **not** necessary for the initial browser preview.

### macOS distribution

`.github/workflows/build-mac.yml` contains a **manual-only** GitHub Actions workflow that builds a universal macOS `.dmg` and a portable ZIP with `Data/` beside the `.app`. The workflow has not been executed yet; native Apple compilation and installation require verification. Ad-hoc signing is for testing only; coordinate formal code signing/notarization and institutional security approval before regular PI distribution.

### Data protection and limitations

The repository contains only fictional demonstration data. `.gitignore` excludes spreadsheet files and local Data folders. The `.xlsx` parser runs entirely on the user's computer and does not send network requests. An identifiable workbook, screenshots, and chart exports require institutional handling appropriate for protected health information. Classifications are **exploratory, not clinically validated** and are not RCE-confirmed measurements of proliferative drive. No tool here automatically confirms exchanges.

The test suite includes workbook date/column handling and cohort-relative classification. `npm test` runs the six JavaScript tests. Direct macOS file-load/build tests still need a native runner.

## Publish source from Windows

On Windows, extract the ZIP and double-click `Publish-To-GitHub.bat`. Requires Git for Windows and access to the existing public repository. The helper uses a strict allowlist, copying only application source and the explicitly fictional test workbook. It leaves `Data/` and real workbooks outside version control. After publishing, go to the repository Actions tab to run the manual macOS build.
