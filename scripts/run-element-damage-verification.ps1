param(
    [Parameter(Mandatory = $true)][string]$AppManifestPath,
    [Parameter(Mandatory = $true)][string]$GameRoot,
    [Parameter(Mandatory = $true)][string]$MappingPath,
    [Parameter(Mandatory = $true)][string]$RepakPath,
    [Parameter(Mandatory = $true)][string]$UAssetGuiPath,
    [string]$DotnetPath = "dotnet",
    [string]$RuntimeDriverPath = $env:PAL_ELEMENT_RUNTIME_DRIVER,
    [string]$RuntimeServerRoot = $env:PAL_ELEMENT_RUNTIME_SERVER_ROOT,
    [string]$Ue4ssPackageRoot = $env:PAL_UE4SS_PACKAGE_ROOT,
    [switch]$ReuseExtraction,
    [switch]$SourceOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$defaultDriver = Join-Path $repositoryRoot "tools\element-damage-runtime-driver\run.ps1"
$defaultServer = Join-Path $repositoryRoot "private\runtime\PalServer"
if (-not $RuntimeDriverPath -and (Test-Path -LiteralPath $defaultDriver -PathType Leaf)) { $RuntimeDriverPath = $defaultDriver }
if (-not $RuntimeServerRoot -and (Test-Path -LiteralPath (Join-Path $defaultServer "PalServer.exe") -PathType Leaf)) { $RuntimeServerRoot = $defaultServer }
if (-not $Ue4ssPackageRoot) {
    $steamApps = Split-Path -Parent (Split-Path -Parent ([IO.Path]::GetFullPath($GameRoot)))
    $detectedUe4ss = Join-Path $steamApps "workshop\content\1623730\3625223587"
    if (Test-Path -LiteralPath (Join-Path $detectedUe4ss "UE4SS.dll") -PathType Leaf) { $Ue4ssPackageRoot = $detectedUe4ss }
}
$verificationRoot = Join-Path $repositoryRoot "private\verification\element-damage"
$pendingDetection = Join-Path $verificationRoot ("detected-installation.{0}.pending.json" -f [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $verificationRoot -Force | Out-Null

function Invoke-NativeChecked {
    param([scriptblock]$Command, [string]$FailureMessage)
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$FailureMessage (exit code $LASTEXITCODE)" }
}

function Write-RunState {
    param([string]$Status, [string]$Build, [string]$Message, [string]$Path)
    $state = [ordered]@{
        schema = 1
        gameBuild = $Build
        updatedAt = [DateTimeOffset]::UtcNow.ToString("o")
        status = $Status
        message = $Message
    }
    $state | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding utf8
}

Push-Location $repositoryRoot
try {
    Invoke-NativeChecked { node "scripts\detect-palworld-build.mjs" --app-manifest $AppManifestPath --game-root $GameRoot --mapping $MappingPath --output $pendingDetection } "Palworld installation detection failed"
    $detected = Get-Content -LiteralPath $pendingDetection -Raw | ConvertFrom-Json
    $gameBuild = [string]$detected.meta.gameBuild
    $buildRoot = Join-Path $verificationRoot "build-$gameBuild"
    $installationPath = Join-Path $buildRoot "detected-installation.json"
    $statePath = Join-Path $buildRoot "run-state.json"
    $sourceRoot = Join-Path $repositoryRoot "private\extracted\build-$gameBuild-element-damage"
    $sourceReportPath = Join-Path $buildRoot "source-report.json"
    $testPlanPath = Join-Path $buildRoot "test-plan.json"
    $runtimeContractPath = Join-Path $buildRoot "runtime-evidence.contract.json"
    $runtimeEvidencePath = Join-Path $buildRoot "runtime-evidence.jsonl"
    New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
    Move-Item -LiteralPath $pendingDetection -Destination $installationPath -Force
    Write-RunState "installation-detected" $gameBuild "Installed build is complete; source extraction is pending." $statePath

    $sourceComplete = (Test-Path -LiteralPath (Join-Path $sourceRoot "element-manifest.json") -PathType Leaf) -and (Test-Path -LiteralPath (Join-Path $sourceRoot "BP_PalGameSetting.uassetapi.json") -PathType Leaf)
    if (-not ($ReuseExtraction -and $sourceComplete)) {
        $paksPath = Join-Path ([IO.Path]::GetFullPath($GameRoot)) "Pal\Content\Paks"
        Invoke-NativeChecked { & $DotnetPath build "tools\game-data-extractor\GameDataExtractor.csproj" } "Game-data extractor build failed"
        Invoke-NativeChecked { & $DotnetPath run --project "tools\game-data-extractor\GameDataExtractor.csproj" --no-build -- $paksPath $MappingPath $sourceRoot element } "Element source extraction failed"
        & "scripts\extract-element-damage-bytecode.ps1" -PakPath (Join-Path $paksPath "Pal-Windows.pak") -MappingPath $MappingPath -RepakPath $RepakPath -UAssetGuiPath $UAssetGuiPath -OutputDirectory $sourceRoot
    }
    Write-RunState "source-extracted" $gameBuild "Build-scoped element sources and bytecode are available." $statePath

    $env:PAL_GAME_BUILD = $gameBuild
    $env:PAL_ELEMENT_INSTALL_MANIFEST = $installationPath
    $env:PAL_ELEMENT_DAMAGE_SOURCE = $sourceRoot
    $env:PAL_ELEMENT_SOURCE_REPORT = $sourceReportPath
    $env:PAL_ELEMENT_TEST_PLAN = $testPlanPath
    $env:PAL_ELEMENT_RUNTIME_CONTRACT = $runtimeContractPath
    $env:PAL_ELEMENT_RUNTIME_EVIDENCE = $runtimeEvidencePath
    $env:PAL_ELEMENT_RUNTIME_REPORT = Join-Path $buildRoot "runtime-report.json"
    Invoke-NativeChecked { node "scripts\verify-element-damage-source.mjs" } "Element source verification failed"
    Invoke-NativeChecked { node "scripts\generate-element-damage-test-plan.mjs" } "Machine runtime-plan generation failed"
    $generatedPlan = Get-Content -LiteralPath $testPlanPath -Raw | ConvertFrom-Json
    $pendingRuntimeReport = [ordered]@{
        meta = [ordered]@{ schema = 3; gameBuild = $gameBuild; generatedAt = [DateTimeOffset]::UtcNow.ToString("o"); status = "runtime-evidence-pending"; planId = $generatedPlan.meta.planId }
        verification = [ordered]@{ exactWeakCountLookup = $true; weakCountAggregationRule = $false; damageCalculationRoute = $false; numericMultipliersReadyForPublic = $false; dualElementRuleReadyForPublic = $false }
    }
    $pendingRuntimeReport | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $env:PAL_ELEMENT_RUNTIME_REPORT -Encoding utf8
    Write-RunState "runtime-evidence-pending" $gameBuild "Source lookup passed. Machine runtime evidence is still required; public numeric rules remain disabled." $statePath

    if (-not $SourceOnly -and $RuntimeDriverPath) {
        $driver = (Resolve-Path -LiteralPath $RuntimeDriverPath).Path
        if (-not $RuntimeServerRoot) { throw "PAL_ELEMENT_RUNTIME_SERVER_ROOT is required with the runtime driver." }
        $serverRoot = (Resolve-Path -LiteralPath $RuntimeServerRoot).Path
        $clientRoot = (Resolve-Path -LiteralPath $GameRoot).Path
        $clientPrefix = $clientRoot.TrimEnd('\') + '\'
        if ($serverRoot.Equals($clientRoot, [StringComparison]::OrdinalIgnoreCase) -or $driver.Equals($clientRoot, [StringComparison]::OrdinalIgnoreCase) -or $serverRoot.StartsWith($clientPrefix, [StringComparison]::OrdinalIgnoreCase) -or $driver.StartsWith($clientPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw "The verification server and driver must not be installed in or below the playable client directory." }
        if (-not (Test-Path -LiteralPath (Join-Path $serverRoot "PalServer.exe") -PathType Leaf)) { throw "The isolated official Palworld dedicated server executable is missing." }
        $driverManifestPath = Join-Path (Split-Path -Parent $driver) "element-damage-driver.manifest.json"
        if (-not (Test-Path -LiteralPath $driverManifestPath -PathType Leaf)) { throw "The runtime driver manifest is missing." }
        $driverManifest = Get-Content -LiteralPath $driverManifestPath -Raw | ConvertFrom-Json
        if ($driverManifest.schema -ne 1 -or $driverManifest.protocolSchema -ne 3 -or $driverManifest.mode -ne "official-dedicated-server" -or $driverManifest.machineGeneratedOnly -ne $true -or $driverManifest.writesClientInstallation -ne $false) { throw "The runtime driver manifest does not satisfy the isolated machine-only contract." }
        if (-not $Ue4ssPackageRoot) { throw "The official UE4SS Experimental package was not found; set PAL_UE4SS_PACKAGE_ROOT." }
        Invoke-NativeChecked { & $driver -ServerRoot $serverRoot -SourceReport $sourceReportPath -Plan $testPlanPath -Contract $runtimeContractPath -Output $runtimeEvidencePath -Ue4ssPackageRoot $Ue4ssPackageRoot -Sessions 2 } "Configured isolated runtime driver failed"
    }
    if (-not $SourceOnly -and (Test-Path -LiteralPath $runtimeEvidencePath -PathType Leaf)) {
        Invoke-NativeChecked { node "scripts\validate-element-damage-runtime.mjs" } "Machine runtime evidence failed validation"
        Write-RunState "runtime-verified" $gameBuild "All source lookup and live damage-calculation route gates passed." $statePath
        Write-Output "Element damage verification passed for build $gameBuild."
    } elseif ($SourceOnly) {
        Write-Output "Source verification passed for build $gameBuild; runtime evidence remains pending and public numeric rules remain disabled."
    } else {
        throw "No isolated runtime driver or machine evidence is available. Configure PAL_ELEMENT_RUNTIME_DRIVER; manual samples are not accepted."
    }
} catch {
    if (Test-Path -LiteralPath $pendingDetection -PathType Leaf) { Write-Warning "A private pending detection report remains at $pendingDetection" }
    throw
} finally {
    Pop-Location
}
