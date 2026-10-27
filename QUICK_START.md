# Absolute HbS Explorer — simple Windows-first setup

## Test the interface on Windows (Node.js only)

1. Install Node.js LTS once: https://nodejs.org/en/download
2. Extract this source ZIP into a local project folder.
3. Double-click `Start-Windows-Preview.bat` (or run `npm install`, `npm test`, `npm run dev` in Command Prompt).
4. The preview opens in a browser with clearly marked *fictional demo data*.
5. Click **Change workbook** and select a local `.xlsx` to verify import and the names display. In browser preview, automatic folder access and **Open source in Excel** are unavailable due to browser security restrictions.

You don't need Rust, C++ Build Tools, or macOS to preview and edit the charts on Windows.

## For the final Mac application: ZERO file selection required

Download the **portable Mac ZIP** built by the GitHub Actions workflow. Extract it; the intended structure is:

```text
Absolute HbS Explorer/
  Absolute HbS Explorer.app
  Data/
    HbS_Absolute_Values.xlsx      <-- You place the private file here
```

When you double-click the Mac app, it looks in `Data/` **beside the `.app`** first. Names from `FullName` are displayed automatically. If the app lives in `/Applications`, another fixed supported path is:

```text
~/Documents/Absolute HbS Explorer/Data/HbS_Absolute_Values.xlsx
```

The application also checks directly beside the app, and in that Documents folder itself. **The `.xlsx` is never bundled with the application or uploaded to GitHub.** If no workbook is found, it displays fictional demo data clearly labeled *DEMO* and offers **Change workbook…** as a fallback.

For native Windows testing, the same `Data/` convention works beside `Absolute HbS Explorer.exe` or (when using `tauri dev`) in your source project directory. Because the browser preview cannot read arbitrary nearby files, its data must be selected manually.

## Build on GitHub instead of a Mac

1. Use the existing `thomas-t-ma/absolute-hbs-explorer` repository. It is public, so **never** upload `.xlsx`, exports, patient names, or mapping files.
2. The source and `.github/workflows/build-mac.yml` have already been committed.
3. Go to **Actions → Build macOS installer (manual) → Run workflow**.
4. After the run succeeds, download the artifact. It includes a standard `.dmg` and a **portable Mac ZIP** with the `Data/` folder ready for the private spreadsheet.
5. On the Mac, extract the ZIP, place the approved workbook in `Data/`, and double-click the `.app`. This is an *ad-hoc signed, unnotarized test build*; managed Macs might block it, and IT approval or proper notarization is needed for routine distribution.

The workflow is **manually triggered only** to conserve GitHub Actions minutes. The installer has not yet been built or tested on a Mac.

## Labels and graph behavior

The opening screen shows individual patient graphs, with black curves and amber highlights for steep rises. Patient comparison curves use distinct **solid colors**. **High drive** means at or above the *median patient rate among sufficiently sampled patients* in the loaded workbook; **Low drive** means below it. Fewer than three eligible increases → **Insufficient data**. These labels are exploratory and cannot prove proliferative drive after RCE because RCE dates are not available.

Individual graphs: black curves/dots, amber highlights for rapid rises, identical axes. Comparison: red for high group, blue for low group, gray for insufficient, different solid line shades per patient within each group. Click any dot for its exact Excel row, date, and calculation. Source CSV export includes **deidentified IDs only**, even when names are displayed.

Keep real patient data on institution-approved, access-controlled storage. Do not put real `.xlsx` workbooks in the GitHub repository, an Actions artifact, or an unapproved cloud-synced folder.

### Repository status

The source is already published in the public GitHub repository. There is no need to run `Publish-To-GitHub.bat` again. To test a new Mac build, use the repository's manual GitHub Actions workflow. Do not commit patient data.
