using CUE4Parse.Compression;
using CUE4Parse.FileProvider;
using CUE4Parse.MappingsProvider.Usmap;
using CUE4Parse.UE4.Assets.Exports.Actor;
using CUE4Parse.UE4.Assets.Exports.Component;
using CUE4Parse.UE4.Objects.Core.Math;
using CUE4Parse.UE4.Objects.Engine;
using CUE4Parse.UE4.Objects.UObject;
using CUE4Parse.UE4.Versions;
using Newtonsoft.Json;

if (args.Length < 3 || args.Length > 5)
{
    Console.Error.WriteLine("Usage: MapActorExtractor <Paks directory> <Mappings.usmap> <output directory> [offset] [limit]");
    return 2;
}

var paks = Path.GetFullPath(args[0]);
var mappings = Path.GetFullPath(args[1]);
var output = Path.GetFullPath(args[2]);
var offset = args.Length >= 4 ? int.Parse(args[3]) : 0;
var limit = args.Length >= 5 ? int.Parse(args[4]) : int.MaxValue;
if (!Directory.Exists(paks) || !File.Exists(mappings)) throw new FileNotFoundException("Required local game input was not found.");
Directory.CreateDirectory(output);

OodleHelper.Initialize(Path.Combine(AppContext.BaseDirectory, "oo2core_9_win64.dll"));
#pragma warning disable CS0618
var provider = new DefaultFileProvider(paks, SearchOption.AllDirectories, true, new VersionContainer(EGame.GAME_UE5_1));
#pragma warning restore CS0618
provider.MappingsContainer = new FileUsmapTypeMappingsProvider(mappings);
provider.Initialize();
provider.Mount();
provider.LoadVirtualPaths();

var packages = provider.Files.Keys
    .Where(path => path.EndsWith(".umap", StringComparison.OrdinalIgnoreCase))
    .Where(path => path.Contains("/_Generated_/", StringComparison.OrdinalIgnoreCase))
    .OrderBy(path => path)
    .ToArray();
var selected = packages.Skip(offset).Take(limit).ToArray();
var keywords = new[]
{
    "FastTravelPoint", "TowerFastTravel", "WarpAltar", "DungeonEntrance", "DungeonPortal", "DungeonExit", "DungeonFixedEntrance", "SealArea",
    "Bounty", "Wanted", "NPCSpawner", "Merchant", "Trader", "TreasureBoxSpawner", "ItemChest",
    "PalEgg", "Lifmunk", "Effigy", "SkillFruit", "MapObjectSpawner", "ResourceSpawner",
    "OreSpawner", "Coal", "Sulfur", "Quartz", "OilField", "Paldium", "Berry", "Mushroom", "MonoNPCSpawner",
    "FishingSpot", "RandomIncidentSpawner", "Statue", "Lifmunk", "ItemPickupTower", "PalLevelObject"
};
var typeCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
var actors = new List<object>();
var parsed = 0;
var failed = 0;
foreach (var mapPackage in selected)
{
    try
    {
        if (!provider.TryLoadPackage(mapPackage, out var package) || package is null) throw new InvalidDataException("Package could not be loaded.");
        var level = package.GetExports().OfType<ULevel>().FirstOrDefault();
        if (level is null) continue;
        parsed++;
        foreach (var actorIndex in level.Actors)
        {
            if (actorIndex is null) continue;
            var actor = actorIndex.Load<AActor>();
            if (actor is null) continue;
            var actorType = actor.ExportType ?? "Unknown";
            typeCounts[actorType] = typeCounts.GetValueOrDefault(actorType) + 1;
            var matching = keywords.Where(keyword => actorType.Contains(keyword, StringComparison.OrdinalIgnoreCase)).ToArray();
            if (matching.Length == 0) continue;
            FVector? location = null;
            try
            {
                var root = actor.Get<FPackageIndex>("RootComponent").Load<USceneComponent>();
                if (root is not null) location = root.GetComponentTransform().Translation;
            }
            catch { }
            actors.Add(new
            {
                package = mapPackage,
                actorType,
                actorName = actor.Name,
                matchingKeywords = matching,
                location,
                properties = actor.Properties.ToDictionary(property => property.Name.Text, property => property.Tag)
            });
        }
    }
    catch (Exception error)
    {
        failed++;
        if (failed <= 10) Console.Error.WriteLine($"Could not inspect {mapPackage}: {error.Message}");
    }
}
var result = new { totalPackageCount = packages.Length, offset, requestedLimit = limit, selectedPackageCount = selected.Length, parsedPackageCount = parsed, failedPackageCount = failed, typeCounts, actors };
File.WriteAllText(Path.Combine(output, $"world-actors-{offset:D5}-{selected.Length:D5}.raw.json"), JsonConvert.SerializeObject(result, Formatting.None));
Console.WriteLine($"Inspected {selected.Length} packages from {offset}; parsed {parsed}, failed {failed}, retained {actors.Count} actors.");
return 0;
