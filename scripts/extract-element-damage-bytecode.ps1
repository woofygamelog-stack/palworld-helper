param(
    [Parameter(Mandatory = $true)][string]$PakPath,
    [Parameter(Mandatory = $true)][string]$MappingPath,
    [Parameter(Mandatory = $true)][string]$RepakPath,
    [Parameter(Mandatory = $true)][string]$UAssetGuiPath,
    [Parameter(Mandatory = $true)][string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$pak = (Resolve-Path -LiteralPath $PakPath).Path
$mapping = (Resolve-Path -LiteralPath $MappingPath).Path
$repak = (Resolve-Path -LiteralPath $RepakPath).Path
$uassetGui = (Resolve-Path -LiteralPath $UAssetGuiPath).Path
$output = [IO.Path]::GetFullPath($OutputDirectory)
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
& $uassetGui tojson $assetPath $jsonPath VER_UE5_1 $mappingName
if (-not (Test-Path -LiteralPath $jsonPath -PathType Leaf)) { throw "UAssetGUI did not create the expected JSON output." }
Write-Output "Extracted the private BP_PalGameSetting bytecode source to $output"
