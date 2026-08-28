--- Ambient interaction markers -- a dot on things worth aiming at, without holding the key.
---
--- Targeting is a thing you *do*: you hold a key and the world tells you what it offers. That
--- is fine once you know a pump is there and useless before you do, which is the whole of a
--- new player's first hour. This draws a small dot on nearby interactions so the world
--- advertises itself, and the key press becomes confirmation rather than discovery.
---
--- OFF BY DEFAULT, for two reasons that pull the same way. It is the only loop in this
--- resource that runs when the player is *not* targeting, so it is the only one that costs
--- anything at rest; and it puts permanent marks on a screen that already carries a HUD, which
--- is a decision about the server's look rather than a straight improvement.
---
--- WHAT GETS A MARKER is the part worth arguing about. Only *specific* registrations do:
--- `addModel`, `addEntity` and `addLocalEntity`, plus zones. The `global` buckets are skipped
--- deliberately -- `ox_target:defaults` alone registers door, bonnet and boot options against
--- every vehicle in the game, so marking global options would put a dot on every car on the
--- street and the marker would mean "this is a vehicle" rather than "something is here".
--- A marker that is always on is not a signal.

if GetConvarInt('ox_target:ambientMarkers', 0) ~= 1 then return end

local api = require 'client.api'
local state = require 'client.state'

--- How far out to look, in metres. Beyond about 15 the dots crowd into each other on screen
--- and stop being separable, which is worse than not drawing them.
local radius = GetConvarInt('ox_target:ambientRadius', 12)

--- A hard ceiling on dots. `SetDrawOrigin` is capped at 32 calls per frame by the engine and
--- `utils.drawZoneSprites` already spends up to 24 of them, so this cannot simply take what it
--- likes. It is also a legibility limit: a dozen dots is a busy street, and past that the
--- nearest ones are what matter anyway.
local maxMarkers = GetConvarInt('ox_target:ambientMax', 12)

--- How often the world is re-scanned, in ms. The scan walks the entity pools; the draw runs
--- every frame off the result, so this is the number that actually costs something.
local scanMs = GetConvarInt('ox_target:ambientScanMs', 500)

local GetEntityCoords = GetEntityCoords
local GetEntityModel = GetEntityModel
local SetDrawOrigin = SetDrawOrigin
local DrawSprite = DrawSprite
local ClearDrawOrigin = ClearDrawOrigin

--- Same dictionary the zone sprites use, so there is one streamed texture rather than two.
local dict, texture = 'shared', 'emptydot_32'

local width = 0.008
local height = width * GetAspectRatio(false)

--- Deliberately dimmer than the zone sprite's 175 alpha. This is peripheral information --
--- something you notice, not something you read -- and a dot bright enough to compete with the
--- HUD would have to justify itself every frame it was on screen.
local colour = { 155, 190, 200, 110 }

---@type vector3[]
local markers = {}
local markerCount = 0

--- Does this entity carry an option registered for *it*, rather than for its whole type?
---
--- `api.getTargetOptions` always hands back the `global` bucket, so the three specific keys are
--- the only ones that answer the question. See the note at the top of the file.
---@param entity number
---@param entityType number
---@return boolean
local function hasSpecificOption(entity, entityType)
    local found = api.getTargetOptions(entity, entityType, GetEntityModel(entity))

    return (found.model or found.entity or found.localEntity) and true or false
end

---@param coords vector3
---@param pool string
---@param entityType number
local function collectPool(coords, pool, entityType)
    if markerCount >= maxMarkers then return end

    for _, entity in ipairs(GetGamePool(pool)) do
        local entityCoords = GetEntityCoords(entity)

        --- Distance first, and only then the option lookup: the pool is every entity the
        --- client has streamed, and the overwhelming majority of them are not near enough to
        --- be worth asking about.
        if #(coords - entityCoords) <= radius and hasSpecificOption(entity, entityType) then
            markerCount += 1
            markers[markerCount] = entityCoords

            if markerCount >= maxMarkers then return end
        end
    end
end

CreateThread(function()
    while true do
        --- Nothing to do while the player is targeting: the option list is on screen and it
        --- says strictly more than a dot does. Also nothing to do while the resource has been
        --- disabled by `api.disableTargeting`, which is how other resources suppress this UI
        --- during a cutscene or a menu.
        if state.isActive() or state.isDisabled() then
            markerCount = 0
        else
            local coords = GetEntityCoords(cache.ped)

            markerCount = 0

            collectPool(coords, 'CObject', 3)
            collectPool(coords, 'CVehicle', 2)
            collectPool(coords, 'CPed', 1)

            --- Zones last and unconditionally: an interaction volume is invisible by
            --- definition, so it is the case this feature exists for. `getNearbyZones` is
            --- ox_lib's own list and costs nothing to read.
            if Zones and markerCount < maxMarkers then
                for _, zone in pairs(lib.zones.getNearbyZones()) do
                    if #(coords - zone.coords) <= radius then
                        markerCount += 1
                        markers[markerCount] = zone.coords

                        if markerCount >= maxMarkers then break end
                    end
                end
            end
        end

        Wait(scanMs)
    end
end)

CreateThread(function()
    while true do
        if markerCount == 0 then
            --- Nothing on screen, so there is nothing to hold a frame for. Sleeping at the
            --- scan interval means the idle cost of this feature is one wakeup every 500ms
            --- rather than one every frame.
            Wait(scanMs)
        else
            if not HasStreamedTextureDictLoaded(dict) then
                RequestStreamedTextureDict(dict, false)
            else
                for i = 1, markerCount do
                    local coords = markers[i]

                    SetDrawOrigin(coords.x, coords.y, coords.z, 0)
                    DrawSprite(dict, texture, 0, 0, width, height, 0, colour[1], colour[2], colour[3], colour[4])
                    ClearDrawOrigin()
                end
            end

            Wait(0)
        end
    end
end)
