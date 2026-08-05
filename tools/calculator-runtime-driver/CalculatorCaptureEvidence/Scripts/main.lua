local MOD_NAME = "CalculatorCaptureEvidence"
local POLL_INTERVAL_MS = 250
local MAX_ATTEMPTS = 3600

local completed = false
local attempts = 0
local handles = {}

local function log(message)
    print(string.format("[%s] PAL_CAPTURE_EVIDENCE|%s\n", MOD_NAME, message))
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

local function cdo(class_path)
    local class = StaticFindObject(class_path)
    return is_valid(class) and class:GetCDO() or nil
end

local function remember_handle(...)
    local values = { ... }
    for index = #values, 1, -1 do
        local wrapped = values[index]
        local candidate = unwrap(wrapped)
        if is_valid(candidate) then
            local ok = pcall(function() candidate:TryGetIndividualParameter() end)
            if ok then
                handles[#handles + 1] = candidate
                log("handle|" .. clean(candidate))
                return
            end
        end
    end
end

local function describe(handle)
    if not is_valid(handle) then return nil end
    local actor = handle:TryGetIndividualActor()
    if not is_valid(actor) then return nil end
    local parameter = handle:TryGetIndividualParameter()
    if not is_valid(parameter) then return nil end
    local save = parameter.SaveParameter
    local id_ok, id = pcall(function() return save.CharacterID:ToString() end)
    local level = tonumber(unwrap(parameter:GetLevel()))
    if not id_ok or not level or level < 1 then return nil end
    return {
        actor = actor,
        handle = handle,
        parameter = parameter,
        id = tostring(id),
        level = level,
        is_player = unwrap(save.IsPlayer) == true or tostring(id) == "Player",
    }
end

local function run_capture(target, thrower)
    local utility = cdo("/Script/Pal.PalUtility")
    local game_setting = StaticFindObject("/Game/Pal/Blueprint/System/BP_PalGameSetting.Default__BP_PalGameSetting_C")
    if not is_valid(utility) or not is_valid(game_setting) then error("capture runtime services are unavailable") end
    local case_count = 0
    for _, hp_rate in ipairs({ 1.0, 0.75, 0.5, 0.25, 0.1, 0.01 }) do
        utility:SetHPByRateToCharacter(target.actor, hp_rate)
        local status_rate = tonumber(unwrap(utility:CalcCaptureRateByStatus(target.actor)))
        if not status_rate then error("capture status calculation returned a non-numeric value") end
        for _, sphere_level in ipairs({ 0.0, 1.0, 7.0, 20.0, 38.0, 50.0, 100.0 }) do
            for _, sneak in ipairs({ false, true }) do
                local capture_rate = tonumber(unwrap(game_setting:CalcCaptureRate(sphere_level, target.handle, thrower.handle, sneak)))
                if not capture_rate then error("capture calculation returned a non-numeric value") end
                case_count = case_count + 1
                log(string.format("case|%s|%d|%s|%d|%.3g|%.3g|%s|%.9g|%.9g", target.id, target.level, thrower.id, thrower.level, hp_rate, sphere_level, tostring(sneak), status_rate, capture_rate))
            end
        end
    end
    utility:SetHPByRateToCharacter(target.actor, 1.0)
    log("coverage|" .. tostring(case_count))
    local save = target.parameter.SaveParameter
    local original_level = tonumber(unwrap(save.Level))
    if not original_level then error("target level is unavailable") end
    local level_case_count = 0
    for _, requested_level in ipairs({ 1, 2, 10, 50, 65, 80 }) do
        save.Level = requested_level
        local actual_level = tonumber(unwrap(target.parameter:GetLevel()))
        local capture_rate = tonumber(unwrap(game_setting:CalcCaptureRate(7.0, target.handle, thrower.handle, false)))
        if actual_level ~= requested_level or not capture_rate then error("target level boundary calculation failed") end
        level_case_count = level_case_count + 1
        log(string.format("level-case|%s|%d|%d|%.9g", target.id, requested_level, actual_level, capture_rate))
    end
    save.Level = original_level
    log("level-coverage|" .. tostring(level_case_count))
    log("complete")
    completed = true
end

local function poll()
    if completed then return true end
    attempts = attempts + 1
    local utility = cdo("/Script/Pal.PalUtility")
    if is_valid(utility) then
        local target = nil
        local thrower = nil
        local players_ok, players = pcall(FindAllOf, "PalPlayerCharacter")
        if players_ok and players then
            for _, player_actor in ipairs(players) do
                if is_valid(player_actor) then
                    local handle_ok, player_candidate = pcall(function() return utility:GetIndividualCharacterHandleByActor(player_actor) end)
                    if handle_ok and is_valid(player_candidate) then
                        local describe_ok, sample = pcall(function() return describe(player_candidate) end)
                        if describe_ok and sample then thrower = sample break end
                    end
                end
            end
        end
        for index = #handles, 1, -1 do
            local handle = handles[index]
            if not is_valid(handle) then
                table.remove(handles, index)
            else
                local ok, sample = pcall(function() return describe(handle) end)
                if ok and sample then
                    if not sample.is_player
                        and not string.find(sample.id, "Soldier", 1, true)
                        and not string.find(sample.id, "Human", 1, true)
                        and not string.find(sample.id, "NPC", 1, true)
                        and not string.find(sample.id, "Hunter", 1, true)
                        and not string.find(sample.id, "Merchant", 1, true) then target = sample end
                end
            end
        end
        if target and thrower then
            local ok, message = pcall(function() run_capture(target, thrower) end)
            if not ok then log("error|" .. clean(message)) end
            return completed
        end
    end
    if attempts >= MAX_ATTEMPTS then
        log("error|timed out waiting for live target and thrower actors")
        return true
    end
    return false
end

log("start")
local function before_create() end
RegisterHook("/Script/Pal.PalCharacterManager:CreateIndividual", before_create, remember_handle)
RegisterHook("/Script/Pal.PalCharacterManager:CreateIndividualByFixedID", before_create, remember_handle)
RegisterHook("/Script/Pal.PalCharacterManager:SpawnNewCharacter", before_create, remember_handle)
LoopAsync(POLL_INTERVAL_MS, poll)
