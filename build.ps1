$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $project '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
  $python = (Get-Command python -ErrorAction Stop).Source
}
$release = Join-Path $project 'release-journey'
$build = Join-Path $project 'build'
$specs = Join-Path $build 'specs'
New-Item -ItemType Directory -Force -Path $release,$specs | Out-Null
$roles = @(
  'NILAYA_Passenger',
  'NILAYA_Operator',
  'NILAYA_Admin',
  'NILAYA_Stop_Display',
  'NILAYA_Demo_Controller'
)
foreach ($name in $roles) {
  $roleBuild = Join-Path $build $name
  New-Item -ItemType Directory -Force -Path $roleBuild | Out-Null
  $webData = (Join-Path $project 'web') + ';web'
  $assetData = (Join-Path $project 'assets') + ';assets'
  $arguments = @(
    '-m','PyInstaller','--noconfirm','--clean','--onefile','--windowed',
    '--name',$name,
    '--distpath',$release,
    '--workpath',$roleBuild,
    '--specpath',$specs,
    '--add-data',$webData,
    '--add-data',$assetData,
    (Join-Path $project 'src\server.py')
  )
  Write-Host "Building $name.exe"
  & $python @arguments
  if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed while building $name.exe" }
}
Write-Host "Built role apps in $release"

