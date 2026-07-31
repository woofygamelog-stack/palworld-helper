local MOD_NAME = "ElementDamageVerifier"
local GAME_SETTING_ASSET = "/Game/Pal/Blueprint/System/BP_PalGameSetting"
local GAME_SETTING_CDO = GAME_SETTING_ASSET .. ".Default__BP_PalGameSetting_C"
local WEAK_SCALE_HOOK = GAME_SETTING_ASSET .. ".BP_PalGameSetting_C:GetWeakScale"
local POLL_INTERVAL_MS = 250
local START_DELAY_ATTEMPTS = 40
local MAX_ATTEMPTS = 240

local attempts = 0
local completed = false
local spawn_requested = false
local spawned_defender = nil
local spawn_failure = nil
local current_case = nil
local aggregation_count = 0

local function log(message)
    print(string.format("[%s] PAL_ELEMENT_PROBE|%s\n", MOD_NAME, message))
end

local function is_valid(value)
    if not value then return false end
    local ok, result = pcall(function() return value:IsValid() end)
    return ok and result == true
end

local function unwrap(value)
    if type(value) == "number" then return value end
    local ok, result = pcall(function() return value:get() end)
    return ok and result or value
end

local function object_name(value)
    local ok, result = pcall(function() return value:GetFullName() end)
    return ok and tostring(result) or "nil"
end

local function get_game_setting()
    local find_ok, value = pcall(StaticFindObject, GAME_SETTING_CDO)
    return find_ok and is_valid(value) and value or nil
end

local function request_disposable_defender()
    if spawn_requested then return end
    spawn_requested = true
    ExecuteInGameThread(function()
        local ok, actor_or_error = pcall(function()
            local actor_class = nil
            for _, candidate in ipairs({
                { "/Game/Pal/Blueprint/Character/Monster/BP_MonsterBase", "BP_MonsterBase_C" },
                { "/Game/Pal/Blueprint/Character/Monster/PalActorBP/Alpaca/BP_Alpaca", "BP_Alpaca_C" },
            }) do
                LoadAsset(candidate[1])
                local direct = StaticFindObject(candidate[1] .. "." .. candidate[2])
                if is_valid(direct) then actor_class = direct break end
                local found = FindObjects(0, nil, candidate[2], 0, 0, false)
                if found then
                    for _, value in ipairs(found) do
                        if is_valid(value) and value:IsClass() then actor_class = value break end
                    end
                end
                if is_valid(actor_class) then break end
            end
            local world = FindFirstOf("World")
            local statics_class = StaticFindObject("/Script/Engine.GameplayStatics")
            local gameplay = is_valid(statics_class) and statics_class:GetCDO() or nil
            if not is_valid(actor_class) or not is_valid(world) or not is_valid(gameplay) then
                error(string.format("spawn prerequisites missing: %s / %s / %s", object_name(actor_class), object_name(world), object_name(gameplay)))
            end
            local transform = {
                Rotation = { X = 0.0, Y = 0.0, Z = 0.0, W = 1.0 },
                Translation = { X = 0.0, Y = 0.0, Z = 50000.0 },
                Scale3D = { X = 1.0, Y = 1.0, Z = 1.0 },
            }
            local deferred = gameplay:BeginDeferredActorSpawnFromClass(world, actor_class, transform, 1, nil)
            if not is_valid(deferred) then error("deferred actor spawn failed") end
            local actor = gameplay:FinishSpawningActor(deferred, transform)
            if not is_valid(actor) then error("finished actor spawn failed") end
            return actor
        end)
        if ok and is_valid(actor_or_error) then
            spawned_defender = actor_or_error
            log("spawn|" .. object_name(spawned_defender))
        else
            spawn_failure = tostring(actor_or_error):gsub("[\r\n|]", " ")
            log("error|spawn|" .. spawn_failure)
        end
    end)
end

local function run_verification(game_setting)
    local utility_class = StaticFindObject("/Script/Pal.PalUtility")
    local utility = is_valid(utility_class) and utility_class:GetCDO() or nil
    if not is_valid(utility) then error("PalUtility CDO is unavailable") end

    local lookup_count = 0
    for weak_count = -2, 2 do
        local observed = tonumber(unwrap(game_setting:GetWeakScale(weak_count)))
        if not observed then error("GetWeakScale returned a non-numeric result") end
        lookup_count = lookup_count + 1
        log(string.format("lookup|%d|%.9g", weak_count, observed))
    end

    RegisterHook(WEAK_SCALE_HOOK, function(_, weak_count)
        if current_case then
            local observed = tonumber(unwrap(weak_count))
            if observed == nil then error("GetWeakScale hook received a non-numeric weakCount") end
            aggregation_count = aggregation_count + 1
            log(string.format("aggregation|%d|%d|%d|%d", current_case.attacker, current_case.defender1, current_case.defender2, observed))
        end
    end)

    local defender_sets = {}
    for defender = 1, 9 do defender_sets[#defender_sets + 1] = { defender, 0 } end
    for left = 1, 9 do
        for right = left + 1, 9 do defender_sets[#defender_sets + 1] = { left, right } end
    end
    for attacker = 1, 9 do
        for _, defenders in ipairs(defender_sets) do
            current_case = { attacker = attacker, defender1 = defenders[1], defender2 = defenders[2] }
            local damage_info = {
                AttackElementType = attacker,
                Attacker = spawned_defender,
                BasePower = 10000,
                AttackerLevel = 1,
                NativeDamageValue = 0,
                bApplyNativeDamageValue = false,
                DamageRatePerCollision = 1.0,
                NoDamage = false,
            }
            local character_info = {
                DefenderDefence = 100,
                DefenderElementType1 = defenders[1],
                DefenderElementType2 = defenders[2],
                DefenderLevel = 1,
                ElementStatusMultiplay = 1.0,
                OtomoRate = 1.0,
            }
            local out = {}
            utility:CalcDamageCharacter(damage_info, spawned_defender, character_info, out)
        end
    end
    current_case = nil
    if aggregation_count ~= 405 then error("CalcDamageCharacter did not route all 405 cases through GetWeakScale") end
    log(string.format("complete|%d|%d", lookup_count, aggregation_count))
end

local function poll()
    if completed then return true end
    attempts = attempts + 1
    if attempts < START_DELAY_ATTEMPTS then return false end
    if spawn_failure then
        completed = true
        return true
    end
    local game_setting = get_game_setting()
    if not is_valid(game_setting) then return false end
    if not is_valid(spawned_defender) then
        request_disposable_defender()
        if attempts >= MAX_ATTEMPTS then
            log("error|timeout|disposable defender was not ready")
            completed = true
            return true
        end
        return false
    end
    local ok, error_message = pcall(run_verification, game_setting)
    if not ok then log("error|verification|" .. tostring(error_message):gsub("[\r\n|]", " ")) end
    completed = true
    return true
end

log("start")
LoopAsync(POLL_INTERVAL_MS, poll)
