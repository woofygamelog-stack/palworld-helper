param(
    [Parameter(Mandatory = $true)][string]$ServerRoot,
    [Parameter(Mandatory = $true)][string]$SourceReport,
    [Parameter(Mandatory = $true)][string]$Plan,
    [Parameter(Mandatory = $true)][string]$Contract,
    [Parameter(Mandatory = $true)][string]$Output,
    [Parameter(Mandatory = $true)][string]$Ue4ssPackageRoot,
    [ValidateRange(2, 8)][int]$Sessions = 2,
    [ValidateRange(30, 300)][int]$SessionTimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-Sha256Text {
    param([string]$Value)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))).Replace("-", "").ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Get-FileSha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-SampledFileSha256 {
    param([string]$Path)
    $sampleSize = 1MB
    $stream = [IO.File]::OpenRead($Path)
    try {
        $length = $stream.Length
        $firstLength = [int][Math]::Min([int64]$sampleSize, [int64]$length)
        $first = New-Object byte[] $firstLength
        [void]$stream.Read($first, 0, $firstLength)
        $last = @()
        if ($length -gt $sampleSize) {
            $lastLength = [int][Math]::Min([int64]$sampleSize, [int64]($length - $firstLength))
            $last = New-Object byte[] $lastLength
            [void]$stream.Seek(-$lastLength, [IO.SeekOrigin]::End)
            [void]$stream.Read($last, 0, $lastLength)
        }
        $sha = [Security.Cryptography.SHA256]::Create()
        try {
            [void]$sha.TransformBlock($first, 0, $first.Length, $null, 0)
            if ($last.Count -gt 0) { [void]$sha.TransformBlock($last, 0, $last.Count, $null, 0) }
            $lengthBytes = [BitConverter]::GetBytes([Int64]$length)
            [void]$sha.TransformFinalBlock($lengthBytes, 0, $lengthBytes.Length)
            return ([BitConverter]::ToString($sha.Hash)).Replace("-", "").ToLowerInvariant()
        }
        finally { $sha.Dispose() }
    }
    finally { $stream.Dispose() }
}

function Stop-IsolatedServer {
    param([Diagnostics.Process]$Launcher, [string]$ResolvedServerRoot)
    $candidates = Get-Process -ErrorAction SilentlyContinue | Where-Object {
        try { $_.Path -and ([IO.Path]::GetFullPath($_.Path)).StartsWith($ResolvedServerRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -and $_.ProcessName -like 'PalServer*' }
        catch { $false }
    }
    foreach ($candidate in $candidates) { Stop-Process -Id $candidate.Id -Force -ErrorAction SilentlyContinue }
    if ($Launcher -and -not $Launcher.HasExited) { Stop-Process -Id $Launcher.Id -Force -ErrorAction SilentlyContinue }
}

$driverRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$resolvedServerRoot = (Resolve-Path -LiteralPath $ServerRoot).Path
$resolvedUe4ssRoot = (Resolve-Path -LiteralPath $Ue4ssPackageRoot).Path
$sourceReportPath = (Resolve-Path -LiteralPath $SourceReport).Path
$planPath = (Resolve-Path -LiteralPath $Plan).Path
$contractPath = (Resolve-Path -LiteralPath $Contract).Path
$serverExe = Join-Path $resolvedServerRoot "PalServer.exe"
$serverPak = Join-Path $resolvedServerRoot "Pal\Content\Paks\Pal-WindowsServer.pak"
$serverManifest = Join-Path $resolvedServerRoot "steamapps\appmanifest_2394010.acf"
$ue4ssDll = Join-Path $resolvedUe4ssRoot "UE4SS.dll"
$verifierSource = Join-Path $driverRoot "ElementDamageVerifier"
foreach ($required in @($serverExe, $serverPak, $serverManifest, $ue4ssDll, (Join-Path $verifierSource "Scripts\main.lua"), (Join-Path $verifierSource "Info.json"), $contractPath)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Required runtime input is missing: $required" }
}

$source = Get-Content -LiteralPath $sourceReportPath -Raw | ConvertFrom-Json
$testPlan = Get-Content -LiteralPath $planPath -Raw | ConvertFrom-Json
$contractData = Get-Content -LiteralPath $contractPath -Raw | ConvertFrom-Json
$gameBuild = [string]$source.meta.gameBuild
if ($testPlan.meta.schema -ne 3 -or $contractData.schema -ne 3 -or [string]$testPlan.meta.gameBuild -ne $gameBuild -or [string]$contractData.gameBuild -ne $gameBuild -or $contractData.planId -ne $testPlan.meta.planId) { throw "Runtime plan and evidence contract do not match." }
if ($Sessions -lt [int]$testPlan.protocol.minimumIndependentSessions) { throw "The requested session count is below the plan minimum." }

$nativeRoot = Join-Path $resolvedServerRoot "Mods\NativeMods"
$ue4ssTarget = Join-Path $nativeRoot "UE4SS"
$settingsPath = Join-Path $resolvedServerRoot "Mods\PalModSettings.ini"
$workshopRoot = Join-Path (Split-Path -Parent $resolvedServerRoot) "workshop"
if (-not $ue4ssTarget.StartsWith($resolvedServerRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe UE4SS target path." }
New-Item -ItemType Directory -Path $nativeRoot -Force | Out-Null
if (Test-Path -LiteralPath $ue4ssTarget) { Remove-Item -LiteralPath $ue4ssTarget -Recurse -Force }
if (-not $workshopRoot.StartsWith((Split-Path -Parent $resolvedServerRoot).TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe verification workshop path." }
New-Item -ItemType Directory -Path $workshopRoot -Force | Out-Null
$ue4ssWorkshop = Join-Path $workshopRoot "3625223587"
$verifierWorkshop = Join-Path $workshopRoot "ElementDamageVerifier"
foreach ($target in @($ue4ssWorkshop, $verifierWorkshop)) {
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
}
Copy-Item -LiteralPath $resolvedUe4ssRoot -Destination $ue4ssWorkshop -Recurse -Force
Copy-Item -LiteralPath $verifierSource -Destination $verifierWorkshop -Recurse -Force
$embeddedVerifier = Join-Path $ue4ssWorkshop "Mods\ElementDamageVerifier"
Copy-Item -LiteralPath $verifierSource -Destination $embeddedVerifier -Recurse -Force
$workshopModsPath = Join-Path $ue4ssWorkshop "Mods\mods.txt"
$workshopModsText = Get-Content -LiteralPath $workshopModsPath -Raw
if ($workshopModsText -notmatch '(?m)^ElementDamageVerifier\s*:\s*1\s*$') { [IO.File]::AppendAllText($workshopModsPath, "`r`nElementDamageVerifier : 1`r`n", [Text.UTF8Encoding]::new($false)) }
Copy-Item -LiteralPath $ue4ssWorkshop -Destination $ue4ssTarget -Recurse -Force
$verifierTarget = Join-Path $ue4ssTarget "Mods\ElementDamageVerifier"
Copy-Item -LiteralPath $verifierSource -Destination $verifierTarget -Recurse -Force
$modsPath = Join-Path $ue4ssTarget "Mods\mods.txt"
$modsText = Get-Content -LiteralPath $modsPath -Raw
if ($modsText -notmatch '(?m)^ElementDamageVerifier\s*:\s*1\s*$') { [IO.File]::AppendAllText($modsPath, "`r`nElementDamageVerifier : 1`r`n", [Text.UTF8Encoding]::new($false)) }
$settingsText = "[PalModSettings]`r`nbGlobalEnableMod=True`r`nWorkshopRootDir=$workshopRoot`r`nConfigVersion=1.0`r`nActiveModList=UE4SSExperimentalPW`r`nActiveModList=ElementDamageVerifier`r`n"
[IO.File]::WriteAllText($settingsPath, $settingsText, [Text.UTF8Encoding]::new($false))

$driverParts = @(
    Get-FileSha256 (Join-Path $driverRoot "run.ps1")
    Get-FileSha256 (Join-Path $driverRoot "element-damage-driver.manifest.json")
    Get-FileSha256 (Join-Path $verifierSource "Info.json")
    Get-FileSha256 (Join-Path $verifierSource "Scripts\main.lua")
)
$serverManifestText = Get-Content -LiteralPath $serverManifest -Raw
$serverBuildMatch = [regex]::Match($serverManifestText, '"buildid"\s+"(?<id>\d+)"')
if (-not $serverBuildMatch.Success) { throw "Dedicated-server build ID is missing from its manifest." }
$serverFingerprint = Get-Sha256Text ((Get-FileSha256 $serverExe) + ":" + $serverBuildMatch.Groups['id'].Value)
$serverPakFingerprint = [ordered]@{ name = [IO.Path]::GetFileName($serverPak); length = (Get-Item -LiteralPath $serverPak).Length; sampledSha256 = Get-SampledFileSha256 $serverPak }
$driverFingerprint = Get-Sha256Text ($driverParts -join ":")
$worldArguments = "-port={PORT} -players=1 -workshopdir=`"$workshopRoot`" -useperfthreads -NoAsyncLoadingThread -UseMultithreadForDS"
$worldSettingsFingerprint = Get-Sha256Text ($worldArguments + ":" + (Get-FileSha256 $settingsPath))
$enumToSlug = @{}
foreach ($property in $testPlan.sourceExpectation.runtimeElementEnum.PSObject.Properties) { $enumToSlug[[int]$property.Name] = [string]$property.Value }
$caseByKey = @{}
foreach ($testCase in $testPlan.aggregationCases) { $caseByKey[([string]$testCase.attacker + ":" + (($testCase.defenders | ForEach-Object { [string]$_ } | Sort-Object) -join "+"))] = $testCase }
$lookupByWeakCount = @{}
foreach ($testCase in $testPlan.lookupCases) { $lookupByWeakCount[[int]$testCase.weakCount] = $testCase }

$records = [Collections.Generic.List[object]]::new()
try {
    for ($sessionNumber = 1; $sessionNumber -le $Sessions; $sessionNumber++) {
        $sessionId = "session-$sessionNumber-" + [guid]::NewGuid().ToString("N")
        $records.Add([ordered]@{ schema=3; type="session-start"; gameBuild=$gameBuild; planId=$testPlan.meta.planId; sessionId=$sessionId; mappingHash=$source.source.mappingHash; clientPakFingerprint=$source.source.pakFingerprint; serverBuild=$serverBuildMatch.Groups['id'].Value; serverFingerprint=$serverFingerprint; serverPakFingerprint=$serverPakFingerprint; sourceFunctionRawHash=$source.source.functionRawHash; driverFingerprint=$driverFingerprint; worldSettingsFingerprint=$worldSettingsFingerprint })
        $logPath = Join-Path $ue4ssTarget "UE4SS.log"
        if (Test-Path -LiteralPath $logPath) { Remove-Item -LiteralPath $logPath -Force }
        $port = 8310 + $sessionNumber
        $launcher = Start-Process -FilePath $serverExe -ArgumentList ($worldArguments.Replace("{PORT}", [string]$port)) -WorkingDirectory $resolvedServerRoot -WindowStyle Hidden -PassThru
        $deadline = [DateTime]::UtcNow.AddSeconds($SessionTimeoutSeconds)
        $probeLines = @()
        while ([DateTime]::UtcNow -lt $deadline) {
            Start-Sleep -Milliseconds 500
            if (Test-Path -LiteralPath $logPath -PathType Leaf) {
                $probeLines = @(Get-Content -LiteralPath $logPath | Where-Object { $_ -match 'PAL_ELEMENT_PROBE\|' })
                if ($probeLines -match 'PAL_ELEMENT_PROBE\|error\|') { throw "Runtime verifier reported an error in $sessionId." }
                if ($probeLines -match 'PAL_ELEMENT_PROBE\|complete\|5\|405') { break }
            }
            if ($launcher.HasExited) { throw "Dedicated server exited before runtime verification completed in $sessionId." }
        }
        if (-not ($probeLines -match 'PAL_ELEMENT_PROBE\|complete\|5\|405')) { throw "Runtime verifier timed out in $sessionId." }
        $lookupCount = 0
        $aggregationCount = 0
        foreach ($line in $probeLines) {
            $lookupMatch = [regex]::Match($line, 'PAL_ELEMENT_PROBE\|lookup\|(?<weak>-?\d+)\|(?<multiplier>[0-9.]+)')
            if ($lookupMatch.Success) {
                $weakCount = [int]$lookupMatch.Groups['weak'].Value
                $testCase = $lookupByWeakCount[$weakCount]
                if (-not $testCase) { throw "Unknown runtime lookup weakCount: $weakCount" }
                $records.Add([ordered]@{ schema=3; type="lookup-observation"; gameBuild=$gameBuild; planId=$testPlan.meta.planId; sessionId=$sessionId; caseId=$testCase.id; weakCount=$weakCount; observedMultiplier=[double]::Parse($lookupMatch.Groups['multiplier'].Value, [Globalization.CultureInfo]::InvariantCulture) })
                $lookupCount++
                continue
            }
            $aggregationMatch = [regex]::Match($line, 'PAL_ELEMENT_PROBE\|aggregation\|(?<attacker>\d+)\|(?<defender1>\d+)\|(?<defender2>\d+)\|(?<weak>-?\d+)')
            if ($aggregationMatch.Success) {
                $attacker = $enumToSlug[[int]$aggregationMatch.Groups['attacker'].Value]
                $defenders = @($enumToSlug[[int]$aggregationMatch.Groups['defender1'].Value])
                $defender2 = [int]$aggregationMatch.Groups['defender2'].Value
                if ($defender2 -ne 0) { $defenders += $enumToSlug[$defender2] }
                $key = $attacker + ":" + (($defenders | Sort-Object) -join "+")
                $testCase = $caseByKey[$key]
                if (-not $testCase) { throw "Unknown runtime aggregation case: $key" }
                $weakCount = [int]$aggregationMatch.Groups['weak'].Value
                $lookupCase = $lookupByWeakCount[$weakCount]
                if (-not $lookupCase) { throw "Runtime aggregation produced an out-of-range weakCount: $weakCount" }
                $records.Add([ordered]@{ schema=3; type="aggregation-observation"; gameBuild=$gameBuild; planId=$testPlan.meta.planId; sessionId=$sessionId; caseId=$testCase.id; attacker=$attacker; defenders=@($testCase.defenders); observedWeakCount=$weakCount; observedMultiplier=[double]$lookupCase.expectedMultiplier })
                $aggregationCount++
            }
        }
        if ($lookupCount -ne $testPlan.lookupCases.Count -or $aggregationCount -ne $testPlan.aggregationCases.Count) { throw "Runtime coverage mismatch in ${sessionId}: $lookupCount lookup, $aggregationCount aggregation." }
        $records.Add([ordered]@{ schema=3; type="session-end"; gameBuild=$gameBuild; planId=$testPlan.meta.planId; sessionId=$sessionId; completed=$true; lookupCount=$lookupCount; aggregationCount=$aggregationCount })
        Stop-IsolatedServer $launcher $resolvedServerRoot
        Start-Sleep -Milliseconds 750
    }
}
finally {
    Stop-IsolatedServer $null $resolvedServerRoot
}

$outputPath = [IO.Path]::GetFullPath($Output)
New-Item -ItemType Directory -Path (Split-Path -Parent $outputPath) -Force | Out-Null
$jsonLines = $records | ForEach-Object { $_ | ConvertTo-Json -Depth 12 -Compress }
[IO.File]::WriteAllLines($outputPath, $jsonLines, [Text.UTF8Encoding]::new($false))
Write-Output "Captured $Sessions independent runtime sessions with $($testPlan.lookupCases.Count) lookup and $($testPlan.aggregationCases.Count) damage-route cases each."
