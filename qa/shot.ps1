param(
  [string]$Out = 'qa/feed.png',
  [int]$Width = 1400,
  [int]$Height = 1000,
  [switch]$Full,
  [string]$Action = ''
)

$ErrorActionPreference = 'Stop'
$edge = Join-Path $env:LOCALAPPDATA 'ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe'
if (-not (Test-Path $edge)) { $edge = Join-Path $env:LOCALAPPDATA 'ms-playwright\chromium-1228\chrome-win64\chrome.exe' }
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe' }
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }
if (-not (Test-Path $edge)) { throw 'Navegador Chromium nao encontrado.' }

$profile = Join-Path $env:TEMP ('vibra-edge-' + [guid]::NewGuid().ToString('N'))
$port = 9333 + (Get-Random -Maximum 200)
$env:QA_CDP_PORT = "$port"
New-Item -ItemType Directory -Force -Path (Split-Path $Out) | Out-Null

$arguments = @(
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--disable-extensions',
  '--disable-component-extensions-with-background-pages',
  '--no-first-run',
  '--no-default-browser-check',
  "--user-data-dir=$profile",
  "--remote-debugging-port=$port",
  'about:blank'
)
$process = Start-Process -FilePath $edge -ArgumentList $arguments -PassThru

$ready = $false
for ($i = 0; $i -lt 80; $i++) {
  try {
    Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/version" -TimeoutSec 1 | Out-Null
    $ready = $true
    break
  } catch {
    Start-Sleep -Milliseconds 250
  }
}
if (-not $ready) { throw 'Edge headless nao iniciou a tempo.' }

try {
  $env:QA_ACTION = $Action
  $sizeArg = if ($Full) { 'full' } else { 'viewport' }
  node qa/capture.mjs $Out $Width $Height $sizeArg
} finally {
  $ErrorActionPreference = 'Continue'
  try { taskkill /PID $process.Id /T /F 2>$null | Out-Null } catch {}
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*$profile*" } |
    ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
  Start-Sleep -Milliseconds 400
  Remove-Item -LiteralPath $profile -Recurse -Force -ErrorAction SilentlyContinue
}
