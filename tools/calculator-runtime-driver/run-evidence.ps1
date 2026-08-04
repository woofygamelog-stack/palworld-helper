param(
    [string]$ServerRoot = "private\runtime\palserver",
    [string]$Output = "private\verification\calculators\build-24467282\runtime-evidence.log",
    [ValidateRange(30, 300)][int]$TimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$resolvedServerRoot = (Resolve-Path -LiteralPath (Join-Path $repositoryRoot $ServerRoot)).Path
$serverExe = Join-Path $resolvedServerRoot "PalServer.exe"
$ue4ssTarget = Join-Path $resolvedServerRoot "Mods\NativeMods\UE4SS"
$modSource = Join-Path $PSScriptRoot "CalculatorRuntimeEvidence"
$modTarget = Join-Path $ue4ssTarget "Mods\CalculatorRuntimeEvidence"
$workshopRoot = Join-Path (Split-Path -Parent $resolvedServerRoot) "workshop"
$ue4ssWorkshop = Join-Path $workshopRoot "3625223587"
$workshopModTarget = Join-Path $workshopRoot "CalculatorRuntimeEvidence"
$embeddedModTarget = Join-Path $ue4ssWorkshop "Mods\CalculatorRuntimeEvidence"
$logPath = Join-Path $ue4ssTarget "UE4SS.log"
$settingsPath = Join-Path $resolvedServerRoot "Mods\PalModSettings.ini"
$outputPath = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $Output))

foreach ($required in @($serverExe, (Join-Path $ue4ssTarget "UE4SS.dll"), (Join-Path $modSource "Info.json"), (Join-Path $modSource "Scripts\main.lua"))) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Required runtime input is missing: $required" }
}

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
foreach ($modsPath in @((Join-Path $ue4ssTarget "Mods\mods.txt"), (Join-Path $ue4ssWorkshop "Mods\mods.txt"))) {
    $modsText = Get-Content -LiteralPath $modsPath -Raw
    $modsText = [regex]::Replace($modsText, '(?m)^CalculatorRuntimeProbe\s*:\s*\d+\s*$', 'CalculatorRuntimeProbe : 0')
    $modsText = [regex]::Replace($modsText, '(?m)^CalculatorRuntimeEvidence\s*:\s*\d+\s*$', 'CalculatorRuntimeEvidence : 1')
    if ($modsText -notmatch '(?m)^CalculatorRuntimeEvidence\s*:\s*1\s*$') { $modsText += "`r`nCalculatorRuntimeEvidence : 1`r`n" }
    [IO.File]::WriteAllText($modsPath, $modsText, [Text.UTF8Encoding]::new($false))
}
$settingsText = "[PalModSettings]`r`nbGlobalEnableMod=True`r`nWorkshopRootDir=$workshopRoot`r`nConfigVersion=1.0`r`nActiveModList=UE4SSExperimentalPW`r`nActiveModList=CalculatorRuntimeEvidence`r`n"
[IO.File]::WriteAllText($settingsPath, $settingsText, [Text.UTF8Encoding]::new($false))
if (Test-Path -LiteralPath $logPath -PathType Leaf) { Remove-Item -LiteralPath $logPath -Force }

try {
    $launcher = Start-Process -FilePath $serverExe -ArgumentList "-port=8392 -players=1 -useperfthreads -NoAsyncLoadingThread -UseMultithreadForDS" -WorkingDirectory $resolvedServerRoot -WindowStyle Hidden -PassThru
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $probeLines = @()
    while ([DateTime]::UtcNow -lt $deadline) {
        Start-Sleep -Milliseconds 500
        if (Test-Path -LiteralPath $logPath -PathType Leaf) {
            $probeLines = @(Get-Content -LiteralPath $logPath | Where-Object { $_ -match 'PAL_CALCULATOR_EVIDENCE\|' })
            if ($probeLines -match 'PAL_CALCULATOR_EVIDENCE\|error\|') { throw "Calculator runtime evidence reported an error." }
            if ($probeLines -match 'PAL_CALCULATOR_EVIDENCE\|complete') { break }
        }
        if ($launcher.HasExited) { throw "Dedicated server exited before calculator evidence completed." }
    }
    if (-not ($probeLines -match 'PAL_CALCULATOR_EVIDENCE\|complete')) { throw "Calculator runtime evidence timed out." }
    New-Item -ItemType Directory -Path (Split-Path -Parent $outputPath) -Force | Out-Null
    [IO.File]::WriteAllLines($outputPath, $probeLines, [Text.UTF8Encoding]::new($false))
    Write-Output "Calculator runtime evidence captured at $outputPath"
}
finally {
    Stop-IsolatedServer
}
