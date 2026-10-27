# Absolute HbS Explorer

Local desktop viewer for absolute hemoglobin S measurements over time. The primary view is a grid of individual patient graphs with consistent axes and highlighted rapid rises. Patients are provisionally grouped as high/low relative rise (not clinically established proliferative drive); comparison plots use individual solid colors from warm/cool palettes. The app reads `HbS_Absolute_Values.xlsx` from the adjacent `Data/` directory or a configured Documents folder on macOS.

**Research prototype only.** The displayed classification is exploratory and does not establish clinical post-RCE proliferative drive without RCE dates.

**Data safety:** This public repository must contain *source code and fictional examples only*. Never commit identifiable workbooks, deidentified research workbooks, exports, or patient mapping files. Leave the actual workbook in approved local storage and place it beside the installed app, not under source control. `Data/` and Excel files are ignored by Git.

The code and manual macOS build workflow are being prepared from the validated local v0.4 source project.
