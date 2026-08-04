local MOD_NAME = "CalculatorRuntimeEvidence"
local POLL_INTERVAL_MS = 250
local START_DELAY_ATTEMPTS = 40
local MAX_ATTEMPTS = 1200

local attempts = 0
local completed = false
local run_in_flight = false
local last_error = nil

local function log(message)
    print(string.format("[%s] PAL_CALCULATOR_EVIDENCE|%s\n", MOD_NAME, message))
end

local function is_valid(value)
    if not value then return false end
    local ok, result = pcall(function() return value:IsValid() end)
    return ok and result == true
end

local function unwrap(value)
    if type(value) == "number" or type(value) == "boolean" then return value end
    local ok, result = pcall(function() return value:get() end)
    return ok and result or value
end

local function cdo(class_path)
    local class = StaticFindObject(class_path)
    return is_valid(class) and class:GetCDO() or nil
end

local function run_static_observations(game_setting)
    for _, property in ipairs({
        "StatusCalculate_LevelMultiply_HP", "StatusCalculate_ConstPlus_HP",
        "StatusCalculate_LevelMultiply_Attack", "StatusCalculate_ConstPlus_Attack",
        "StatusCalculate_LevelMultiply_Defense", "StatusCalculate_ConstPlus_Defense",
        "StatusCalculate_TribeMultiply_CraftSpeed", "StatusCalculate_GenkaiToppa_PerAdd",
        "StatusCalculate_Talent_PerAdd", "WorkAmountByManMonth", "WorkAnimSpeedPower",
        "AddWorkSpeedPerStatusPoint"
    }) do
        local ok, value = pcall(function() return unwrap(game_setting[property]) end)
        log(string.format("constant|%s|%s|%s", property, tostring(ok), tostring(value)))
    end

end

local function name_text(value)
    local ok, result = pcall(function() return value:ToString() end)
    return ok and tostring(result) or tostring(unwrap(value))
end

local function collect_live_parameters()
    local ok, values = pcall(FindAllOf, "PalIndividualCharacterParameter")
    if not ok or not values then return {} end
    local result = {}
    for _, parameter in ipairs(values) do
        if is_valid(parameter) then
            local read_ok, sample = pcall(function()
                local actor = parameter:GetIndividualActor()
                local id = name_text(parameter:GetCharacterID())
                local level = tonumber(unwrap(parameter:GetLevel()))
                if is_valid(actor) and id ~= "None" and level and level > 0 then return { parameter = parameter, actor = actor, id = id, level = level } end
                return nil
            end)
            if read_ok and sample then result[#result + 1] = sample end
        end
    end
    return result
end

local function run_actor_observations(utility, database, game_setting, save_utility, samples)
    local observed = 0
    for _, sample in ipairs(samples) do
        if observed >= 30 then break end
        local ok, message = pcall(function()
            local parameter = sample.parameter
            local save = parameter:GetSaveParameter()
            local talent_hp = tonumber(unwrap(save_utility:GetSaveParameterValue_Talent_HP(save)))
            local talent_shot = tonumber(unwrap(save_utility:GetSaveParameterValue_Talent_Shot(save)))
            local talent_defense = tonumber(unwrap(save_utility:GetSaveParameterValue_Talent_Defense(save)))
            local rank = tonumber(unwrap(save_utility:GetSaveParameterValue_Rank(save)))
            local rank_hp = tonumber(unwrap(save_utility:GetSaveParameterValue_Rank_HP(save)))
            local rank_attack = tonumber(unwrap(save_utility:GetSaveParameterValue_Rank_Attack(save)))
            local rank_defense = tonumber(unwrap(save_utility:GetSaveParameterValue_Rank_Defence(save)))
            local hp = tonumber(unwrap(parameter:GetMaxHP()))
            local shot = tonumber(unwrap(parameter:GetShotAttack()))
            local defense = tonumber(unwrap(parameter:GetDefense()))
            local craft = tonumber(unwrap(parameter:GetCraftSpeed()))
            local db_hp = tonumber(unwrap(database:GetHPBySaveParameter(save)))
            local db_shot = tonumber(unwrap(database:GetShotAttackBySaveParameter(save)))
            local db_defense = tonumber(unwrap(database:GetDefenseBySaveParameter(save)))
            local db_craft = tonumber(unwrap(database:GetCraftSpeedBySaveParameter(save)))
            local work_speed = tonumber(unwrap(utility:GetWorkSpeed(sample.actor)))
            log(string.format(
                "stat|%s|%d|%d|%d|%d|%d|%d|%d|%d|%d|%d|%d|%d|%d|%d|%d|%.9g",
                sample.id, sample.level, talent_hp, talent_shot, talent_defense, rank, rank_hp, rank_attack, rank_defense,
                hp, shot, defense, craft, db_hp, db_shot, db_defense, work_speed
            ))
            if hp ~= db_hp or shot ~= db_shot or defense ~= db_defense then error("live and database stat routes disagree") end
        end)
        if ok then observed = observed + 1 else log("sample-error|" .. sample.id .. "|" .. tostring(message):gsub("[\r\n|]", " ")) end
    end
    if observed < 1 then error("no initialized Pal parameters are available") end

    local target = samples[1]
    local handle = utility:GetIndividualCharacterHandleByActor(target.actor)
    if not is_valid(handle) then error("capture target handle is unavailable") end
    for _, hp_rate in ipairs({ 1.0, 0.5, 0.1 }) do
        utility:SetHPByRateToCharacter(target.actor, hp_rate)
        local status_rate = tonumber(unwrap(utility:CalcCaptureRateByStatus(target.actor)))
        for _, sphere_level in ipairs({ 7.0, 20.0, 38.0, 50.0 }) do
            local rate = tonumber(unwrap(game_setting:CalcCaptureRate(sphere_level, handle, handle, false)))
            log(string.format("capture|%s|%d|%.3g|%.3g|%.9g|%.9g", target.id, target.level, hp_rate, sphere_level, status_rate, rate))
        end
    end
end

local function run_constructed_observations(database)
    local cases = {
        { id = "SheepBall", level = 1, talent = 0, rank = 0, soul = 0 },
        { id = "SheepBall", level = 1, talent = 100, rank = 0, soul = 0 },
        { id = "SheepBall", level = 50, talent = 0, rank = 0, soul = 0 },
        { id = "SheepBall", level = 50, talent = 50, rank = 0, soul = 0 },
        { id = "SheepBall", level = 65, talent = 100, rank = 0, soul = 0 },
        { id = "SheepBall", level = 65, talent = 100, rank = 4, soul = 0 },
        { id = "SheepBall", level = 65, talent = 100, rank = 0, soul = 4 },
        { id = "SheepBall", level = 65, talent = 100, rank = 4, soul = 4 },
        { id = "BlackMetalDragon", level = 1, talent = 0, rank = 0, soul = 0 },
        { id = "BlackMetalDragon", level = 65, talent = 100, rank = 4, soul = 4 },
    }
    for _, case in ipairs(cases) do
        local save = {
            CharacterID = FName(case.id),
            Level = case.level,
            Talent_HP = case.talent,
            Talent_Shot = case.talent,
            Talent_Defense = case.talent,
            Rank = case.rank,
            Rank_HP = case.soul,
            Rank_Attack = case.soul,
            Rank_Defence = case.soul,
            Rank_CraftSpeed = case.soul,
        }
        log(string.format("constructed-start|%s|%d|%d|%d|%d", case.id, case.level, case.talent, case.rank, case.soul))
        local hp = tonumber(unwrap(database:GetHPBySaveParameter(save)))
        local shot = tonumber(unwrap(database:GetShotAttackBySaveParameter(save)))
        local defense = tonumber(unwrap(database:GetDefenseBySaveParameter(save)))
        local craft = tonumber(unwrap(database:GetCraftSpeedBySaveParameter(save)))
        log(string.format("constructed-stat|%s|%d|%d|%d|%d|%d|%d|%d|%d", case.id, case.level, case.talent, case.rank, case.soul, hp, shot, defense, craft))
    end
end

local function run()
    local utility = cdo("/Script/Pal.PalUtility")
    local game_setting = StaticFindObject("/Game/Pal/Blueprint/System/BP_PalGameSetting.Default__BP_PalGameSetting_C")
    if not is_valid(utility) or not is_valid(game_setting) then error("core runtime objects are unavailable") end
    local world = nil
    local database = nil
    local worlds_ok, worlds = pcall(FindAllOf, "World")
    if worlds_ok and worlds then
        for _, candidate in ipairs(worlds) do
            local ok, value = pcall(function() return utility:GetDatabaseCharacterParameter(candidate) end)
            if ok and is_valid(value) then
                world = candidate
                database = value
                break
            end
        end
    end
    if not is_valid(world) or not is_valid(database) then error("character parameter database is unavailable") end
    local save_utility = cdo("/Script/Pal.PalIndividualCharacterSaveParameterUtility")
    if not is_valid(save_utility) then error("save parameter utility is unavailable") end
    run_static_observations(game_setting)
    run_constructed_observations(database)
    local samples = collect_live_parameters()
    if #samples > 0 then run_actor_observations(utility, database, game_setting, save_utility, samples) end
    log("complete")
end

local function poll()
    if completed then return true end
    attempts = attempts + 1
    if attempts < START_DELAY_ATTEMPTS then return false end
    if not run_in_flight then
        run_in_flight = true
        ExecuteInGameThread(function()
            local ok, error_message = pcall(run)
            run_in_flight = false
            if ok then
                completed = true
            else
                last_error = tostring(error_message):gsub("[\r\n|]", " ")
                log("retry-error|" .. last_error)
            end
        end)
    end
    if attempts >= MAX_ATTEMPTS then
        log("error|runtime|" .. tostring(last_error))
        completed = true
        return true
    end
    return completed
end

log("start")
LoopAsync(POLL_INTERVAL_MS, poll)
