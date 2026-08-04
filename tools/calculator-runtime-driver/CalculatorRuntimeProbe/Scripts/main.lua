local MOD_NAME = "CalculatorRuntimeProbe"
local POLL_INTERVAL_MS = 250
local START_DELAY_ATTEMPTS = 40
local MAX_ATTEMPTS = 240

local attempts = 0
local completed = false

local function log(message)
    print(string.format("[%s] PAL_CALCULATOR_PROBE|%s\n", MOD_NAME, message))
end

local function object_name(value)
    local ok, result = pcall(function() return value:GetFullName() end)
    return ok and tostring(result) or "nil"
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

local function relevant(name)
    if string.find(name, "/Script/Pal.", 1, true)
        and string.find(name, "Spawn", 1, true)
        and (string.find(name, "Character", 1, true)
            or string.find(name, "Monster", 1, true)
            or string.find(name, "NPC", 1, true)
            or string.find(name, "Pal", 1, true)) then
        return true
    end
    if string.find(name, "/Script/Pal.PalCharacterManager:", 1, true)
        or string.find(name, "/Script/Pal.PalIndividualCharacterHandle:", 1, true) then
        return true
    end
    if string.find(name, "/Script/Pal.PalCharacter:", 1, true)
        and (string.find(name, "Initialize", 1, true)
            or string.find(name, "Setup", 1, true)
            or string.find(name, "Individual", 1, true)) then
        return true
    end
    if string.find(name, "/Game/Pal/Blueprint/Character/Monster/PalActorBP/SheepBall/BP_SheepBall", 1, true) then
        return true
    end
    for _, token in ipairs({
        "/Script/Pal.PalBreedingUtility:", ":CalcCaptureRate", ":CalcCaptureRateByStatus",
        ":GetCaptureRate_ByCharacterID", ":GetCaptureRateByStatus_ForGameSettingBP",
        ":GetHPBySaveParameter", ":GetMeleeAttackBySaveParameter", ":GetShotAttackBySaveParameter",
        ":GetDefenseBySaveParameter", ":GetSaveParameterValue_Talent_HP",
        ":GetCraftSpeedBySaveParameter", ":GetSupportBySaveParameter",
        ":GetSaveParameterValue_Talent_Shot", ":GetSaveParameterValue_Talent_Defense",
        ":GetSaveParameterValue_Level", ":GetSaveParameterValue_Rank", ":GetSaveParameterValue_Rank_HP",
        ":GetSaveParameterValue_Rank_Attack", ":GetSaveParameterValue_Rank_Defence",
        "/Script/Pal.PalIndividualCharacterParameterUtility:CraftSpeed",
        ":CalcCharacterWorkSpeed", ":CalcPlayerWorkAmountBySec", ":CalcWorkAmount",
        ":GetCraftSpeed_WorkSuitability", ":GetCraftSpeed_withBuff_WorkSuitability",
        ":GetCraftSpeedByWorkSuitability", ":GetWorkSpeed", ":GetWorkSpeedRank",
        ":GetWorkSuitabilityRank", ":GetRankBasedWorkSuitabilityBonus",
        "/Script/Pal.PalIndividualCharacterParameter:GetMaxHP",
        "/Script/Pal.PalIndividualCharacterParameter:GetShotAttack",
        "/Script/Pal.PalIndividualCharacterParameter:GetDefense",
        "/Script/Pal.PalIndividualCharacterParameter:GetCraftSpeed",
        "/Script/Pal.PalIndividualCharacterParameter:SetStatusPoint",
        ":GetIndividualCharacterParameterByActor", ":GetIndividualCharacterHandleByActor"
        , ":CreateIndividual", ":CreateIndividualByFixedID", ":SetupSaveParameter",
        ":GetInitializedOtomoSaveParameter", ":GetCharacterParameterStorageSubsystem",
        ":GetDatabaseCharacterParameter", ":SetHPByRateToCharacter", ":SetHPByRateToHandle",
        ":SetHPPercent", ":GetHP", ":GetLevel"
    }) do
        if string.find(name, token, 1, true) then return true end
    end
    return false
end

local function inventory()
    for _, asset in ipairs({
        "/Game/Pal/Blueprint/System/BP_PalGameSetting",
        "/Game/Pal/Blueprint/Character/Component/BP_PalCharacterParameterStorageSubsystem",
        "/Game/Pal/Blueprint/Character/Component/BP_PalDatabaseCharacterParameter",
        "/Game/Pal/Blueprint/MapObject/BuildObject/BP_BuildObject_BreedFarm",
        "/Game/Pal/Blueprint/Character/Monster/PalActorBP/SheepBall/BP_SheepBall.BP_SheepBall_C"
    }) do
        pcall(LoadAsset, asset)
    end

    local game_setting = StaticFindObject("/Game/Pal/Blueprint/System/BP_PalGameSetting.Default__BP_PalGameSetting_C")
    if not is_valid(game_setting) then error("Pal game-setting CDO is unavailable") end
    for _, property in ipairs({
        "RarePal_CaptureLevelDecrease", "AddCaptureLevelPerStatusPoint",
        "WorkAmountByManMonth", "WorkAnimSpeedPower", "AddWorkSpeedPerStatusPoint"
    }) do
        local ok, value = pcall(function() return unwrap(game_setting[property]) end)
        if not ok then error("failed to read game-setting property: " .. property) end
        log(string.format("constant|%s|%.17g", property, tonumber(value)))
    end

    local function_count = 0
    local functions_ok, functions = pcall(FindAllOf, "Function")
    if not functions_ok or not functions then error("FindAllOf(Function) failed") end
    for _, value in ipairs(functions) do
        local name = object_name(value)
        if relevant(name) then
            function_count = function_count + 1
            log("function|" .. name:gsub("[\r\n|]", " "))
            local property_count = 0
            local properties_ok, property_error = pcall(function()
                value:ForEachProperty(function(property)
                    property_count = property_count + 1
                    local flags = "unavailable"
                    local flags_ok, flags_value = pcall(function() return property:GetPropertyFlags() end)
                    if flags_ok then flags = tostring(flags_value) end
                    local value_type = ""
                    local type_ok, type_value = pcall(function()
                        local property_class = property:GetClass():GetFName():ToString()
                        if property_class == "StructProperty" then return property:GetStruct():GetFullName() end
                        if property_class == "ObjectProperty" then return property:GetPropertyClass():GetFullName() end
                        return ""
                    end)
                    if type_ok then value_type = tostring(type_value) end
                    log(string.format(
                        "parameter|%s|%d|%s|%s|%s|%s",
                        name:gsub("[\r\n|]", " "),
                        property_count,
                        property:GetClass():GetFName():ToString(),
                        property:GetFName():ToString(),
                        flags,
                        value_type:gsub("[\r\n|]", " ")
                    ))
                end)
            end)
            if not properties_ok then log("parameter-error|" .. name:gsub("[\r\n|]", " ") .. "|" .. tostring(property_error):gsub("[\r\n|]", " ")) end
        end
    end

    local selected_structs = {
        ["ScriptStruct /Script/Pal.PalIndividualCharacterSaveParameter"] = true,
        ["ScriptStruct /Script/Pal.NetworkActorSpawnParameters"] = true,
        ["ScriptStruct /Script/Pal.PalInstanceID"] = true
    }
    local structs_ok, structs = pcall(FindAllOf, "ScriptStruct")
    if not structs_ok or not structs then error("FindAllOf(ScriptStruct) failed") end
    for _, struct in ipairs(structs) do
        local struct_name = object_name(struct)
        if selected_structs[struct_name] then
            struct:ForEachProperty(function(property)
                local property_class = property:GetClass():GetFName():ToString()
                local value_type = ""
                local type_ok, type_value = pcall(function()
                    if property_class == "StructProperty" then return property:GetStruct():GetFullName() end
                    if property_class == "ObjectProperty" or property_class == "ClassProperty" then
                        return property:GetPropertyClass():GetFullName()
                    end
                    if property_class == "ArrayProperty" or property_class == "SetProperty" then
                        return property:GetInner():GetClass():GetFName():ToString()
                    end
                    if property_class == "MapProperty" then
                        return property:GetKeyProp():GetClass():GetFName():ToString()
                            .. ":" .. property:GetValueProp():GetClass():GetFName():ToString()
                    end
                    return ""
                end)
                if type_ok then value_type = tostring(type_value) end
                log(string.format(
                    "struct-property|%s|%s|%s|%s",
                    struct_name:gsub("[\r\n|]", " "),
                    property_class,
                    property:GetFName():ToString(),
                    value_type:gsub("[\r\n|]", " ")
                ))
            end)
        end
    end

    log(string.format("complete|%d", function_count))
end

local function poll()
    if completed then return true end
    attempts = attempts + 1
    if attempts < START_DELAY_ATTEMPTS then return false end
    local ok, error_message = pcall(inventory)
    if ok then
        completed = true
        return true
    end
    if attempts >= MAX_ATTEMPTS then
        log("error|" .. tostring(error_message):gsub("[\r\n|]", " "))
        completed = true
        return true
    end
    return false
end

log("start")
LoopAsync(POLL_INTERVAL_MS, poll)
