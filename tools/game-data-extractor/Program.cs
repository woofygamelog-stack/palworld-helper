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
using Newtonsoft.Json.Linq;
using SkiaSharp;

if (args.Length < 3 || args.Length > 4)
{
    Console.Error.WriteLine("Usage: GameDataExtractor <Paks directory> <Mappings.usmap> <output directory> [full|npc|dungeon|technology|structure|element]");
    return 2;
}

var paks = Path.GetFullPath(args[0]);
var mappings = Path.GetFullPath(args[1]);
var output = Path.GetFullPath(args[2]);
var mode = args.Length == 4 ? args[3] : "full";
if (mode is not ("full" or "npc" or "dungeon" or "technology" or "structure" or "element")) throw new ArgumentException($"Unsupported extraction mode: {mode}");
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
    result["ja"] = DumpTextTable(japaneseAsset);
    return result;
}

void Write(string name, object value) => File.WriteAllText(Path.Combine(output, name), JsonConvert.SerializeObject(value, Formatting.None));

object DumpClassDefaults(string generatedClassPath)
{
    var generatedClass = provider.LoadPackageObject<UClass>(generatedClassPath);
    var defaults = generatedClass.ClassDefaultObject.Load<CUE4Parse.UE4.Assets.Exports.UObject>()
        ?? throw new InvalidDataException($"Class default object was not found for {generatedClassPath}.");
    return defaults.Properties.ToDictionary(property => property.Name.Text, property => property.Tag);
}

string NormalizeGameAssetPath(string assetPath)
{
    if (!assetPath.StartsWith("/Game/", StringComparison.OrdinalIgnoreCase)) return assetPath;
    return $"Pal/Content/{assetPath[6..]}";
}

object DumpReferencedClassDefaults(JObject table)
{
    var classPaths = table.Properties()
        .Select(property => property.Value["LotteryValueBlueprintSoftClass"]?["AssetPathName"]?.Value<string>())
        .Where(path => !string.IsNullOrWhiteSpace(path) && !string.Equals(path, "None", StringComparison.OrdinalIgnoreCase))
        .Select(path => NormalizeGameAssetPath(path!))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
        .ToArray();
    var classes = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
    var errors = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    foreach (var classPath in classPaths)
    {
        try
        {
            classes[classPath] = DumpClassDefaults(classPath);
        }
        catch (Exception error)
        {
            errors[classPath] = error.Message;
        }
    }
    return new { requestedClassCount = classPaths.Length, extractedClassCount = classes.Count, failedClassCount = errors.Count, classes, errors };
}

object DumpDungeonLevelActors(JObject dungeonLevels)
{
    var keywords = new[]
    {
        "MapObjectSpawner", "ResourceSpawner", "Treasure", "ItemChest", "PalEgg", "SkillFruit", "ItemPickup",
        "RockCopper", "RockCoal", "RockQuartz", "RockSulfur", "PalCrystal", "OreSpawner", "Paldium",
        "Mushroom", "Lotus", "FishingSpot", "DungeonExit", "DungeonEntrance", "DungeonPortal"
    };
    var levels = new List<object>();
    foreach (var row in dungeonLevels.Properties().OrderBy(property => property.Name, StringComparer.OrdinalIgnoreCase))
    {
        var spawnAreaId = row.Value["SpawnAreaId"]?.Value<string>();
        var levelName = row.Value["LevelName"]?.Value<string>();
        if (string.IsNullOrWhiteSpace(levelName))
        {
            levels.Add(new { rowId = row.Name, spawnAreaId, levelName, candidates = Array.Empty<string>(), parsed = false, error = "LevelName is missing.", typeCounts = new Dictionary<string, int>(), actors = Array.Empty<object>() });
            continue;
        }
        var candidates = provider.Files.Keys
            .Where(path => path.EndsWith(".umap", StringComparison.OrdinalIgnoreCase))
            .Where(path => string.Equals(Path.GetFileNameWithoutExtension(path), levelName, StringComparison.OrdinalIgnoreCase))
            .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (candidates.Length != 1)
        {
            levels.Add(new { rowId = row.Name, spawnAreaId, levelName, candidates, parsed = false, error = candidates.Length == 0 ? "No exact level package match." : "Multiple exact level package matches.", typeCounts = new Dictionary<string, int>(), actors = Array.Empty<object>() });
            continue;
        }
        try
        {
            if (!provider.TryLoadPackage(candidates[0], out var package) || package is null) throw new InvalidDataException("Package could not be loaded.");
            var level = package.GetExports().OfType<ULevel>().FirstOrDefault()
                ?? throw new InvalidDataException("ULevel export was not found.");
            var typeCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var actors = new List<object>();
            foreach (var actorIndex in level.Actors)
            {
                if (actorIndex is null) continue;
                var actor = actorIndex.Load<AActor>();
                if (actor is null) continue;
                var actorType = actor.ExportType ?? "Unknown";
                typeCounts[actorType] = typeCounts.GetValueOrDefault(actorType) + 1;
                var matchingKeywords = keywords.Where(keyword => actorType.Contains(keyword, StringComparison.OrdinalIgnoreCase)).ToArray();
                if (matchingKeywords.Length == 0) continue;
                FVector? location = null;
                try
                {
                    var root = actor.Get<FPackageIndex>("RootComponent").Load<USceneComponent>();
                    if (root is not null) location = root.GetComponentTransform().Translation;
                }
                catch { }
                actors.Add(new
                {
                    actorType,
                    actorName = actor.Name,
                    matchingKeywords,
                    location,
                    properties = actor.Properties.ToDictionary(property => property.Name.Text, property => property.Tag)
                });
            }
            levels.Add(new { rowId = row.Name, spawnAreaId, levelName, candidates, parsed = true, error = (string?) null, typeCounts, actors = actors.ToArray() });
        }
        catch (Exception error)
        {
            levels.Add(new { rowId = row.Name, spawnAreaId, levelName, candidates, parsed = false, error = error.Message, typeCounts = new Dictionary<string, int>(), actors = Array.Empty<object>() });
        }
    }
    return new { levelCount = levels.Count, levels };
}

object DumpCandidateDataTables(IEnumerable<string> assetFiles)
{
    var tables = new SortedDictionary<string, object>(StringComparer.OrdinalIgnoreCase);
    var errors = new SortedDictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    foreach (var assetFile in assetFiles.OrderBy(path => path, StringComparer.OrdinalIgnoreCase))
    {
        var assetPath = assetFile.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase)
            ? assetFile[..^7]
            : assetFile;
        try
        {
            tables[assetPath] = DumpTable(assetPath);
        }
        catch (Exception error)
        {
            errors[assetPath] = error.Message;
        }
    }
    return new { candidateCount = tables.Count + errors.Count, extractedCount = tables.Count, failedCount = errors.Count, tables, errors };
}

if (mode == "element")
{
    var keywords = new[]
    {
        "Element", "Attribute", "Weak", "Resist", "Damage", "StatusCalculator", "CharacterParameter", "Affinity"
    };
    var elementAssets = provider.Files.Keys
        .Where(path => path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase))
        .Where(path => keywords.Any(keyword => path.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
        .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
        .ToArray();
    var candidateTableAssets = elementAssets
        .Where(path => path.Contains("/DataTable/", StringComparison.OrdinalIgnoreCase))
        .ToArray();

    Write("element-data-assets.raw.json", elementAssets);
    Write("element-tables.raw.json", DumpCandidateDataTables(candidateTableAssets));
    Write("pal-parameters.raw.json", DumpTable("Pal/Content/Pal/DataTable/Character/DT_PalMonsterParameter"));
    Write("ui-common.raw.json", DumpLocalizedTextFamily("DT_UI_Common_Text_Common", "Pal/Content/Pal/DataTable/Text/DT_UI_Common_Text"));
    Write("element-icon-assets.raw.json", provider.Files.Keys
        .Where(path => path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase))
        .Where(path => path.Contains("Element", StringComparison.OrdinalIgnoreCase))
        .Where(path => path.Contains("Icon", StringComparison.OrdinalIgnoreCase)
            || path.Contains("Texture/UI", StringComparison.OrdinalIgnoreCase)
            || path.Contains("/UI/", StringComparison.OrdinalIgnoreCase))
        .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
        .ToArray());

    var elementIconDirectory = Path.Combine(output, "element-icons");
    Directory.CreateDirectory(elementIconDirectory);
    var elementIconSources = new SortedDictionary<string, object>(StringComparer.OrdinalIgnoreCase);
    for (var index = 0; index < 9; index++)
    {
        var fileName = $"{index:00}.webp";
        var sourceAssetPath = $"Pal/Content/Pal/Texture/UI/InGame/T_Icon_element_s_{index:00}";
        var texture = provider.LoadPackageObject<UTexture2D>(sourceAssetPath);
        using var bitmap = texture.Decode(ETexturePlatform.DesktopMobile)?.ToSkBitmap();
        if (bitmap is null || bitmap.Width <= 0 || bitmap.Height <= 0) throw new InvalidDataException($"Element icon {index:00} did not decode.");
        using var encoded = bitmap.Encode(SKEncodedImageFormat.Webp, 90);
        using var target = File.Create(Path.Combine(elementIconDirectory, fileName));
        encoded.SaveTo(target);
        elementIconSources[index.ToString("00")] = new { sourceAssetPath, width = bitmap.Width, height = bitmap.Height, provenance = "direct" };
    }
    var chartSourceAssetPath = "Pal/Content/Pal/Texture/UI/Main_Menu/T_UI_ElementMutchup";
    var chartTexture = provider.LoadPackageObject<UTexture2D>(chartSourceAssetPath);
    using (var bitmap = chartTexture.Decode(ETexturePlatform.DesktopMobile)?.ToSkBitmap())
    {
        if (bitmap is null || bitmap.Width <= 0 || bitmap.Height <= 0) throw new InvalidDataException("Element matchup chart did not decode.");
        using var encoded = bitmap.Encode(SKEncodedImageFormat.Webp, 90);
        using var target = File.Create(Path.Combine(output, "element-matchup-chart.webp"));
        encoded.SaveTo(target);
        elementIconSources["matchup-chart"] = new { sourceAssetPath = chartSourceAssetPath, width = bitmap.Width, height = bitmap.Height, provenance = "direct" };
    }
    Write("element-icon-sources.raw.json", elementIconSources);
    try
    {
        Write("element-matchup-widget-defaults.raw.json", DumpClassDefaults("Pal/Content/Pal/Blueprint/UI/UserInterface/MainMenu/Pal/WBP_MainMenu_Pal_ElementMatchup.WBP_MainMenu_Pal_ElementMatchup_C"));
    }
    catch (Exception error)
    {
        Write("element-matchup-widget-defaults.raw.json", new { error = error.Message });
    }

    var pakFiles = Directory.EnumerateFiles(paks, "*", SearchOption.TopDirectoryOnly)
        .Select(path => new FileInfo(path))
        .OrderBy(file => file.Name)
        .Select(file => new { file.Name, file.Length, file.LastWriteTimeUtc })
        .ToArray();
    var mappingHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(File.ReadAllBytes(mappings)));
    Write("element-manifest.json", new
    {
        schema = 1,
        mode,
        extractedAt = DateTimeOffset.UtcNow,
        mappingHash,
        pakFiles,
        candidateAssetCount = elementAssets.Length,
        candidateTableCount = candidateTableAssets.Length,
        elementIconCount = elementIconSources.Count - 1,
        localeCount = 17
    });
    Console.WriteLine($"Extracted {candidateTableAssets.Length} element table candidates, Pal element fields, and official text for 17 locales to {output}");
    return 0;
}

if (mode == "technology")
{
    var technologyAssets = provider.Files.Keys
        .Where(path => path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase))
        .Where(path => new[] { "Technology", "TechTree", "LabResearch" }
            .Any(keyword => path.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
        .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
        .ToArray();
    var candidateTableAssets = technologyAssets
        .Where(path => path.Contains("/DataTable/", StringComparison.OrdinalIgnoreCase))
        .ToArray();

    Write("technology-data-assets.raw.json", technologyAssets);
    Write("technology-tables.raw.json", DumpCandidateDataTables(candidateTableAssets));
    var technologyRows = JObject.FromObject(DumpTable("Pal/Content/Pal/DataTable/Technology/DT_TechnologyRecipeUnlock"));
    var labResearchRows = JObject.FromObject(DumpTable("Pal/Content/Pal/DataTable/Lab/DT_LabResearchDataTable"));
    var buildObjectRows = JObject.FromObject(DumpTable("Pal/Content/Pal/DataTable/MapObject/Building/DT_BuildObjectDataTable"));
    var buildObjectIconRows = JObject.FromObject(DumpTable("Pal/Content/Pal/DataTable/MapObject/Building/DT_BuildObjectIconDataTable"));
    Write("technology.raw.json", technologyRows);
    Write("lab-research.raw.json", labResearchRows);
    Write("build-objects.raw.json", buildObjectRows);
    Write("build-object-icons.raw.json", buildObjectIconRows);
    Write("map-object-master.raw.json", DumpTable("Pal/Content/Pal/DataTable/MapObject/DT_MapObjectMasterDataTable"));
    Write("technology-names.raw.json", DumpLocalizedTextFamily("DT_TechnologyNameText_Common", "Pal/Content/Pal/DataTable/Text/DT_TechnologyNameText"));
    Write("technology-descriptions.raw.json", DumpLocalizedTextFamily("DT_TechnologyDescText_Common", "Pal/Content/Pal/DataTable/Text/DT_TechnologyDescText"));
    Write("item-descriptions.raw.json", DumpLocalizedTextFamily("DT_ItemDescriptionText_Common", "Pal/Content/Pal/DataTable/Text/DT_ItemDescriptionText"));
    Write("lab-research-text.raw.json", DumpLocalizedTextFamily("DT_LabResearchText", "Pal/Content/Pal/DataTable/Text/DT_LabResearchText"));
    Write("build-object-names.raw.json", DumpLocalizedTextFamily("DT_MapObjectNameText_Common", "Pal/Content/Pal/DataTable/Text/DT_MapObjectNameText"));
    Write("build-object-descriptions.raw.json", DumpLocalizedTextFamily("DT_BuildObjectDescText_Common", "Pal/Content/Pal/DataTable/Text/DT_BuildObjectDescText"));
    Write("ui-common.raw.json", DumpLocalizedTextFamily("DT_UI_Common_Text_Common", "Pal/Content/Pal/DataTable/Text/DT_UI_Common_Text"));
    Write("technology-icon-assets.raw.json", provider.Files.Keys
        .Where(path => path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase))
        .Where(path => path.Contains("Icon", StringComparison.OrdinalIgnoreCase)
            || path.Contains("Texture/UI", StringComparison.OrdinalIgnoreCase))
        .Where(path => new[] { "Technology", "TechTree", "LabResearch", "Tech_" }
            .Any(keyword => path.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
        .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
        .ToArray());
    Write("build-object-data-assets.raw.json", provider.Files.Keys
        .Where(path => path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase))
        .Where(path => path.Contains("/DataTable/", StringComparison.OrdinalIgnoreCase))
        .Where(path => path.Contains("BuildObject", StringComparison.OrdinalIgnoreCase)
            || path.Contains("MapObject", StringComparison.OrdinalIgnoreCase))
        .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
        .ToArray());
    Write("tower-boss-data-assets.raw.json", provider.Files.Keys
        .Where(path => path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase))
        .Where(path => path.Contains("/DataTable/", StringComparison.OrdinalIgnoreCase))
        .Where(path => new[] { "BossBattle", "PalBoss", "TowerBoss", "Gym", "BossType" }
            .Any(keyword => path.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
        .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
        .ToArray());
    Write("tower-boss-assets.raw.json", provider.Files.Keys
        .Where(path => path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase))
        .Where(path => new[] { "BossBattle", "PalBoss", "TowerBoss", "Gym", "BossType" }
            .Any(keyword => path.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
        .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
        .ToArray());
    var towerBossClassDefaults = new SortedDictionary<string, object>(StringComparer.OrdinalIgnoreCase);
    foreach (var bossKey in new[] { "Grass", "Forest", "Electric", "Desert", "Snow", "Sakurajima", "Viking", "Sorajima" })
    {
        var classPath = $"Pal/Content/Pal/Blueprint/BossBattle/InstanceRoot/BP_PalBossBattleInstanceRoot_{bossKey}.BP_PalBossBattleInstanceRoot_{bossKey}_C";
        towerBossClassDefaults[bossKey] = DumpClassDefaults(classPath);
    }
    Write("tower-boss-class-defaults.raw.json", towerBossClassDefaults);
    Write("tower-boss-icons.raw.json", DumpTable("Pal/Content/Pal/DataTable/Character/DT_PalBossNPCIcon"));

    var technologyBuildingIconDirectory = Path.Combine(output, "technology-building-icons");
    Directory.CreateDirectory(technologyBuildingIconDirectory);
    var technologyBuildingIconSources = new SortedDictionary<string, object>(StringComparer.OrdinalIgnoreCase);
    var technologyBuildingIconErrors = new SortedDictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    foreach (var technology in technologyRows.Properties().OrderBy(property => property.Name, StringComparer.OrdinalIgnoreCase))
    {
        var buildObjectIds = technology.Value["UnlockBuildObjects"]?.Values<string>()
            .Where(value => !string.IsNullOrWhiteSpace(value) && !string.Equals(value, "None", StringComparison.OrdinalIgnoreCase))
            .ToArray() ?? [];
        if (buildObjectIds.Length == 0) continue;
        var iconName = technology.Value["IconName"]?.Value<string>();
        var iconKeys = new[] { iconName }.Concat(buildObjectIds)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var iconRow = iconKeys.Select(key => buildObjectIconRows.Properties()
                .FirstOrDefault(property => string.Equals(property.Name, key, StringComparison.OrdinalIgnoreCase)))
            .FirstOrDefault(property => property is not null);
        var sourceAssetPath = iconRow?.Value["SoftIcon"]?["AssetPathName"]?.Value<string>();
        if (string.IsNullOrWhiteSpace(sourceAssetPath) || string.Equals(sourceAssetPath, "None", StringComparison.OrdinalIgnoreCase))
        {
            technologyBuildingIconErrors[technology.Name] = "No direct build-object icon table reference was found.";
            continue;
        }
        try
        {
            var texture = provider.LoadPackageObject<UTexture2D>(NormalizeGameAssetPath(sourceAssetPath));
            using var bitmap = texture.Decode(ETexturePlatform.DesktopMobile)?.ToSkBitmap();
            if (bitmap is null || bitmap.Width <= 0 || bitmap.Height <= 0) throw new InvalidDataException("Texture decode returned no pixels.");
            using var encoded = bitmap.Encode(SKEncodedImageFormat.Webp, 88);
            var safeFileName = string.Concat(technology.Name.Where(character => char.IsLetterOrDigit(character) || character is '_' or '-'));
            using var target = File.Create(Path.Combine(technologyBuildingIconDirectory, $"{safeFileName}.webp"));
            encoded.SaveTo(target);
            technologyBuildingIconSources[technology.Name] = new
            {
                buildObjectIds,
                iconTableKey = iconRow!.Name,
                sourceAssetPath,
                width = bitmap.Width,
                height = bitmap.Height,
                provenance = "direct"
            };
        }
        catch (Exception error)
        {
            technologyBuildingIconErrors[technology.Name] = error.Message;
        }
    }
    Write("technology-building-icon-sources.raw.json", new
    {
        schema = 1,
        expectedBuildingTechnologyCount = technologyRows.Properties().Count(property => property.Value["UnlockBuildObjects"]?.Any() == true),
        exportedCount = technologyBuildingIconSources.Count,
        failedCount = technologyBuildingIconErrors.Count,
        sources = technologyBuildingIconSources,
        errors = technologyBuildingIconErrors
    });

    var pakFiles = Directory.EnumerateFiles(paks, "*", SearchOption.TopDirectoryOnly)
        .Select(path => new FileInfo(path))
        .OrderBy(file => file.Name)
        .Select(file => new { file.Name, file.Length, file.LastWriteTimeUtc })
        .ToArray();
    var mappingHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(File.ReadAllBytes(mappings)));
    Write("technology-manifest.json", new
    {
        schema = 1,
        mode,
        extractedAt = DateTimeOffset.UtcNow,
        mappingHash,
        pakFiles,
        candidateTableCount = candidateTableAssets.Length,
        technologyRowCount = technologyRows.Count,
        buildingIconCount = technologyBuildingIconSources.Count,
        localeCount = 17
    });
    Console.WriteLine($"Extracted {candidateTableAssets.Length} technology table candidates and official text for 17 locales to {output}");
    return 0;
}

if (mode == "structure")
{
    var technologyRows = JObject.FromObject(DumpTable("Pal/Content/Pal/DataTable/Technology/DT_TechnologyRecipeUnlock"));
    var buildObjectRows = JObject.FromObject(DumpTable("Pal/Content/Pal/DataTable/MapObject/Building/DT_BuildObjectDataTable"));
    var buildObjectIconRows = JObject.FromObject(DumpTable("Pal/Content/Pal/DataTable/MapObject/Building/DT_BuildObjectIconDataTable"));
    var mapObjectMasterRows = JObject.FromObject(DumpTable("Pal/Content/Pal/DataTable/MapObject/DT_MapObjectMasterDataTable"));
    var productRows = JObject.FromObject(DumpTable("Pal/Content/Pal/DataTable/MapObject/DT_MapObjectItemProductDataTable"));
    var farmCropRows = JObject.FromObject(DumpTable("Pal/Content/Pal/DataTable/MapObject/DT_MapObjectFarmCrop"));
    var assignRows = JObject.FromObject(DumpTable("Pal/Content/Pal/DataTable/MapObject/DT_MapObjectAssignData"));

    Write("technology.raw.json", technologyRows);
    Write("build-objects.raw.json", buildObjectRows);
    Write("build-object-icons.raw.json", buildObjectIconRows);
    Write("map-object-master.raw.json", mapObjectMasterRows);
    Write("map-object-products.raw.json", productRows);
    Write("map-object-farm-crops.raw.json", farmCropRows);
    Write("map-object-assign.raw.json", assignRows);
    Write("build-object-names.raw.json", DumpLocalizedTextFamily("DT_MapObjectNameText_Common", "Pal/Content/Pal/DataTable/Text/DT_MapObjectNameText"));
    Write("build-object-descriptions.raw.json", DumpLocalizedTextFamily("DT_BuildObjectDescText_Common", "Pal/Content/Pal/DataTable/Text/DT_BuildObjectDescText"));
    Write("build-object-categories.raw.json", DumpLocalizedTextFamily("DT_BuildObjectCategoryText", "Pal/Content/Pal/DataTable/Text/DT_BuildObjectCategoryText"));
    Write("ui-common.raw.json", DumpLocalizedTextFamily("DT_UI_Common_Text_Common", "Pal/Content/Pal/DataTable/Text/DT_UI_Common_Text"));

    var linkedBuildObjectIds = technologyRows.Properties()
        .SelectMany(technology => technology.Value["UnlockBuildObjects"]?.Values<string>() ?? [])
        .Where(value => !string.IsNullOrWhiteSpace(value) && !string.Equals(value, "None", StringComparison.OrdinalIgnoreCase))
        .Select(value => value!)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
        .ToArray();
    var structureIconDirectory = Path.Combine(output, "structure-icons");
    Directory.CreateDirectory(structureIconDirectory);
    var structureIconSources = new SortedDictionary<string, object>(StringComparer.OrdinalIgnoreCase);
    var structureIconErrors = new SortedDictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    foreach (var buildObjectId in linkedBuildObjectIds)
    {
        var iconRow = buildObjectIconRows.Properties()
            .FirstOrDefault(property => string.Equals(property.Name, buildObjectId, StringComparison.OrdinalIgnoreCase));
        var sourceAssetPath = iconRow?.Value["SoftIcon"]?["AssetPathName"]?.Value<string>();
        if (string.IsNullOrWhiteSpace(sourceAssetPath) || string.Equals(sourceAssetPath, "None", StringComparison.OrdinalIgnoreCase))
        {
            structureIconErrors[buildObjectId] = "No direct build-object icon table reference was found.";
            continue;
        }
        try
        {
            var texture = provider.LoadPackageObject<UTexture2D>(NormalizeGameAssetPath(sourceAssetPath));
            using var bitmap = texture.Decode(ETexturePlatform.DesktopMobile)?.ToSkBitmap();
            if (bitmap is null || bitmap.Width <= 0 || bitmap.Height <= 0) throw new InvalidDataException("Texture decode returned no pixels.");
            using var encoded = bitmap.Encode(SKEncodedImageFormat.Webp, 88);
            var safeFileName = string.Concat(buildObjectId.Where(character => char.IsLetterOrDigit(character) || character is '_' or '-'));
            using var target = File.Create(Path.Combine(structureIconDirectory, $"{safeFileName}.webp"));
            encoded.SaveTo(target);
            structureIconSources[buildObjectId] = new
            {
                iconTableKey = iconRow!.Name,
                sourceAssetPath,
                width = bitmap.Width,
                height = bitmap.Height,
                provenance = "direct"
            };
        }
        catch (Exception error)
        {
            structureIconErrors[buildObjectId] = error.Message;
        }
    }
    Write("structure-icon-sources.raw.json", new
    {
        schema = 1,
        expectedStructureCount = linkedBuildObjectIds.Length,
        exportedCount = structureIconSources.Count,
        failedCount = structureIconErrors.Count,
        sources = structureIconSources,
        errors = structureIconErrors
    });

    var pakFiles = Directory.EnumerateFiles(paks, "*", SearchOption.TopDirectoryOnly)
        .Select(path => new FileInfo(path))
        .OrderBy(file => file.Name)
        .Select(file => new { file.Name, file.Length, file.LastWriteTimeUtc })
        .ToArray();
    var mappingHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(File.ReadAllBytes(mappings)));
    Write("structure-manifest.json", new
    {
        schema = 1,
        mode,
        extractedAt = DateTimeOffset.UtcNow,
        mappingHash,
        pakFiles,
        technologyRowCount = technologyRows.Count,
        buildObjectRowCount = buildObjectRows.Count,
        linkedBuildObjectCount = linkedBuildObjectIds.Length,
        structureIconCount = structureIconSources.Count,
        productRowCount = productRows.Count,
        farmCropRowCount = farmCropRows.Count,
        assignRowCount = assignRows.Count,
        localeCount = 17
    });
    Console.WriteLine($"Extracted {linkedBuildObjectIds.Length} technology-linked structures, {structureIconSources.Count} icons, production candidates, and official text for 17 locales to {output}");
    return 0;
}

if (mode == "dungeon")
{
    var dungeonTables = new Dictionary<string, string>
    {
        ["dungeon-levels.raw.json"] = "Pal/Content/Pal/DataTable/Dungeon/DT_DungeonLevelDataTable",
        ["dungeon-spawn-areas.raw.json"] = "Pal/Content/Pal/DataTable/Dungeon/DT_DungeonSpawnAreaDataTable",
        ["dungeon-enemy-spawns.raw.json"] = "Pal/Content/Pal/DataTable/Dungeon/DT_DungeonEnemySpawnDataTable",
        ["dungeon-item-lottery.raw.json"] = "Pal/Content/Pal/DataTable/Dungeon/DT_DungeonItemLotteryDataTable",
        ["dungeon-reward-lottery.raw.json"] = "Pal/Content/Pal/DataTable/Dungeon/DT_DungeonRewardSpawnerLotteryDataTable",
        ["field-lottery-names.raw.json"] = "Pal/Content/Pal/DataTable/Common/DT_FieldLotteryNameDataTable",
        ["item-lottery.raw.json"] = "Pal/Content/Pal/DataTable/Item/DT_ItemLotteryDataTable",
        ["item-pickups.raw.json"] = "Pal/Content/Pal/DataTable/Item/DT_ItemPickupDataTable",
        ["map-object-lottery.raw.json"] = "Pal/Content/Pal/DataTable/MapObject/DT_MapObjectLotteryDataTable"
    };
    var dumpedDungeonTables = dungeonTables.ToDictionary(table => table.Key, table => JObject.FromObject(DumpTable(table.Value)));
    foreach (var table in dumpedDungeonTables) Write(table.Key, table.Value);
    Write("dungeon-names.raw.json", DumpLocalizedTextFamily("DT_DungeonNameText", "Pal/Content/Pal/DataTable/Text/DT_DungeonNameText"));
    Write("map-object-names.raw.json", DumpLocalizedTextFamily("DT_MapObjectNameText_Common", "Pal/Content/Pal/DataTable/Text/DT_MapObjectNameText"));
    Write("dungeon-reward-class-defaults.raw.json", DumpReferencedClassDefaults(dumpedDungeonTables["dungeon-reward-lottery.raw.json"]));
    Write("dungeon-level-actors.raw.json", DumpDungeonLevelActors(dumpedDungeonTables["dungeon-levels.raw.json"]));
    var dungeonClassDefaults = new Dictionary<string, object>
    {
        ["portal-grass-1"] = DumpClassDefaults("Pal/Content/Pal/Blueprint/MapObject/Dungeon/BP_DungeonPortalMarker_Grass1.BP_DungeonPortalMarker_Grass1_C"),
        ["fixed-grass-1"] = DumpClassDefaults("Pal/Content/Pal/Blueprint/Dungeon/FixedDungeonEntrance/BP_DungeonFixedEntrance_grass_1.BP_DungeonFixedEntrance_grass_1_C"),
        ["fixed-grass-5"] = DumpClassDefaults("Pal/Content/Pal/Blueprint/Dungeon/FixedDungeonEntrance/BP_DungeonFixedEntrance_grass_5.BP_DungeonFixedEntrance_grass_5_C"),
        ["fixed-grass-6"] = DumpClassDefaults("Pal/Content/Pal/Blueprint/Dungeon/FixedDungeonEntrance/BP_DungeonFixedEntrance_grass_6.BP_DungeonFixedEntrance_grass_6_C"),
        ["fixed-grass-7"] = DumpClassDefaults("Pal/Content/Pal/Blueprint/Dungeon/FixedDungeonEntrance/BP_DungeonFixedEntrance_grass_7.BP_DungeonFixedEntrance_grass_7_C")
    };
    Write("dungeon-class-defaults.raw.json", dungeonClassDefaults);
    Write("dungeon-data-assets.raw.json", provider.Files.Keys
        .Where(path => path.Contains("/DataTable/", StringComparison.OrdinalIgnoreCase))
        .Where(path => new[] { "Dungeon", "Lottery", "Treasure", "Reward", "Pickup", "ItemField" }
            .Any(keyword => path.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
        .OrderBy(path => path).ToArray());
    var pakFiles = Directory.EnumerateFiles(paks, "*", SearchOption.TopDirectoryOnly)
        .Select(path => new FileInfo(path))
        .OrderBy(file => file.Name)
        .Select(file => new { file.Name, file.Length, file.LastWriteTimeUtc })
        .ToArray();
    var mappingHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(File.ReadAllBytes(mappings)));
    Write("dungeon-manifest.json", new { schema = 2, mode, extractedAt = DateTimeOffset.UtcNow, mappingHash, pakFiles, tables = dungeonTables.Keys.OrderBy(value => value).ToArray(), derivedRawFiles = new[] { "dungeon-level-actors.raw.json", "dungeon-reward-class-defaults.raw.json", "map-object-names.raw.json" }, localeCount = 17 });
    Console.WriteLine($"Extracted {dungeonTables.Count} dungeon tables, referenced reward classes, dungeon level actors, and official text for 17 locales to {output}");
    return 0;
}

if (mode == "npc")
{
    var npcTables = new Dictionary<string, string>
    {
        ["unique-npcs.raw.json"] = "Pal/Content/Pal/DataTable/Character/DT_UniqueNPC",
        ["item-shop-create.raw.json"] = "Pal/Content/Pal/DataTable/ItemShop/DT_ItemShopCreateData",
        ["item-shop-lottery.raw.json"] = "Pal/Content/Pal/DataTable/ItemShop/DT_ItemShopLotteryData",
        ["item-shop-settings.raw.json"] = "Pal/Content/Pal/DataTable/ItemShop/DT_ItemShopSettingData",
        ["pal-shop-create.raw.json"] = "Pal/Content/Pal/DataTable/PalShop/DT_PalShopCreateData",
        ["npc-talk-flow.raw.json"] = "Pal/Content/Pal/DataTable/NPCTalk/DT_NPCTalkFlow",
        ["achievement-reward-npcs.raw.json"] = "Pal/Content/Pal/DataTable/Item/DT_AchivementRewardNPC",
        ["item-request-npcs.raw.json"] = "Pal/Content/Pal/DataTable/Item/DT_ItemRequestNPCData",
        ["pal-display-npcs.raw.json"] = "Pal/Content/Pal/DataTable/Item/DT_PalDisplayNPCData",
        ["npc-emote-lottery.raw.json"] = "Pal/Content/Pal/DataTable/Item/DT_NPCEmoteLotteryDataTable"
    };
    foreach (var table in npcTables) Write(table.Key, DumpTable(table.Value));
    Write("human-names.raw.json", DumpLocalizedTextFamily("DT_HumanNameText_Common", "Pal/Content/Pal/DataTable/Text/DT_HumanNameText"));
    Write("unique-npc-text.raw.json", DumpLocalizedTextFamily("DT_UniqueNPCText_Common", "Pal/Content/Pal/DataTable/Text/DT_UniqueNPCText"));
    Write("npc-talk-text.raw.json", DumpLocalizedTextFamily("DT_NpcTalkText_Common", "Pal/Content/Pal/DataTable/Text/DT_NpcTalkText"));
    Write("npc-data-assets.raw.json", provider.Files.Keys
        .Where(path => path.Contains("/DataTable/", StringComparison.OrdinalIgnoreCase))
        .Where(path => new[] { "NPC", "Human", "Merchant", "Trader", "Shop", "Quest", "Talk", "Dialog", "Bounty" }
            .Any(keyword => path.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
        .OrderBy(path => path).ToArray());
    var pakFiles = Directory.EnumerateFiles(paks, "*", SearchOption.TopDirectoryOnly)
        .Select(path => new FileInfo(path))
        .OrderBy(file => file.Name)
        .Select(file => new { file.Name, file.Length, file.LastWriteTimeUtc })
        .ToArray();
    var mappingHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(File.ReadAllBytes(mappings)));
    Write("npc-manifest.json", new { schema = 1, mode, extractedAt = DateTimeOffset.UtcNow, mappingHash, pakFiles, tables = npcTables.Keys.OrderBy(value => value).ToArray(), localeCount = 17 });
    Console.WriteLine($"Extracted {npcTables.Count} NPC tables and official NPC text for 17 locales to {output}");
    return 0;
}

Write("items.raw.json", DumpTable("Pal/Content/Pal/DataTable/Item/DT_ItemDataTable"));
Write("recipes.raw.json", DumpTable("Pal/Content/Pal/DataTable/Item/DT_ItemRecipeDataTable"));
Write("map.raw.json", DumpTable("Pal/Content/Pal/DataTable/WorldMapUIData/DT_WorldMapUIData"));
Write("boss-spawns.raw.json", DumpTable("Pal/Content/Pal/DataTable/UI/DT_BossSpawnerLoactionData"));
Write("pal-spawner-placement.raw.json", DumpTable("Pal/Content/Pal/DataTable/Spawner/DT_PalSpawnerPlacement"));
Write("pal-wild-spawners.raw.json", DumpTable("Pal/Content/Pal/DataTable/Spawner/DT_PalWildSpawner"));
Write("pal-parameters.raw.json", DumpTable("Pal/Content/Pal/DataTable/Character/DT_PalMonsterParameter"));
Write("pal-drops.raw.json", DumpTable("Pal/Content/Pal/DataTable/Character/DT_PalDropItem"));
Write("pal-drops-common.raw.json", DumpTable("Pal/Content/Pal/DataTable/Character/DT_PalDropItem_Common"));

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
