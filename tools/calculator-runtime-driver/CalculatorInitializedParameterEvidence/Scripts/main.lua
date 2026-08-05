local MOD_NAME = "CalculatorInitializedParameterEvidence"
local SETUP_HOOK = "/Script/Pal.PalDatabaseCharacterParameter:SetupSaveParameter"
local completed = false

local function log(message)
    print(string.format("[%s] PAL_INITIALIZED_PARAMETER|%s\n", MOD_NAME, message))
end

local function unwrap(value)
    if type(value) == "number" or type(value) == "boolean" or type(value) == "string" then return value end
    local ok, result = pcall(function() return value:get() end)
    return ok and result or value
end

local function clean(value)
    return tostring(value):gsub("[\r\n|]", " ")
end

local function inspect_initialized_parameter(context, character_id, level, _, out_parameter)
    if completed then return end
    local ok, message = pcall(function()
        local database = unwrap(context)
        local save = unwrap(out_parameter)
        local hp = tonumber(unwrap(database:GetHPBySaveParameter(save)))
        local attack = tonumber(unwrap(database:GetShotAttackBySaveParameter(save)))
        local defense = tonumber(unwrap(database:GetDefenseBySaveParameter(save)))
        log(string.format(
            "observed|%s|%s|%s|%s|%s|%s",
            clean(unwrap(character_id)),
            clean(unwrap(level)),
            clean(save.FriendshipPoint),
            tostring(hp),
            tostring(attack),
            tostring(defense)
        ))
    end)
    if not ok then
        log("error|" .. clean(message))
        return
    end
    completed = true
    log("complete")
end

log("start")
RegisterHook(SETUP_HOOK, function() end, inspect_initialized_parameter)
