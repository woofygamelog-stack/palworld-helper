using CUE4Parse.Compression;
using CUE4Parse.FileProvider;
using CUE4Parse.MappingsProvider;
using CUE4Parse.MappingsProvider.Usmap;
using CUE4Parse.UE4.Assets.Exports.Engine;
using CUE4Parse.UE4.Assets.Exports.Actor;
using CUE4Parse.UE4.Assets.Exports.Component;
using CUE4Parse.UE4.Assets.Exports.Texture;
using CUE4Parse.UE4.Assets.Objects;
using CUE4Parse.UE4.Objects.Core.i18N;
using CUE4Parse.UE4.Objects.Core.Math;
using CUE4Parse.UE4.Objects.Engine;
using CUE4Parse.UE4.Objects.UObject;
using CUE4Parse.UE4.Versions;
using CUE4Parse_Conversion.Textures;
using Newtonsoft.Json;
using SkiaSharp;

if (args.Length != 3)
{
    Console.Error.WriteLine("Usage: GameDataExtractor <Paks directory> <Mappings.usmap> <output directory>");
    return 2;
}

var paks = Path.GetFullPath(args[0]);
var mappings = Path.GetFullPath(args[1]);
var output = Path.GetFullPath(args[2]);
if (!Directory.Exists(paks) || !File.Exists(mappings)) throw new FileNotFoundException("Required local game input was not found.");
Directory.CreateDirectory(output);

OodleHelper.Initialize(Path.Combine(AppContext.BaseDirectory, "oo2core_9_win64.dll"));
#pragma warning disable CS0618 // Current CUE4Parse stable keeps this compatible overload; paths are read-only and explicit.
var provider = new DefaultFileProvider(paks, SearchOption.AllDirectories, true, new VersionContainer(EGame.GAME_UE5_1));
#pragma warning restore CS0618
provider.MappingsContainer = new FileUsmapTypeMappingsProvider(mappings);
provider.Initialize();
provider.Mount();
provider.LoadVirtualPaths();

object DumpTable(string assetPath)
{
    var table = provider.LoadPackageObject<UDataTable>(assetPath);
    return table.RowMap.ToDictionary(row => row.Key.Text, row => row.Value.Properties.ToDictionary(property => property.Name.Text, property => property.Tag));
}

Dictionary<string,string> DumpTextTable(string assetPath)
{
    var table = provider.LoadPackageObject<UDataTable>(assetPath);
    return table.RowMap.ToDictionary(row => row.Key.Text, row => row.Value.Get<FText>("TextData").Text);
}

void Write(string name, object value) => File.WriteAllText(Path.Combine(output, name), JsonConvert.SerializeObject(value, Formatting.None));

Write("items.raw.json", DumpTable("Pal/Content/Pal/DataTable/Item/DT_ItemDataTable"));
Write("recipes.raw.json", DumpTable("Pal/Content/Pal/DataTable/Item/DT_ItemRecipeDataTable"));
Write("map.raw.json", DumpTable("Pal/Content/Pal/DataTable/WorldMapUIData/DT_WorldMapUIData"));
Write("boss-spawns.raw.json", DumpTable("Pal/Content/Pal/DataTable/UI/DT_BossSpawnerLoactionData"));
Write("pal-spawner-placement.raw.json", DumpTable("Pal/Content/Pal/DataTable/Spawner/DT_PalSpawnerPlacement"));
Write("pal-wild-spawners.raw.json", DumpTable("Pal/Content/Pal/DataTable/Spawner/DT_PalWildSpawner"));
Write("pal-parameters.raw.json", DumpTable("Pal/Content/Pal/DataTable/Character/DT_PalMonsterParameter"));

var mapTable = provider.LoadPackageObject<UDataTable>("Pal/Content/Pal/DataTable/WorldMapUIData/DT_WorldMapUIData");
var extractedWorlds = new Dictionary<string, object>();
foreach (var definition in new[] { (Row: "MainMap", TextureKey: "FirstRegion", File: "world-map.webp"), (Row: "Tree", TextureKey: "DummyRegion", File: "tree-map.webp") })
{
    var mapRow = mapTable.RowMap.FirstOrDefault(row => row.Key.Text == definition.Row).Value
        ?? throw new InvalidDataException($"{definition.Row} row was not found.");
    var mapProps = mapRow.Properties.ToDictionary(property => property.Name.Text, property => property.Tag);
    var mapMin = mapProps["landScapeRealPositionMin"]!.GetValue<FVector>();
    var mapMax = mapProps["landScapeRealPositionMax"]!.GetValue<FVector>();
    var textureMap = mapProps["textureDataMap"]!.GetValue<UScriptMap>()
        ?? throw new InvalidDataException($"{definition.Row} texture map was not found.");
    UTexture2D? mapTexture = null;
    foreach (var pair in textureMap.Properties)
    {
        if (pair.Key!.GetValue<FName>().Text != definition.TextureKey) continue;
        var region = pair.Value!.GetValue<FStructFallback>()!.Properties.ToDictionary(property => property.Name.Text, property => property.Tag);
        if (region["Texture"]!.GetValue<FSoftObjectPath>()!.TryLoad<UTexture2D>(out var loadedTexture) && loadedTexture is not null)
            mapTexture = loadedTexture;
    }
    if (mapTexture is null) throw new InvalidDataException($"{definition.Row} map texture was not found.");
    using (var bitmap = (mapTexture.Decode(ETexturePlatform.DesktopMobile)
        ?? throw new InvalidDataException($"{definition.Row} map texture could not be decoded.")).ToSkBitmap())
    using (var encoded = bitmap.Encode(SKEncodedImageFormat.Webp, 78))
    using (var target = File.Create(Path.Combine(output, definition.File))) encoded.SaveTo(target);
    extractedWorlds[definition.Row] = new { minX=mapMin.X, minY=mapMin.Y, maxX=mapMax.X, maxY=mapMax.Y, width=mapTexture.PlatformData.SizeX, height=mapTexture.PlatformData.SizeY, image=definition.File };
}
Write("map-worlds-meta.raw.json", extractedWorlds);
Write("map-meta.raw.json", extractedWorlds["MainMap"]);

var localeAssets = provider.Files.Select(file => file.Key)
    .Where(path => path.Contains("/DataTable/Text/DT_ItemNameText_Common.uasset", StringComparison.OrdinalIgnoreCase))
    .OrderBy(path => path).ToList();
var localizedNames = new Dictionary<string,Dictionary<string,string>>();
foreach (var asset in localeAssets)
{
    var marker = "/L10N/";
    var start = asset.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
    if (start < 0) continue;
    var lang = asset[(start + marker.Length)..].Split('/')[0];
    localizedNames[lang] = DumpTextTable(asset[..^7]);
}
localizedNames["ja"] = DumpTextTable("Pal/Content/Pal/DataTable/Text/DT_ItemNameText");
Write("item-names.raw.json", localizedNames);
var descriptionAssets = provider.Files.Select(file => file.Key)
    .Where(path => path.Contains("/DataTable/Text/DT_ItemDescriptionText_Common.uasset", StringComparison.OrdinalIgnoreCase))
    .OrderBy(path => path).ToList();
var localizedDescriptions = new Dictionary<string,Dictionary<string,string>>();
foreach (var asset in descriptionAssets)
{
    var marker = "/L10N/";
    var start = asset.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
    if (start < 0) continue;
    var lang = asset[(start + marker.Length)..].Split('/')[0];
    localizedDescriptions[lang] = DumpTextTable(asset[..^7]);
}
localizedDescriptions["ja"] = DumpTextTable("Pal/Content/Pal/DataTable/Text/DT_ItemDescriptionText");
Write("item-descriptions.raw.json", localizedDescriptions);
Dictionary<string,Dictionary<string,string>> DumpLocalizedTextFamily(string commonFile, string japaneseAsset)
{
    var assets = provider.Files.Select(file => file.Key)
        .Where(path => path.EndsWith($"/{commonFile}.uasset", StringComparison.OrdinalIgnoreCase))
        .OrderBy(path => path).ToList();
    var result = new Dictionary<string,Dictionary<string,string>>();
    foreach (var asset in assets)
    {
        var marker = "/L10N/";
        var start = asset.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (start < 0) continue;
        var lang = asset[(start + marker.Length)..].Split('/')[0];
        result[lang] = DumpTextTable(asset[..^7]);
    }
    var japanesePath = provider.Files.Keys.FirstOrDefault(path => path.EndsWith($"/{Path.GetFileName(japaneseAsset)}.uasset", StringComparison.OrdinalIgnoreCase));
    if (japanesePath is not null) result["ja"] = DumpTextTable(japanesePath[..^7]);
    return result;
}
Write("skill-names.raw.json", DumpLocalizedTextFamily("DT_SkillNameText_Common", "Pal/Content/Pal/DataTable/Text/DT_SkillNameText"));
Write("skill-descriptions.raw.json", DumpLocalizedTextFamily("DT_SkillDescText_Common", "Pal/Content/Pal/DataTable/Text/DT_SkillDescText"));
Write("pal-long-descriptions.raw.json", DumpLocalizedTextFamily("DT_PalLongDescriptionText", "Pal/Content/Pal/DataTable/Text/DT_PalLongDescriptionText"));
Write("pal-short-descriptions.raw.json", DumpLocalizedTextFamily("DT_PalShortDescriptionText", "Pal/Content/Pal/DataTable/Text/DT_PalShortDescriptionText"));
Write("partner-skill-append.raw.json", DumpLocalizedTextFamily("DT_PartnerSkillAppendText", "Pal/Content/Pal/DataTable/Text/DT_PartnerSkillAppendText"));
Write("ui-common.raw.json", DumpLocalizedTextFamily("DT_UI_Common_Text_Common", "Pal/Content/Pal/DataTable/Text/DT_UI_Common_Text"));
Write("skill-text-assets.raw.json", provider.Files.Keys.Where(path => path.Contains("Skill", StringComparison.OrdinalIgnoreCase) && path.Contains("Text", StringComparison.OrdinalIgnoreCase) && path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase)).OrderBy(path => path).ToArray());
Write("text-assets.raw.json", provider.Files.Keys.Where(path => path.Contains("/DataTable/Text/", StringComparison.OrdinalIgnoreCase) && path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase)).OrderBy(path => path).ToArray());
Write("map-point-assets.raw.json", provider.Files.Keys.Where(path => (path.Contains("FastTravel", StringComparison.OrdinalIgnoreCase) || path.Contains("WarpPoint", StringComparison.OrdinalIgnoreCase) || path.Contains("FastTravelPoint", StringComparison.OrdinalIgnoreCase)) && path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase)).OrderBy(path => path).ToArray());
var mapLayerKeywords = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
{
    ["fastTravel"] = ["FastTravel", "Fast_Travel", "WarpPoint", "FastTravelPoint"],
    ["tower"] = ["Tower", "Gym"],
    ["dungeon"] = ["Dungeon", "Cave", "Sealed", "SealArea"],
    ["wanted"] = ["Wanted", "Bounty"],
    ["npc"] = ["NPC", "Merchant", "Trader", "Shop"],
    ["collectible"] = ["Collect", "Chest", "Treasure", "Egg", "Memo", "Note", "Journal", "Effigy", "Lifmunk"],
    ["resource"] = ["Resource", "Ore", "Coal", "Sulfur", "Quartz", "Oil", "Paldium", "Berry", "Mushroom", "SkillFruit"]
};
var placementCandidates = new Dictionary<string, string[]>();
foreach (var group in mapLayerKeywords)
{
    placementCandidates[group.Key] = provider.Files.Keys
        .Where(path => path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase) || path.EndsWith(".umap", StringComparison.OrdinalIgnoreCase))
        .Where(path => group.Value.Any(keyword => path.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
        .OrderBy(path => path)
        .ToArray();
}
Write("world-placement-assets.raw.json", placementCandidates);
Write("map-ui-icon-assets.raw.json", provider.Files.Keys
    .Where(path => path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase))
    .Where(path => (path.Contains("Map", StringComparison.OrdinalIgnoreCase) || path.Contains("Icon", StringComparison.OrdinalIgnoreCase)) && mapLayerKeywords.Values.SelectMany(value => value).Any(keyword => path.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
    .OrderBy(path => path)
    .ToArray());
Write("work-suitability-icon-assets.raw.json", provider.Files.Keys
    .Where(path => path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase))
    .Where(path => path.Contains("Icon", StringComparison.OrdinalIgnoreCase)
        || path.Contains("Texture/UI", StringComparison.OrdinalIgnoreCase))
    .Where(path => new[] { "WorkSuit", "Suitability", "WorkIcon", "PalWork", "Work_", "Work/", "BaseCamp" }
        .Any(keyword => path.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
    .OrderBy(path => path)
    .ToArray());
Write("world-map-packages.raw.json", provider.Files.Keys
    .Where(path => path.EndsWith(".umap", StringComparison.OrdinalIgnoreCase))
    .Where(path => path.Contains("MainWorld", StringComparison.OrdinalIgnoreCase)
        || path.Contains("WorldTree", StringComparison.OrdinalIgnoreCase)
        || path.Contains("TreeWorld", StringComparison.OrdinalIgnoreCase))
    .OrderBy(path => path)
    .ToArray());
var externalActorPackages = provider.Files.Keys
    .Where(path => path.Contains("/ExternalActors/", StringComparison.OrdinalIgnoreCase))
    .OrderBy(path => path)
    .ToArray();
Write("external-actor-packages.raw.json", externalActorPackages);
var mapIconAssets = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
{
    ["fast-travel"] = "Pal/Content/Pal/Blueprint/UI/WorldMap/IconWidgets/T_worldmap_icon_fasttravel",
    ["tower"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_compass_tower",
    ["fast-travel-tower"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_compass_FTtower",
    ["dungeon"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_compass_dungeon",
    ["wanted"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_compass_Bounty",
    ["wanted-unknown"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_compass_Bounty_Unknown",
    ["treasure"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_compass_Search_Treasure",
    ["oil-rig"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_compass_Oilrig"
};
var workSuitabilityIconAssets = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
{
    ["Kindling"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_palwork_00",
    ["Watering"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_palwork_01",
    ["Planting"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_palwork_02",
    ["GenerateElectricity"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_palwork_03",
    ["Handiwork"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_palwork_04",
    ["Gathering"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_palwork_05",
    ["Lumbering"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_palwork_06",
    ["Mining"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_palwork_07",
    ["MedicineProduction"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_palwork_09",
    ["Cooling"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_palwork_10",
    ["Transporting"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_palwork_11",
    ["Farming"] = "Pal/Content/Pal/Texture/UI/InGame/T_icon_palwork_12"
};
var workSuitabilityIconDirectory = Path.Combine(output, "work-suitability-icons");
Directory.CreateDirectory(workSuitabilityIconDirectory);
var exportedWorkSuitabilityIcons = 0;
foreach (var icon in workSuitabilityIconAssets)
{
    try
    {
        var texture = provider.LoadPackageObject<UTexture2D>(icon.Value);
        using var bitmap = texture.Decode(ETexturePlatform.DesktopMobile)?.ToSkBitmap();
        if (bitmap is null) continue;
        using var encoded = bitmap.Encode(SKEncodedImageFormat.Webp, 90);
        using var target = File.Create(Path.Combine(workSuitabilityIconDirectory, $"{icon.Key}.webp"));
        encoded.SaveTo(target);
        exportedWorkSuitabilityIcons++;
    }
    catch (Exception error)
    {
        Console.Error.WriteLine($"Could not export work suitability icon {icon.Key}: {error.Message}");
    }
}
var mapIconDirectory = Path.Combine(output, "map-icons");
Directory.CreateDirectory(mapIconDirectory);
var exportedMapIcons = 0;
foreach (var icon in mapIconAssets)
{
    try
    {
        var texture = provider.LoadPackageObject<UTexture2D>(icon.Value);
        using var bitmap = texture.Decode(ETexturePlatform.DesktopMobile)?.ToSkBitmap();
        if (bitmap is null) continue;
        using var encoded = bitmap.Encode(SKEncodedImageFormat.Webp, 90);
        using var target = File.Create(Path.Combine(mapIconDirectory, $"{icon.Key}.webp"));
        encoded.SaveTo(target);
        exportedMapIcons++;
    }
    catch (Exception error)
    {
        Console.Error.WriteLine($"Could not export map icon {icon.Key}: {error.Message}");
    }
}
var iconDirectory = Path.Combine(output, "item-icons");
Directory.CreateDirectory(iconDirectory);
var itemRows = provider.LoadPackageObject<UDataTable>("Pal/Content/Pal/DataTable/Item/DT_ItemDataTable").RowMap;
var textureFiles = provider.Files.Keys
    .Where(path => path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase))
    .Select(path => path[..^7])
    .OrderByDescending(path => path.Contains("InventoryItemIcon/Texture", StringComparison.OrdinalIgnoreCase))
    .ThenByDescending(path => path.Contains("InventoryItemIcon", StringComparison.OrdinalIgnoreCase))
    .ThenByDescending(path => path.Contains("Texture/UI", StringComparison.OrdinalIgnoreCase))
    .ThenBy(path => path)
    .ToList();
string NormalizeAssetName(string value) => new(value.Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant).ToArray());
var textureNames = textureFiles
    .GroupBy(path => NormalizeAssetName(Path.GetFileName(path)), StringComparer.Ordinal)
    .ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.Ordinal);
var decodedIcons = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
var iconSources = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
var unresolvedIcons = new List<object>();
var decodeFailures = new List<object>();
foreach (var iconName in itemRows.Values
    .Select(row => row.Get<FName>("IconName").Text)
    .Where(name => !string.IsNullOrWhiteSpace(name) && !name.Equals("None", StringComparison.OrdinalIgnoreCase))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .OrderBy(name => name, StringComparer.OrdinalIgnoreCase))
{
    var normalizedIcon = NormalizeAssetName(iconName);
    var candidateNames = new[]
    {
        normalizedIcon,
        NormalizeAssetName($"T_itemicon_{iconName}"),
        NormalizeAssetName($"T_icon_item_{iconName}"),
        NormalizeAssetName($"T_icon_{iconName}"),
        NormalizeAssetName($"T_{iconName}")
    }.Distinct(StringComparer.Ordinal);
    var candidates = candidateNames
        .SelectMany(name => textureNames.GetValueOrDefault(name) ?? [])
        .Concat(textureFiles.Where(path => NormalizeAssetName(Path.GetFileName(path)).EndsWith(normalizedIcon, StringComparison.Ordinal)))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();
    if (candidates.Length == 0)
    {
        unresolvedIcons.Add(new { iconName, reason = "no candidate texture" });
        continue;
    }
    Exception? lastError = null;
    foreach (var assetPath in candidates)
    {
        try
        {
            var texture = provider.LoadPackageObject<UTexture2D>(assetPath);
            using var bitmap = texture.Decode(ETexturePlatform.DesktopMobile)?.ToSkBitmap();
            if (bitmap is null || bitmap.Width <= 0 || bitmap.Height <= 0) continue;
            using var encoded = bitmap.Encode(SKEncodedImageFormat.Webp, 82);
            using var stream = new MemoryStream();
            encoded.SaveTo(stream);
            if (stream.Length == 0) continue;
            decodedIcons[iconName] = stream.ToArray();
            iconSources[iconName] = assetPath;
            break;
        }
        catch (Exception error) { lastError = error; }
    }
    if (!decodedIcons.ContainsKey(iconName))
        decodeFailures.Add(new { iconName, candidates, error = lastError?.Message ?? "all candidates failed to decode" });
}
var expectedItemIcons = itemRows.Count(row => row.Value.Get<bool>("bLegalInGame"));
var exportedIcons = 0;
foreach (var row in itemRows.Where(row => row.Value.Get<bool>("bLegalInGame")))
{
    var iconName = row.Value.Get<FName>("IconName").Text;
    if (!decodedIcons.TryGetValue(iconName, out var bytes))
    {
        unresolvedIcons.Add(new { itemId = row.Key.Text, iconName, reason = "legal item has no decoded icon" });
        continue;
    }
    File.WriteAllBytes(Path.Combine(iconDirectory, $"{row.Key.Text}.webp"), bytes);
    exportedIcons++;
}
Write("item-icon-sources.raw.json", new { schema = 1, itemCount = expectedItemIcons, exportedIcons, iconSources, unresolvedIcons, decodeFailures });
Write("manifest.json", new { schema = 1, extractedAt = DateTimeOffset.UtcNow, tableCounts = new { itemNames = localizedNames.ToDictionary(x=>x.Key,x=>x.Value.Count), itemDescriptions = localizedDescriptions.ToDictionary(x=>x.Key,x=>x.Value.Count), localeCount=localizedNames.Count, itemIcons=exportedIcons, expectedItemIcons, mapIcons=exportedMapIcons, workSuitabilityIcons=exportedWorkSuitabilityIcons } });
if (exportedIcons != expectedItemIcons)
    throw new InvalidDataException($"Item icon coverage is incomplete: {exportedIcons}/{expectedItemIcons}. See item-icon-sources.raw.json.");
Console.WriteLine($"Extracted tables and {localizedNames.Count} item-name locales to {output}");
return 0;
