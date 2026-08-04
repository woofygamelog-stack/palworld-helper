param(
    [string]$ServerRoot = "private\runtime\palserver",
    [string]$Ue4ssPackageRoot = $env:PALWORLD_UE4SS_PACKAGE_ROOT,
    [string]$Output = "private\verification\calculators\build-24467282\runtime-inventory.log",
    [ValidateRange(30, 300)][int]$TimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Ue4ssPackageRoot)) {
    throw "Pass -Ue4ssPackageRoot or set PALWORLD_UE4SS_PACKAGE_ROOT."
}

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$resolvedServerRoot = (Resolve-Path -LiteralPath (Join-Path $repositoryRoot $ServerRoot)).Path
$resolvedUe4ssRoot = (Resolve-Path -LiteralPath $Ue4ssPackageRoot).Path
$serverExe = Join-Path $resolvedServerRoot "PalServer.exe"
$ue4ssTarget = Join-Path $resolvedServerRoot "Mods\NativeMods\UE4SS"
$modSource = Join-Path $PSScriptRoot "CalculatorRuntimeProbe"
$modTarget = Join-Path $ue4ssTarget "Mods\CalculatorRuntimeProbe"
$workshopRoot = Join-Path (Split-Path -Parent $resolvedServerRoot) "workshop"
$ue4ssWorkshop = Join-Path $workshopRoot "3625223587"
$workshopModTarget = Join-Path $workshopRoot "CalculatorRuntimeProbe"
$embeddedModTarget = Join-Path $ue4ssWorkshop "Mods\CalculatorRuntimeProbe"
$logPath = Join-Path $ue4ssTarget "UE4SS.log"
$settingsPath = Join-Path $resolvedServerRoot "Mods\PalModSettings.ini"
$outputPath = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $Output))

foreach ($required in @($serverExe, (Join-Path $resolvedUe4ssRoot "UE4SS.dll"), (Join-Path $modSource "Info.json"), (Join-Path $modSource "Scripts\main.lua"))) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Required runtime input is missing: $required" }
}
if (-not $ue4ssTarget.StartsWith($resolvedServerRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe UE4SS target path." }

function Stop-IsolatedServer {
    $candidates = Get-Process -ErrorAction SilentlyContinue | Where-Object {
        try { $_.Path -and ([IO.Path]::GetFullPath($_.Path)).StartsWith($resolvedServerRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -and $_.ProcessName -like 'PalServer*' }
        catch { $false }
    }
    foreach ($candidate in $candidates) { Stop-Process -Id $candidate.Id -Force -ErrorAction SilentlyContinue }
}

foreach ($target in @($modTarget, $workshopModTarget, $embeddedModTarget)) {
    New-Item -ItemType Directory -Path (Join-Path $target "Scripts") -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $modSource "Info.json") -Destination (Join-Path $target "Info.json") -Force
    Copy-Item -LiteralPath (Join-Path $modSource "Scripts\main.lua") -Destination (Join-Path $target "Scripts\main.lua") -Force
}
$modsPath = Join-Path $ue4ssTarget "Mods\mods.txt"
$modsText = Get-Content -LiteralPath $modsPath -Raw
$modsText = [regex]::Replace($modsText, '(?m)^CalculatorRuntimeEvidence\s*:\s*\d+\s*$', 'CalculatorRuntimeEvidence : 0')
$modsText = [regex]::Replace($modsText, '(?m)^CalculatorRuntimeProbe\s*:\s*\d+\s*$', 'CalculatorRuntimeProbe : 1')
if ($modsText -notmatch '(?m)^CalculatorRuntimeProbe\s*:\s*1\s*$') { $modsText += "`r`nCalculatorRuntimeProbe : 1`r`n" }
[IO.File]::WriteAllText($modsPath, $modsText, [Text.UTF8Encoding]::new($false))
$workshopModsPath = Join-Path $ue4ssWorkshop "Mods\mods.txt"
$workshopModsText = Get-Content -LiteralPath $workshopModsPath -Raw
$workshopModsText = [regex]::Replace($workshopModsText, '(?m)^CalculatorRuntimeEvidence\s*:\s*\d+\s*$', 'CalculatorRuntimeEvidence : 0')
$workshopModsText = [regex]::Replace($workshopModsText, '(?m)^CalculatorRuntimeProbe\s*:\s*\d+\s*$', 'CalculatorRuntimeProbe : 1')
if ($workshopModsText -notmatch '(?m)^CalculatorRuntimeProbe\s*:\s*1\s*$') { $workshopModsText += "`r`nCalculatorRuntimeProbe : 1`r`n" }
[IO.File]::WriteAllText($workshopModsPath, $workshopModsText, [Text.UTF8Encoding]::new($false))
$settingsText = "[PalModSettings]`r`nbGlobalEnableMod=True`r`nWorkshopRootDir=$workshopRoot`r`nConfigVersion=1.0`r`nActiveModList=UE4SSExperimentalPW`r`nActiveModList=CalculatorRuntimeProbe`r`n"
[IO.File]::WriteAllText($settingsPath, $settingsText, [Text.UTF8Encoding]::new($false))
if (Test-Path -LiteralPath $logPath -PathType Leaf) { Remove-Item -LiteralPath $logPath -Force }

$launcher = $null
try {
    $launcher = Start-Process -FilePath $serverExe -ArgumentList "-port=8391 -players=1 -useperfthreads -NoAsyncLoadingThread -UseMultithreadForDS" -WorkingDirectory $resolvedServerRoot -WindowStyle Hidden -PassThru
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $probeLines = @()
    while ([DateTime]::UtcNow -lt $deadline) {
        Start-Sleep -Milliseconds 500
        if (Test-Path -LiteralPath $logPath -PathType Leaf) {
            $probeLines = @(Get-Content -LiteralPath $logPath | Where-Object { $_ -match 'PAL_CALCULATOR_PROBE\|' })
            if ($probeLines -match 'PAL_CALCULATOR_PROBE\|error\|') { throw "Calculator runtime probe reported an error." }
            if ($probeLines -match 'PAL_CALCULATOR_PROBE\|complete\|') { break }
        }
        if ($launcher.HasExited) { throw "Dedicated server exited before the calculator runtime probe completed." }
    }
    if (-not ($probeLines -match 'PAL_CALCULATOR_PROBE\|complete\|')) { throw "Calculator runtime probe timed out." }
    New-Item -ItemType Directory -Path (Split-Path -Parent $outputPath) -Force | Out-Null
    [IO.File]::WriteAllLines($outputPath, $probeLines, [Text.UTF8Encoding]::new($false))
    Write-Output "Calculator runtime inventory captured at $outputPath"
}
finally {
    Stop-IsolatedServer
}
