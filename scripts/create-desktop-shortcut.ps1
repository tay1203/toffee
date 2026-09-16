$ErrorActionPreference = 'Stop'
$brewRoot = Split-Path -Parent $PSScriptRoot
$brewExe = Join-Path $brewRoot 'release-v0.2\Toffee-0.2.0.exe'
$brewIcon = Join-Path $brewRoot 'public\assets\app-icon.ico'
if (!(Test-Path -LiteralPath $brewExe) -or !(Test-Path -LiteralPath $brewIcon)) { throw 'Build the executable and icon first.' }
$brewShell = New-Object -ComObject WScript.Shell
$brewDesktop = [Environment]::GetFolderPath('DesktopDirectory')
if ([string]::IsNullOrWhiteSpace($brewDesktop)) { $brewDesktop = $brewShell.SpecialFolders.Item('Desktop') }
if ([string]::IsNullOrWhiteSpace($brewDesktop) -or !(Test-Path -LiteralPath $brewDesktop)) { throw 'Could not resolve your Desktop folder.' }
$brewShortcutPath = Join-Path $brewDesktop 'Toffee.lnk'
$brewStagedPath = Join-Path $PSScriptRoot 'Toffee.lnk'
if (Test-Path -LiteralPath $brewShortcutPath) {
  Copy-Item -LiteralPath $brewShortcutPath -Destination $brewStagedPath -Force
  $brewExisting = $brewShell.CreateShortcut($brewStagedPath)
  if (!$brewExisting.TargetPath.StartsWith($brewRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'An unrelated Toffee shortcut already exists; it was not changed.' }
}
$brewShortcut = $brewShell.CreateShortcut($brewStagedPath)
$brewShortcut.TargetPath = $brewExe
$brewShortcut.WorkingDirectory = Split-Path -Parent $brewExe
$brewShortcut.IconLocation = "$brewIcon,0"
$brewShortcut.Description = 'Coffee task widget'
$brewShortcut.Save()
$brewVerify = $brewShell.CreateShortcut($brewStagedPath)
if ($brewVerify.TargetPath -ne $brewExe) { throw 'Shortcut verification failed.' }
Copy-Item -LiteralPath $brewStagedPath -Destination $brewShortcutPath -Force
if ((Get-FileHash -LiteralPath $brewStagedPath).Hash -ne (Get-FileHash -LiteralPath $brewShortcutPath).Hash) { throw 'Desktop shortcut copy verification failed.' }
[pscustomobject]@{ Shortcut = $brewShortcutPath; Target = $brewVerify.TargetPath; Icon = $brewVerify.IconLocation } | ConvertTo-Json
