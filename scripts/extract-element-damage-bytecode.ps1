param(
    [Parameter(Mandatory = $true)][string]$PakPath,
    [Parameter(Mandatory = $true)][string]$MappingPath,
    [Parameter(Mandatory = $true)][string]$RepakPath,
    [Parameter(Mandatory = $true)][string]$UAssetGuiPath,
    [Parameter(Mandatory = $true)][string]$OutputDirectory,
    [ValidateRange(5, 300)][int]$ConversionTimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$pak = (Resolve-Path -LiteralPath $PakPath).Path
$mapping = (Resolve-Path -LiteralPath $MappingPath).Path
$repak = (Resolve-Path -LiteralPath $RepakPath).Path
$uassetGui = (Resolve-Path -LiteralPath $UAssetGuiPath).Path
$output = [IO.Path]::GetFullPath($OutputDirectory)
if ($output -match '[\\/](public|dist)([\\/]|$)') { throw "Private bytecode evidence cannot be written below public or dist." }
$mappingName = [IO.Path]::GetFileNameWithoutExtension($mapping)
$uassetGuiMapping = Join-Path (Split-Path -Parent $uassetGui) "Data\Mappings\$mappingName.usmap"
if (-not (Test-Path -LiteralPath $uassetGuiMapping -PathType Leaf)) { throw "UAssetGUI mapping is not installed beside the tool: $uassetGuiMapping" }
if ((Get-FileHash -LiteralPath $mapping -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $uassetGuiMapping -Algorithm SHA256).Hash) { throw "Extractor and UAssetGUI mappings do not match." }

$rawRoot = Join-Path $output "raw-packages"
$assetRelative = "Pal/Content/Pal/Blueprint/System/BP_PalGameSetting.uasset"
$exportRelative = "Pal/Content/Pal/Blueprint/System/BP_PalGameSetting.uexp"
New-Item -ItemType Directory -Path $rawRoot -Force | Out-Null
& $repak unpack -q -f -o $rawRoot -i $assetRelative -i $exportRelative $pak
if ($LASTEXITCODE -ne 0) { throw "repak failed to extract BP_PalGameSetting." }
$assetPath = Join-Path $rawRoot ($assetRelative -replace "/", "\")
$jsonPath = Join-Path $output "BP_PalGameSetting.uassetapi.json"
$pendingJsonPath = Join-Path $output ("BP_PalGameSetting.uassetapi.{0}.pending.json" -f [guid]::NewGuid().ToString("N"))
& $uassetGui tojson $assetPath $pendingJsonPath VER_UE5_1 $mappingName
if ($LASTEXITCODE -ne 0) { throw "UAssetGUI failed to start the JSON conversion." }
$deadline = [DateTimeOffset]::UtcNow.AddSeconds($ConversionTimeoutSeconds)
$lastLength = -1L
$stableChecks = 0
do {
    if (Test-Path -LiteralPath $pendingJsonPath -PathType Leaf) {
        $length = (Get-Item -LiteralPath $pendingJsonPath).Length
        if ($length -gt 0 -and $length -eq $lastLength) {
            try {
                $null = Get-Content -LiteralPath $pendingJsonPath -Raw | ConvertFrom-Json
                $stableChecks++
            } catch {
                $stableChecks = 0
            }
        } else {
            $stableChecks = 0
        }
        $lastLength = $length
    }
    if ($stableChecks -lt 2) { Start-Sleep -Milliseconds 250 }
} while ($stableChecks -lt 2 -and [DateTimeOffset]::UtcNow -lt $deadline)
if ($stableChecks -lt 2) { throw "UAssetGUI did not finish a stable, parseable JSON output within $ConversionTimeoutSeconds seconds." }
Move-Item -LiteralPath $pendingJsonPath -Destination $jsonPath -Force
Write-Output "Extracted the private BP_PalGameSetting bytecode source to $output"
