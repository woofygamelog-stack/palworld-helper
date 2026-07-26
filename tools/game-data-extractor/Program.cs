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
    .Where(path => Path.GetFileName(path).StartsWith("T_itemicon_", StringComparison.OrdinalIgnoreCase) || Path.GetFileName(path).StartsWith("T_icon_item_", StringComparison.OrdinalIgnoreCase))
    .OrderByDescending(path => path.StartsWith("Pal/Content/Others/InventoryItemIcon/Texture/", StringComparison.OrdinalIgnoreCase))
    .GroupBy(path => Path.GetFileNameWithoutExtension(path), StringComparer.OrdinalIgnoreCase)
    .ToDictionary(group => group.Key, group => group.First()[..^7], StringComparer.OrdinalIgnoreCase);
var iconLikeTextures = provider.Files.Keys
    .Where(path => path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase))
    .Where(path => Path.GetFileName(path).Contains("icon", StringComparison.OrdinalIgnoreCase))
    .Select(path => path[..^7])
    .OrderByDescending(path => path.Contains("InventoryItemIcon", StringComparison.OrdinalIgnoreCase))
    .ThenBy(path => path)
    .ToList();
string NormalizeAssetName(string value) => new(value.Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant).ToArray());
var exportedIcons = 0;
foreach (var row in itemRows)
{
    var iconName = row.Value.Get<FName>("IconName").Text;
    if (string.IsNullOrWhiteSpace(iconName) || iconName.Equals("None", StringComparison.OrdinalIgnoreCase)) continue;
    var candidates = new[] { $"t_itemicon_{iconName}", $"t_icon_item_{iconName}" };
    var assetPath = candidates.Select(candidate => textureFiles.GetValueOrDefault(candidate)).FirstOrDefault(path => path is not null);
    if (assetPath is null)
    {
        var normalizedIcon = NormalizeAssetName(iconName);
        assetPath = iconLikeTextures.FirstOrDefault(path => NormalizeAssetName(Path.GetFileName(path)).EndsWith(normalizedIcon, StringComparison.Ordinal));
    }
    if (assetPath is null) continue;
    try
    {
        var texture = provider.LoadPackageObject<UTexture2D>(assetPath);
        using var bitmap = texture.Decode(ETexturePlatform.DesktopMobile)?.ToSkBitmap();
        if (bitmap is null) continue;
        using var encoded = bitmap.Encode(SKEncodedImageFormat.Webp, 82);
        using var target = File.Create(Path.Combine(iconDirectory, $"{row.Key.Text}.webp"));
        encoded.SaveTo(target);
        exportedIcons++;
    }
    catch (Exception error)
    {
        Console.Error.WriteLine($"Could not export item icon {row.Key.Text}: {error.Message}");
    }
}
Write("manifest.json", new { schema = 1, extractedAt = DateTimeOffset.UtcNow, tableCounts = new { itemNames = localizedNames.ToDictionary(x=>x.Key,x=>x.Value.Count), itemDescriptions = localizedDescriptions.ToDictionary(x=>x.Key,x=>x.Value.Count), localeCount=localizedNames.Count, itemIcons=exportedIcons, mapIcons=exportedMapIcons } });
Console.WriteLine($"Extracted tables and {localizedNames.Count} item-name locales to {output}");
return 0;
