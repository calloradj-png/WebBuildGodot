# PowerShell script to compile Godot 2D Minimal Web Template locally
# Prerequisites: Git, Python 3.10+, SCons, and Emscripten SDK (emsdk).

param (
    [string]$GodotVersion = "4.7.2-stable",
    [string]$SourceDir = "godot-source",
    [int]$Jobs = [System.Environment]::ProcessorCount
)

$ErrorActionPreference = "Stop"

Write-Host "=== Godot 2D Minimal Web Template Compiler ===" -ForegroundColor Cyan

# 1. Check Emscripten
$emcc = Get-Command emcc -ErrorAction SilentlyContinue
if (-not $emcc) {
    Write-Host "[!] 'emcc' was not found in PATH." -ForegroundColor Yellow
    Write-Host "Please ensure Emscripten SDK is installed and activated." -ForegroundColor Yellow
    Write-Host "Example:" -ForegroundColor Gray
    Write-Host "  git clone https://github.com/emscripten-core/emsdk.git" -ForegroundColor Gray
    Write-Host "  cd emsdk; .\emsdk install latest; .\emsdk activate latest" -ForegroundColor Gray
    Write-Host "  .\emsdk_env.ps1" -ForegroundColor Gray
    exit 1
}

# 2. Check SCons
$scons = Get-Command scons -ErrorAction SilentlyContinue
if (-not $scons) {
    Write-Host "[*] Installing SCons..." -ForegroundColor Cyan
    python -m pip install scons
}

# 3. Clone source if not present
if (-not (Test-Path $SourceDir)) {
    Write-Host "[*] Cloning Godot Engine ($GodotVersion)..." -ForegroundColor Cyan
    git clone --depth 1 --branch $GodotVersion https://github.com/godotengine/godot.git $SourceDir
}

# 4. Copy custom.py
$customPyPath = Join-Path $PSScriptRoot "custom.py"
$targetCustomPy = Join-Path (Resolve-Path $SourceDir) "custom.py"
Write-Host "[*] Copying custom.py configuration..." -ForegroundColor Cyan
Copy-Item $customPyPath $targetCustomPy -Force

# 5. Build
Write-Host "[*] Compiling Web template with $Jobs threads..." -ForegroundColor Cyan
Push-Location $SourceDir
try {
    scons profile=custom.py -j$Jobs
    
    # 6. Locate and package output
    $outDir = Join-Path $PSScriptRoot "..\bin"
    if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
    
    $wasmZip = Get-ChildItem -Path "bin" -Filter "*template_release*zip" | Select-Object -First 1
    if ($wasmZip) {
        $destFile = Join-Path $outDir "web_nothreads_release.zip"
        Copy-Item $wasmZip.FullName $destFile -Force
        Write-Host "`n[SUCCESS] Minimal Web Template built successfully!" -ForegroundColor Green
        Write-Host "Output: $destFile" -ForegroundColor Green
    } else {
        Write-Host "`n[!] Compilation finished, but zip artifact was not found in bin/" -ForegroundColor Yellow
    }
}
finally {
    Pop-Location
}
