local MOD_NAME = "CalculatorInitializedParameterEvidence"
local POLL_INTERVAL_MS = 250
local MAX_ATTEMPTS = 3600

local completed = false
local attempts = 0
local pending_handles = {}

local function log(message)
    print(string.format("[%s] PAL_INITIALIZED_PARAMETER|%s\n", MOD_NAME, message))
end

local function is_valid(value)
    if not value then return false end
    local ok, result = pcall(function() return value:IsValid() end)
    return ok and result == true
end

local function unwrap(value)
    if type(value) == "number" or type(value) == "boolean" or type(value) == "string" then return value end
    local ok, result = pcall(function() return value:get() end)
    return ok and result or value
end

local function clean(value)
    return tostring(unwrap(value)):gsub("[\r\n|]", " ")
end

local function remember_return_value(...)
    local values = { ... }
    for index = #values, 1, -1 do
        local candidate = unwrap(values[index])
        if is_valid(candidate) then
            local ok = pcall(function() candidate:TryGetIndividualParameter() end)
            if ok then
                pending_handles[#pending_handles + 1] = candidate
                log("handle|" .. clean(candidate))
                return
            end
        end
    end
end

local function inspect_parameter(parameter, handle)
    local original_friendship = tonumber(unwrap(parameter:GetFriendshipPoint()))
    if original_friendship == nil then error("friendship getter returned a non-numeric value") end

    local baseline_hp = tonumber(unwrap(parameter:GetMaxHP()))
    local baseline_attack = tonumber(unwrap(parameter:GetShotAttack()))
    local baseline_defense = tonumber(unwrap(parameter:GetDefense()))
    if not baseline_hp or not baseline_attack or not baseline_defense then
        error("baseline stat getter returned a non-numeric value")
    end
    log(string.format(
        "observed|%d|%d|%d|%d",
        original_friendship,
        baseline_hp,
        baseline_attack,
        baseline_defense
    ))
    local save = parameter.SaveParameter
    local original = {
        level = unwrap(save.Level), rank = unwrap(save.Rank),
        hp_soul = unwrap(save.Rank_HP), attack_soul = unwrap(save.Rank_Attack), defense_soul = unwrap(save.Rank_Defence),
        hp_talent = unwrap(save.Talent_HP), attack_talent = unwrap(save.Talent_Shot), defense_talent = unwrap(save.Talent_Defense),
    }
    local character_id_ok, character_id = pcall(function() return save.CharacterID:ToString() end)
    local character_id_text = character_id_ok and tostring(character_id) or "unknown"
    local is_human = character_id_text == "Player"
        or string.find(character_id_text, "Soldier", 1, true)
        or string.find(character_id_text, "Human", 1, true)
        or string.find(character_id_text, "NPC", 1, true)
        or string.find(character_id_text, "Hunter", 1, true)
        or string.find(character_id_text, "Merchant", 1, true)
    if is_human then
        log("skipped|" .. clean(character_id_text))
        return false
    end
    log(string.format(
        "profile|%s|%d|%d|%d|%d|%d|%d|%d|%d",
        clean(character_id_text),
        original.level, original.rank, original.hp_soul, original.attack_soul, original.defense_soul,
        original.hp_talent, original.attack_talent, original.defense_talent
    ))
    local points = { -10000, -1000, -1, 0, 5999, 6000, 12999, 13000, 20999, 21000, 29999, 30000, 39999, 40000, 54999, 55000, 79999, 80000, 109999, 110000, 149999, 150000, 199999, 200000 }
    local changed = false
    local ok, message = pcall(function()
        for _, point in ipairs(points) do
            save.FriendshipPoint = point
            local actual_point = tonumber(unwrap(parameter:GetFriendshipPoint()))
            local rank = tonumber(unwrap(parameter:GetFriendshipRank()))
            local hp = tonumber(unwrap(parameter:GetMaxHP()))
            local attack = tonumber(unwrap(parameter:GetShotAttack()))
            local defense = tonumber(unwrap(parameter:GetDefense()))
            if actual_point == nil or rank == nil or not hp or not attack or not defense then
                error("post-initialization lookup returned a non-numeric value")
            end
            if actual_point ~= original_friendship then changed = true end
            log(string.format("friendship|%d|%d|%d|%d|%d|%d", point, actual_point, rank, hp, attack, defense))
        end
    end)
    pcall(function()
        save.FriendshipPoint = original_friendship
        save.Level = original.level
        save.Rank = original.rank
        save.Rank_HP = original.hp_soul
        save.Rank_Attack = original.attack_soul
        save.Rank_Defence = original.defense_soul
        save.Talent_HP = original.hp_talent
        save.Talent_Shot = original.attack_talent
        save.Talent_Defense = original.defense_talent
    end)
    if not ok then error(message) end
    if not changed then error("initialized SaveParameter did not change FriendshipPoint") end
    completed = true
    log("complete")
    return true
end

local function poll()
    if completed then return true end
    attempts = attempts + 1
    for index = #pending_handles, 1, -1 do
        local handle = pending_handles[index]
        if is_valid(handle) then
            local ok, parameter = pcall(function() return handle:TryGetIndividualParameter() end)
            if ok and is_valid(parameter) then
                table.remove(pending_handles, index)
                local inspect_ok, message = pcall(function() inspect_parameter(parameter, handle) end)
                if not inspect_ok then log("error|" .. clean(message)) end
                if completed then return true end
            end
        else
            table.remove(pending_handles, index)
        end
    end
    if attempts >= MAX_ATTEMPTS then
        log("error|timed out waiting for an initialized individual parameter")
        return true
    end
    return false
end

log("start")
local function before_create() end
RegisterHook("/Script/Pal.PalCharacterManager:CreateIndividual", before_create, remember_return_value)
RegisterHook("/Script/Pal.PalCharacterManager:CreateIndividualByFixedID", before_create, remember_return_value)
RegisterHook("/Script/Pal.PalCharacterManager:SpawnNewCharacter", before_create, remember_return_value)
LoopAsync(POLL_INTERVAL_MS, poll)
