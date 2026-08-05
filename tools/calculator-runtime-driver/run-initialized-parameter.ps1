param(
    [string]$ServerRoot = "private\runtime\palserver",
    [string]$Output = "private\verification\calculators\build-24467282\initialized-parameter-session-1.log",
    [ValidateRange(30, 900)][int]$TimeoutSeconds = 420,
    [switch]$LaunchClient,
    [string]$ClientLauncher = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$resolvedServerRoot = (Resolve-Path -LiteralPath (Join-Path $repositoryRoot $ServerRoot)).Path
$serverExe = Join-Path $resolvedServerRoot "PalServer.exe"
$ue4ssTarget = Join-Path $resolvedServerRoot "Mods\NativeMods\UE4SS"
$modSource = Join-Path $PSScriptRoot "CalculatorInitializedParameterEvidence"
$workshopRoot = Join-Path (Split-Path -Parent $resolvedServerRoot) "workshop"
$ue4ssWorkshop = Join-Path $workshopRoot "3625223587"
$targets = @(
    (Join-Path $ue4ssTarget "Mods\CalculatorInitializedParameterEvidence"),
    (Join-Path $workshopRoot "CalculatorInitializedParameterEvidence"),
    (Join-Path $ue4ssWorkshop "Mods\CalculatorInitializedParameterEvidence")
)
$logPath = Join-Path $ue4ssTarget "UE4SS.log"
$settingsPath = Join-Path $resolvedServerRoot "Mods\PalModSettings.ini"
$outputPath = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $Output))

foreach ($required in @($serverExe, (Join-Path $ue4ssTarget "UE4SS.dll"), (Join-Path $modSource "Info.json"), (Join-Path $modSource "Scripts\main.lua"))) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Required runtime input is missing: $required" }
}

function Stop-IsolatedServer {
    Get-Process -ErrorAction SilentlyContinue | Where-Object {
        try { $_.Path -and ([IO.Path]::GetFullPath($_.Path)).StartsWith($resolvedServerRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -and $_.ProcessName -like 'PalServer*' }
        catch { $false }
    } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
}

$clientStartTime = $null
function Stop-IsolatedClient {
    if (-not $clientStartTime) { return }
    $clientRoot = [IO.Path]::GetFullPath((Split-Path -Parent $ClientLauncher)).TrimEnd('\') + '\'
    Get-Process -ErrorAction SilentlyContinue | Where-Object {
        try { $_.Path -and $_.StartTime -ge $clientStartTime -and ([IO.Path]::GetFullPath($_.Path)).StartsWith($clientRoot, [StringComparison]::OrdinalIgnoreCase) }
        catch { $false }
    } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
}

foreach ($target in $targets) {
    New-Item -ItemType Directory -Path (Join-Path $target "Scripts") -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $modSource "Info.json") -Destination (Join-Path $target "Info.json") -Force
    Copy-Item -LiteralPath (Join-Path $modSource "Scripts\main.lua") -Destination (Join-Path $target "Scripts\main.lua") -Force
}
foreach ($modsPath in @((Join-Path $ue4ssTarget "Mods\mods.txt"), (Join-Path $ue4ssWorkshop "Mods\mods.txt"))) {
    $modsText = Get-Content -LiteralPath $modsPath -Raw
    foreach ($name in @("ElementDamageVerifier", "CalculatorRuntimeProbe", "CalculatorRuntimeEvidence", "CalculatorIVMatrixEvidence", "CalculatorInitializedParameterEvidence", "CalculatorCaptureEvidence")) {
        $enabled = if ($name -eq "CalculatorInitializedParameterEvidence") { 1 } else { 0 }
        $modsText = [regex]::Replace($modsText, "(?m)^$name\s*:\s*\d+\s*$", "$name : $enabled")
    }
    if ($modsText -notmatch '(?m)^CalculatorInitializedParameterEvidence\s*:\s*1\s*$') { $modsText += "`r`nCalculatorInitializedParameterEvidence : 1`r`n" }
    [IO.File]::WriteAllText($modsPath, $modsText, [Text.UTF8Encoding]::new($false))
}
$settingsText = "[PalModSettings]`r`nbGlobalEnableMod=True`r`nWorkshopRootDir=$workshopRoot`r`nConfigVersion=1.0`r`nActiveModList=UE4SSExperimentalPW`r`nActiveModList=CalculatorInitializedParameterEvidence`r`n"
[IO.File]::WriteAllText($settingsPath, $settingsText, [Text.UTF8Encoding]::new($false))
if (Test-Path -LiteralPath $logPath -PathType Leaf) { Remove-Item -LiteralPath $logPath -Force }

try {
    $launcher = Start-Process -FilePath $serverExe -ArgumentList "-port=8392 -players=1 -useperfthreads -NoAsyncLoadingThread -UseMultithreadForDS" -WorkingDirectory $resolvedServerRoot -WindowStyle Hidden -PassThru
    if ($LaunchClient) {
        if ([string]::IsNullOrWhiteSpace($ClientLauncher)) { throw "Pass -ClientLauncher with the installed Palworld launcher path when using -LaunchClient." }
        if (-not (Test-Path -LiteralPath $ClientLauncher -PathType Leaf)) { throw "Palworld client launcher is missing: $ClientLauncher" }
        Start-Sleep -Seconds 20
        $clientStartTime = Get-Date
        Start-Process -FilePath $ClientLauncher -ArgumentList "-connect=127.0.0.1:8392 -NoSplash -windowed -ResX=640 -ResY=360" -WorkingDirectory (Split-Path -Parent $ClientLauncher) -WindowStyle Hidden | Out-Null
        Write-Output "Palworld client launched. Automatic joining is not reliable; manually join 127.0.0.1:8392 and enter the loaded world."
    }
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $lines = @()
    while ([DateTime]::UtcNow -lt $deadline) {
        Start-Sleep -Milliseconds 500
        if (Test-Path -LiteralPath $logPath -PathType Leaf) {
            $lines = @(Get-Content -LiteralPath $logPath | Where-Object { $_ -match 'PAL_INITIALIZED_PARAMETER\|' })
            if ($lines -match 'PAL_INITIALIZED_PARAMETER\|complete') { break }
        }
        if ($launcher.HasExited) { throw "Dedicated server exited before initialized-parameter evidence completed." }
    }
    if (-not ($lines -match 'PAL_INITIALIZED_PARAMETER\|complete')) { throw "Initialized-parameter evidence timed out before a post-join Pal parameter was observed. If the client launched but did not join automatically, manually join 127.0.0.1:8392 and enter the loaded world, then rerun the session." }
    if (-not ($lines -match 'PAL_INITIALIZED_PARAMETER\|observed\|')) { throw "Initialized-parameter evidence completed without a valid observed parameter." }
    if ($lines -match 'PAL_INITIALIZED_PARAMETER\|error\|') { throw "Initialized-parameter evidence contains runtime inspection errors." }
    New-Item -ItemType Directory -Path (Split-Path -Parent $outputPath) -Force | Out-Null
    [IO.File]::WriteAllLines($outputPath, $lines, [Text.UTF8Encoding]::new($false))
    Write-Output "Initialized-parameter evidence captured at $outputPath"
}
finally {
    Stop-IsolatedClient
    Stop-IsolatedServer
}
