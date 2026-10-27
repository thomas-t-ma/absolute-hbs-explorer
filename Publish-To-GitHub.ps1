$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$repo = 'https://github.com/thomas-t-ma/absolute-hbs-explorer.git'
$target = Join-Path $env:TEMP 'absolute-hbs-explorer-publish'
if (Test-Path $target) {
    throw "Temporary folder $target already exists. Delete it after saving anything needed and retry."
}
try {
    & git clone $repo $target
    if ($LASTEXITCODE -ne 0) { throw 'Git clone failed. Log in with GitHub Desktop / Git Credential Manager, then retry.' }
    # Explicit allowlist. Never copy Data/, any Excel workbooks, local exports, or patient files.
    $files = @('app.js','index.html','styles.css','vite.config.js','package.json','README.md','QUICK_START.md',
        'Start-Windows-Preview.bat','Run-Windows-Dev.bat','Publish-To-GitHub.bat','Publish-To-GitHub.ps1',
        'public/data.js','public/drive.js','public/workbook.js','public/plotly.min.js',
        'src-tauri/build.rs','src-tauri/Cargo.toml','src-tauri/tauri.conf.json',
        'src-tauri/src/lib.rs','src-tauri/src/main.rs','src-tauri/capabilities/default.json',
        'src-tauri/icons/icon.ico','src-tauri/icons/icon.icns','src-tauri/icons/icon.png',
        'src-tauri/icons/128x128.png','src-tauri/icons/32x32.png',
        'tests/drive.test.js','tests/import.test.js','tests/view.test.js','tests/synthetic_named.xlsx')
    foreach ($file in $files) {
        $from = Join-Path $src $file
        if (-not (Test-Path $from)) { throw "Expected project file missing: $file" }
        $to = Join-Path $target $file
        New-Item -ItemType Directory -Force -Path (Split-Path $to) | Out-Null
        Copy-Item -LiteralPath $from -Destination $to -Force
    }
    Push-Location $target
    try {
        & git add -- .
        if ($LASTEXITCODE -ne 0) { throw 'git add failed' }
        $staged = @(& git diff --cached --name-only)
        $bad = @($staged | Where-Object { ($_ -match '(?i)\.(xlsx|xls|xlsm|csv)$' -and $_ -ne 'tests/synthetic_named.xlsx') -or $_ -match '(^|/)(Data|private|exports)/' })
        if ($bad.Count -gt 0) { throw "Unsafe staged files detected: $($bad -join ', ')" }
        Write-Host 'Files ready to publish (fictional demo only):'
        $staged | ForEach-Object { Write-Host "  $_" }
        if ($staged.Count -eq 0) { Write-Host 'Everything is already up to date.'; return }
        & git commit -m 'Add Absolute HbS Explorer v0.4 application source'
        if ($LASTEXITCODE -ne 0) { throw 'Git commit failed. Configure your Git username and email.' }
        & git push origin main
        if ($LASTEXITCODE -ne 0) { throw 'Git push failed. Review repository access and retry.' }
        Write-Host 'Published: https://github.com/thomas-t-ma/absolute-hbs-explorer'
    } finally { Pop-Location }
} finally {
    Write-Host "Temporary clone retained at $target for inspection."
}
