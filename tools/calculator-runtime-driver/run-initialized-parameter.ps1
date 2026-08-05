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
$palsPath = Join-Path $repositoryRoot "public\data\pals.json"

foreach ($required in @($serverExe, (Join-Path $ue4ssTarget "UE4SS.dll"), (Join-Path $modSource "Info.json"), (Join-Path $modSource "Scripts\main.lua"), $palsPath)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Required runtime input is missing: $required" }
}

$palsJson = Get-Content -LiteralPath $palsPath -Raw
$palIdMatches = [regex]::Matches($palsJson, '\{"i":\d+,"id":"([A-Za-z0-9_]+)"')
$palIds = @($palIdMatches | ForEach-Object { $_.Groups[1].Value })
if ($palIds.Count -ne 299) { throw "Expected 299 current Pal records, found $($palIds.Count)." }
if (@($palIds | Sort-Object -Unique).Count -ne $palIds.Count) { throw "The current Pal catalog contains duplicate IDs." }
$luaTemplatePath = Join-Path $modSource "Scripts\main.lua"
$luaTemplate = Get-Content -LiteralPath $luaTemplatePath -Raw
if ([regex]::Matches($luaTemplate, '__PAL_IDS__').Count -ne 1) { throw "The initialized-parameter Lua template must contain exactly one __PAL_IDS__ token." }
$quotedPalIds = @($palIds | ForEach-Object { '"' + $_ + '"' }) -join ', '
$generatedLua = $luaTemplate.Replace('__PAL_IDS__', $quotedPalIds)

function Stop-IsolatedServer {
    Get-Process -ErrorAction SilentlyContinue | Where-Object {
        try { $_.Path -and ([IO.Path]::GetFullPath($_.Path)).StartsWith($resolvedServerRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -and $_.ProcessName -like 'PalServer*' }
        catch { $false }
    } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
}

$clientProcess = $null
function Stop-IsolatedClient {
    if (-not $clientProcess) { return }
    $candidate = Get-Process -Id $clientProcess.Id -ErrorAction SilentlyContinue
    if (-not $candidate) { return }
    try {
        $expectedPath = [IO.Path]::GetFullPath($ClientLauncher)
        $actualPath = [IO.Path]::GetFullPath($candidate.Path)
        if ($actualPath.Equals($expectedPath, [StringComparison]::OrdinalIgnoreCase)) {
            Stop-Process -Id $candidate.Id -Force -ErrorAction SilentlyContinue
        }
    } catch { }
}

foreach ($target in $targets) {
    New-Item -ItemType Directory -Path (Join-Path $target "Scripts") -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $modSource "Info.json") -Destination (Join-Path $target "Info.json") -Force
    [IO.File]::WriteAllText((Join-Path $target "Scripts\main.lua"), $generatedLua, [Text.UTF8Encoding]::new($false))
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
        $clientProcess = Start-Process -FilePath $ClientLauncher -ArgumentList "-NoSplash -windowed -ResX=960 -ResY=540" -WorkingDirectory (Split-Path -Parent $ClientLauncher) -PassThru
        Start-Sleep -Seconds 15
        $clientRoot = [IO.Path]::GetFullPath((Split-Path -Parent $ClientLauncher)).TrimEnd('\') + '\'
        $activeClient = Get-Process -ErrorAction SilentlyContinue | Where-Object {
            try { $_.Path -and $_.StartTime -ge $clientStartTime -and ([IO.Path]::GetFullPath($_.Path)).StartsWith($clientRoot, [StringComparison]::OrdinalIgnoreCase) }
            catch { $false }
        } | Select-Object -First 1
        if ($activeClient) {
            Write-Output "Palworld client process is active. Manually join 127.0.0.1:8392 and enter the loaded world; no automatic connection was requested."
        } else {
            Write-Output "Automatic client startup did not remain active. Open Palworld manually from Steam, then join 127.0.0.1:8392 and enter the loaded world; the evidence watcher is still running."
        }
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
    if (-not ($lines -match 'PAL_INITIALIZED_PARAMETER\|species-complete\|299\|11')) { throw "Initialized-parameter evidence completed without the expected 299 Pal by 11 friendship-rank matrix." }
    if (-not ($lines -match 'PAL_INITIALIZED_PARAMETER\|grid-complete\|Alpaca\|10500')) { throw "Initialized-parameter evidence completed without the expected 10,500-case IV interaction grid." }
    if ($lines -match 'PAL_INITIALIZED_PARAMETER\|error\|') { throw "Initialized-parameter evidence contains runtime inspection errors." }
    New-Item -ItemType Directory -Path (Split-Path -Parent $outputPath) -Force | Out-Null
    [IO.File]::WriteAllLines($outputPath, $lines, [Text.UTF8Encoding]::new($false))
    Write-Output "Initialized-parameter evidence captured at $outputPath"
}
finally {
    Stop-IsolatedClient
    Stop-IsolatedServer
}
