# Absolute HbS Explorer

Local desktop application for exploring absolute hemoglobin S measurements over time. Designed for a PI who needs to identify patients with faster observed HbS increases.

## What it does

- **Opens on Patient graphs:** individual black curves with highlighted steep HbS rises and a consistent time and HbS scale.
- **Compare patients:** solid, individually colored curves; warmer colors for higher relative rise rates, cooler colors for lower rates.
- **High / low drive:** exploratory cohort-relative labels based on the median *positive* HbS rise (g/dL per 30 days) between samples 7–90 days apart. At least three eligible intervals are required; otherwise the patient is labeled **Insufficient data**.
- **Click any point:** inspect its value, timestamp, calculated rise rate, and original Excel sheet/row.
- **Patient names by default** when the workbook includes `FullName`, with a hide-names option.
- **Automatic Excel loading** in the desktop app from `Data/HbS_Absolute_Values.xlsx` beside the app or `~/Documents/Absolute HbS Explorer/Data/` on macOS. Manual file selection remains available.

**Research prototype:** “High drive” and “Low drive” mean higher/lower *observed HbS rise* within this cohort. They are not clinically validated labels of post-RCE proliferative drive; confirmed RCE dates are not available.

## Run the interface on Windows

Install Node.js LTS, then double-click `Start-Windows-Preview.bat`. Alternatively:

```sh
npm install
npm test
npm run dev
```

The browser preview uses fictional demo data until you select an Excel workbook. Testing the native Windows desktop app additionally requires Rust and the Windows C++ build tools.

## Create the macOS app without developing on a Mac

Open **Actions → Build macOS installer (manual) → Run workflow** in this repository. When the build succeeds, download the workflow artifact containing a macOS `.dmg` and portable `.app` ZIP. The workflow runs only when requested.

For a portable installation, extract the Mac ZIP and place your private workbook here on an approved device:

```text
Absolute HbS Explorer/
├── Absolute HbS Explorer.app
└── Data/
    └── HbS_Absolute_Values.xlsx
```

Then open the app. The workbook is **never** packaged into the application or GitHub artifacts.

The macOS build has not yet been verified. It is ad-hoc signed for testing; macOS Gatekeeper or institutional IT policy may prevent opening an unnotarized app. Regular distribution may require Apple signing/notarization and IT approval.

More details: [QUICK_START.md](QUICK_START.md).

## Data protection

This public repository contains application source and *fictional test data only*. Never commit identifiable or deidentified patient spreadsheets, identifier mapping files, or chart exports. Keep your original workbook in institution-approved local or controlled storage. The application reads workbooks locally; it is not a clinical decision tool.
