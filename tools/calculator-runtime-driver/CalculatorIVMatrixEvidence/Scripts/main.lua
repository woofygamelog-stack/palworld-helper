local MOD_NAME = "CalculatorIVMatrixEvidence"
local POLL_INTERVAL_MS = 250
local START_DELAY_ATTEMPTS = 40
local MAX_ATTEMPTS = 2400

local attempts = 0
local completed = false
local run_in_flight = false
local last_error = nil

local representatives = {
    "Alpaca", "AmaterasuWolf", "Baphomet", "Bastet", "BlackCentaur", "BlackGriffon",
    "BlueDragon_Ice", "BluePlatypus", "ClioneTwins", "DarkCrow", "FlowerPrince", "Garm",
    "GrassGolem_Dark", "IceHorse_Dark", "CandleGhost", "FlameBuffalo", "GrassMammoth",
    "KingWhale", "LegendDeer", "Bastet_Ice", "CowPal", "CuteMole", "DarkScorpion",
    "FluffyBird", "Horus", "NightLady", "SaintCentaur"
}

local function log(message)
    print(string.format("[%s] PAL_IV_MATRIX|%s\n", MOD_NAME, message))
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

local function database_for_world(utility)
    local worlds_ok, worlds = pcall(FindAllOf, "World")
    if worlds_ok and worlds then
        for _, world in ipairs(worlds) do
            local ok, value = pcall(function() return utility:GetDatabaseCharacterParameter(world) end)
            if ok and is_valid(value) then return value end
        end
    end
    return nil
end

local function run()
    local utility = cdo("/Script/Pal.PalUtility")
    if not is_valid(utility) then error("Pal utility is unavailable") end
    local database = database_for_world(utility)
    if not is_valid(database) then error("character parameter database is unavailable") end

    for _, id in ipairs(representatives) do
        for level = 1, 80 do
            for rank = 0, 4 do
                local hp_values = {}
                local attack_values = {}
                local defense_values = {}
                for talent = 0, 100 do
                    local save = {
                        CharacterID = FName(id),
                        Level = level,
                        Talent_HP = talent,
                        Talent_Shot = talent,
                        Talent_Defense = talent,
                        Rank = rank,
                        Rank_HP = 0,
                        Rank_Attack = 0,
                        Rank_Defence = 0,
                    }
                    hp_values[#hp_values + 1] = tostring(tonumber(unwrap(database:GetHPBySaveParameter(save))))
                    attack_values[#attack_values + 1] = tostring(tonumber(unwrap(database:GetShotAttackBySaveParameter(save))))
                    defense_values[#defense_values + 1] = tostring(tonumber(unwrap(database:GetDefenseBySaveParameter(save))))
                end
                log(string.format("row|%s|%d|%d|%s|%s|%s", id, level, rank, table.concat(hp_values, ","), table.concat(attack_values, ","), table.concat(defense_values, ",")))
            end
        end
    end
    log(string.format("complete|%d|%d|%d|%d", #representatives, 80, 5, 101))
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
