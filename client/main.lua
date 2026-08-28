if not lib.checkDependency('ox_lib', '3.30.0', true) then return end

lib.locale()

local utils = require 'client.utils'
local state = require 'client.state'
local options = require 'client.api'.getTargetOptions()

require 'client.debug'
require 'client.defaults'
require 'client.compat.qtarget'
require 'client.ambient'

local SendNuiMessage = SendNuiMessage
local GetEntityCoords = GetEntityCoords
local GetEntityType = GetEntityType
local HasEntityClearLosToEntity = HasEntityClearLosToEntity
local GetEntityBoneIndexByName = GetEntityBoneIndexByName
local GetEntityBonePosition_2 = GetEntityBonePosition_2
local GetEntityModel = GetEntityModel
local IsDisabledControlJustPressed = IsDisabledControlJustPressed
local DisableControlAction = DisableControlAction
local DisablePlayerFiring = DisablePlayerFiring
local GetModelDimensions = GetModelDimensions
local GetOffsetFromEntityInWorldCoords = GetOffsetFromEntityInWorldCoords
local currentTarget = {}
local currentMenu
local menuChanged
local menuHistory = {}
local nearbyZones

--- The flattened, visible order the PAGE is drawing, as { type, id, zoneId } triples.
---
--- Pushed up by the `order` callback rather than recomputed here. The page filters blocked
--- rows, regroups the buckets broad-to-specific and lifts the back row into a breadcrumb, so
--- Lua's own table order is not what the player is looking at. Two implementations of "which
--- row is third" would disagree the first time either one changed.
local keyOrder

--- Forward declaration: the draw thread inside startTargeting closes over this, and the
--- definition needs the menu history and focus handling that live further down.
local selectOption

-- Toggle ox_target, instead of holding the hotkey
local toggleHotkey = GetConvarInt('ox_target:toggleHotkey', 0) == 1
local mouseButton = GetConvarInt('ox_target:leftClick', 1) == 1 and 24 or 25
local debug = GetConvarInt('ox_target:debug', 0) == 1

-- Show options blocked by `groups` as greyed-out entries naming the requirement, rather
-- than hiding them. Off by default: "Restricted to police" is useful signposting on a
-- mechanic's ramp and a design leak on a police-only action, so the call belongs to the
-- server. Item requirements are always shown -- those are a hint, not a secret.
local showRestricted = GetConvarInt('ox_target:showRestricted', 0) == 1

-- How long a `canInteract` result stays good for, in ms. The callback is arbitrary author
-- code run under pcall for every visible option on a 50ms loop, so it is the one cost here
-- unbounded by anything this resource controls. 200ms is under the threshold at which a
-- list feels stale and cuts the call rate by roughly three quarters. Set 0 to run it every
-- tick, which is what upstream does.
local interactCacheMs = GetConvarInt('ox_target:interactCacheMs', 200)

-- Hold the mouse button for this many ms to confirm an option instead of clicking it once.
-- 0 keeps the click. Off by default because it changes how every interaction on the server
-- feels, which is a decision rather than an improvement.
local holdToConfirm = GetConvarInt('ox_target:holdToConfirm', 0)

-- Number keys 1-9 select the Nth row of the list without reaching for the mouse. On by
-- default: those keys do nothing at all while targeting today, so nothing is taken away.
local numberKeys = GetConvarInt('ox_target:numberKeys', 1) == 1

-- A tick when a target is acquired and when an option is taken. Off by default: audio is
-- taste, and a server that wants none should not have to find the setting.
local sounds = GetConvarInt('ox_target:sounds', 0) == 1

--- Throttle store for canInteract, keyed by the option table itself.
---
--- Weak keys, because an option outlives this table only until the resource that registered
--- it removes it -- and nothing here should be the reason a removed option is kept alive.
local interactCache = setmetatable({}, { __mode = 'k' })
local vec0 = vec3(0, 0, 0)

---@param option OxTargetOption
---@param distance number
---@param endCoords vector3
---@param entityHit? number
---@param entityType? number
---@param entityModel? number | false
---Returns whether the option should be hidden, and why.
---The reason is forwarded to the NUI so it can explain a blocked action instead of
---silently dropping it. Codes: 'menu' | 'distance' | 'groups' | 'items' | 'bone' |
---'offset' | 'canInteract'.
---@return boolean?, string?
local function shouldHide(option, distance, endCoords, entityHit, entityType, entityModel)
    if option.menuName ~= currentMenu then
        return true, 'menu'
    end

    if distance > (option.distance or 7) then
        return true, 'distance'
    end

    if option.groups and not utils.hasPlayerGotGroup(option.groups) then
        return true, 'groups'
    end

    if option.items and not utils.hasPlayerGotItems(option.items, option.anyItem) then
        return true, 'items'
    end

    local bone = entityModel and option.bones or nil

    if bone then
        ---@cast entityHit number
        ---@cast entityType number
        ---@cast entityModel number

        local _type = type(bone)

        if _type == 'string' then
            local boneId = GetEntityBoneIndexByName(entityHit, bone)

            if boneId ~= -1 and #(endCoords - GetEntityBonePosition_2(entityHit, boneId)) <= 2 then
                bone = boneId
            else
                return true, 'bone'
            end
        elseif _type == 'table' then
            local closestBone, boneDistance

            for j = 1, #bone do
                local boneId = GetEntityBoneIndexByName(entityHit, bone[j])

                if boneId ~= -1 then
                    local dist = #(endCoords - GetEntityBonePosition_2(entityHit, boneId))

                    if dist <= (boneDistance or 1) then
                        closestBone = boneId
                        boneDistance = dist
                    end
                end
            end

            if closestBone then
                bone = closestBone
            else
                return true, 'bone'
            end
        end
    end

    local offset = entityModel and option.offset or nil

    if offset then
        ---@cast entityHit number
        ---@cast entityType number
        ---@cast entityModel number

        -- `offsetAbsolute` is the spelling upstream DOCUMENTS; `absoluteOffset` is the one
        -- upstream READS, and has since the property existed. Following the documentation
        -- therefore does nothing at all: the offset silently stays model-relative, lands
        -- somewhere plausible, and reports no error. Both spellings are accepted here.
        if not (option.absoluteOffset or option.offsetAbsolute) then
            local min, max = GetModelDimensions(entityModel)
            offset = (max - min) * offset + min
        end

        offset = GetOffsetFromEntityInWorldCoords(entityHit, offset.x, offset.y, offset.z)

        if #(endCoords - offset) > (option.offsetSize or 1) then
            return true, 'offset'
        end
    end

    if option.canInteract then
        --- Throttled rather than run every tick.
        ---
        --- This is arbitrary author code behind a `pcall`, re-run for every visible option on
        --- every pass of a 50ms loop -- the one place in this resource where the cost is
        --- unbounded by anything we control.
        ---
        --- It is a THROTTLE and not a cache, because the callback is handed `distance` and
        --- `coords`: a result is only true for where the player was standing when it ran, so
        --- keeping one indefinitely would be wrong. The entry is dropped the moment the
        --- entity changes, and expires on its own after `interactCacheMs`.
        ---
        --- `option.distance` is still evaluated every tick, uncached, above -- so the gate
        --- players actually feel does not go stale even when this one has.
        local cached = interactCache[option]
        local now = GetGameTimer()
        local resp

        if cached and cached.entity == entityHit and now - cached.at < interactCacheMs then
            resp = cached.resp
        else
            local success, result = pcall(option.canInteract, entityHit, distance, endCoords, option.name, bone)
            resp = success and result or false
            interactCache[option] = { entity = entityHit, at = now, resp = resp }
        end

        if not resp then
            return true, 'canInteract'
        end
    end
end

local function startTargeting()
    if state.isDisabled() or state.isActive() or IsNuiFocused() or IsPauseMenuActive() then return end

    state.setActive(true)

    local flag = 511
    local hit, entityHit, endCoords, distance, lastEntity, entityType, entityModel, hasTarget, zonesChanged
    local zones = {}

    CreateThread(function()
        local dict, texture = utils.getTexture()
        local lastCoords

        while state.isActive() do
            lastCoords = endCoords == vec0 and lastCoords or endCoords or vec0

            if debug then
                DrawMarker(28, lastCoords.x, lastCoords.y, lastCoords.z, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.2, 0.2,
                    0.2,
                    ---@diagnostic disable-next-line: param-type-mismatch
                    255, 42, 24, 100, false, false, 0, true, false, false, false)
            end

            utils.drawZoneSprites(dict, texture)
            DisablePlayerFiring(cache.playerId, true)

            --- Number keys pick the Nth row of the list.
            ---
            --- Handled in Lua rather than in the page, because the page cannot see a keypress
            --- until NUI focus is taken and focus is only taken on a click -- so a keyboard
            --- path built in the UI would still have had to start with the mouse, which is the
            --- thing it exists to avoid.
            ---
            --- The controls are disabled only while a target is up, so weapon switching is
            --- untouched the rest of the time. 157 is INPUT_SELECT_WEAPON_UNARMED -- the 1 key --
            --- and 158-165 follow it in order up to 9.
            if numberKeys and hasTarget and keyOrder then
                for i = 1, math.min(#keyOrder, 9) do
                    local control = 156 + i

                    DisableControlAction(0, control, true)

                    if IsDisabledControlJustPressed(0, control) then
                        local entry = keyOrder[i]
                        selectOption(entry[1], entry[2], entry[3])
                        break
                    end
                end
            end
            DisableControlAction(0, 25, true)
            DisableControlAction(0, 140, true)
            DisableControlAction(0, 141, true)
            DisableControlAction(0, 142, true)

            if state.isNuiFocused() then
                DisableControlAction(0, 1, true)
                DisableControlAction(0, 2, true)

                if not hasTarget or options and IsDisabledControlJustPressed(0, 25) then
                    state.setNuiFocus(false, false)
                end
            elseif hasTarget and IsDisabledControlJustPressed(0, mouseButton) then
                state.setNuiFocus(true, true)
            end

            Wait(0)
        end

        SetStreamedTextureDictAsNoLongerNeeded(dict)
    end)

    while state.isActive() do
        if not state.isNuiFocused() and lib.progressActive() then
            state.setActive(false)
            break
        end

        local playerCoords = GetEntityCoords(cache.ped)
        hit, entityHit, endCoords = lib.raycast.fromCamera(flag, 4, 20)
        distance = #(playerCoords - endCoords)

        if entityHit ~= 0 and entityHit ~= lastEntity then
            local success, result = pcall(GetEntityType, entityHit)
            entityType = success and result or 0
        end

        if entityType == 0 then
            local _flag = flag == 511 and 26 or 511
            local _hit, _entityHit, _endCoords = lib.raycast.fromCamera(_flag, 4, 20)
            local _distance = #(playerCoords - _endCoords)

            if _distance < distance then
                flag, hit, entityHit, endCoords, distance = _flag, _hit, _entityHit, _endCoords, _distance

                if entityHit ~= 0 then
                    local success, result = pcall(GetEntityType, entityHit)
                    entityType = success and result or 0
                end
            end
        end

        nearbyZones, zonesChanged = utils.getNearbyZones(endCoords)

        local entityChanged = entityHit ~= lastEntity
        local newOptions = (zonesChanged or entityChanged or menuChanged) and true

        if entityHit > 0 and entityChanged then
            currentMenu = nil

            if flag ~= 511 then
                entityHit = HasEntityClearLosToEntity(entityHit, cache.ped, 7) and entityHit or 0
            end

            if lastEntity ~= entityHit and debug then
                if lastEntity then
                    SetEntityDrawOutline(lastEntity, false)
                end

                if entityType ~= 1 then
                    SetEntityDrawOutline(entityHit, true)
                end
            end

            if entityHit > 0 then
                local success, result = pcall(GetEntityModel, entityHit)
                entityModel = success and result
            end
        end

        if hasTarget and (zonesChanged or entityChanged and hasTarget > 1) then
            keyOrder = nil
            SendNuiMessage('{"event": "leftTarget"}')

            if entityChanged then options:wipe() end

            if debug and lastEntity > 0 then SetEntityDrawOutline(lastEntity, false) end

            hasTarget = false
        end

        if newOptions and entityModel and entityHit > 0 then
            options:set(entityHit, entityType, entityModel)
        end

        lastEntity = entityHit
        currentTarget.entity = entityHit
        currentTarget.coords = endCoords
        currentTarget.distance = distance
        local hidden = 0
        local totalOptions = 0

        for k, v in pairs(options) do
            local optionCount = #v
            local dist = k == '__global' and 0 or distance
            totalOptions += optionCount

            for i = 1, optionCount do
                local option = v[i]
                local hide, reason = shouldHide(option, dist, endCoords, entityHit, entityType, entityModel)

                -- hideReason travels to the NUI so a blocked action can say why instead of
                -- vanishing. It is part of the dirty check too, or a change of reason alone
                -- would never reach the UI.
                if option.hide ~= hide or option.hideReason ~= reason then
                    option.hide = hide
                    option.hideReason = reason
                    newOptions = true
                end

                if hide then hidden += 1 end
            end
        end

        if zonesChanged then table.wipe(zones) end

        for i = 1, #nearbyZones do
            local zoneOptions = nearbyZones[i].options
            local optionCount = #zoneOptions
            totalOptions += optionCount
            zones[i] = zoneOptions

            for j = 1, optionCount do
                local option = zoneOptions[j]
                local hide, reason = shouldHide(option, distance, endCoords, entityHit)

                if option.hide ~= hide or option.hideReason ~= reason then
                    option.hide = hide
                    option.hideReason = reason
                    newOptions = true
                end

                if hide then hidden += 1 end
            end
        end

        if newOptions then
            if hasTarget == 1 and (totalOptions - hidden) > 1 then
                hasTarget = true
            end

            if hasTarget and hidden == totalOptions then
                if hasTarget and hasTarget ~= 1 then
                    hasTarget = false
                    keyOrder = nil
                    SendNuiMessage('{"event": "leftTarget"}')
                end
            elseif menuChanged or hasTarget ~= 1 and hidden ~= totalOptions then
                hasTarget = options.size

                if currentMenu and options.__global[1]?.name ~= 'builtin:goback' then
                    table.insert(options.__global, 1,
                        {
                            icon = 'fa-solid fa-circle-chevron-left',
                            label = locale('go_back'),
                            name = 'builtin:goback',
                            menuName = currentMenu,
                            openMenu = 'home'
                        })
                end

                --- A target has been acquired. The reticle already has this moment; the sound
                --- hangs on the same edge so the two agree.
                if sounds then
                    PlaySoundFrontend(-1, 'HIGHLIGHT_NAV_UP_DOWN', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true)
                end

                SendNuiMessage(json.encode({
                    event = 'setTarget',
                    options = options,
                    zones = zones,
                }, { sort_keys = true }))
            end

            menuChanged = false
        end

        if toggleHotkey and IsPauseMenuActive() then
            state.setActive(false)
        end

        if not hasTarget or hasTarget == 1 then
            flag = flag == 511 and 26 or 511
        end

        Wait(hit and 50 or 100)
    end

    if lastEntity and debug then
        SetEntityDrawOutline(lastEntity, false)
    end

    state.setNuiFocus(false)
    SendNuiMessage('{"event": "visible", "state": false}')
    table.wipe(currentTarget)
    keyOrder = nil
    options:wipe()

    if nearbyZones then table.wipe(nearbyZones) end
end

do
    ---@type KeybindProps
    local keybind = {
        name = 'ox_target',
        defaultKey = GetConvar('ox_target:defaultHotkey', 'LMENU'),
        defaultMapper = 'keyboard',
        description = locale('toggle_targeting'),
    }

    if toggleHotkey then
        function keybind:onPressed()
            if state.isActive() then
                return state.setActive(false)
            end

            return startTargeting()
        end
    else
        keybind.onPressed = startTargeting

        function keybind:onReleased()
            state.setActive(false)
        end
    end

    lib.addKeybind(keybind)
end

---@generic T
---@param option T
---@param server? boolean
---@return T
local function getResponse(option, server)
    local response = table.clone(option)
    response.entity = currentTarget.entity
    response.zone = currentTarget.zone
    response.coords = currentTarget.coords
    response.distance = currentTarget.distance

    if server then
        response.entity = response.entity ~= 0 and NetworkGetEntityIsNetworked(response.entity) and
            NetworkGetNetworkIdFromEntity(response.entity) or 0
    end

    response.icon = nil
    response.groups = nil
    response.items = nil
    response.canInteract = nil
    response.onSelect = nil
    response.export = nil
    response.event = nil
    response.serverEvent = nil
    response.command = nil

    return response
end

---Runs the option a player picked, whether they clicked it or pressed its number.
---
---Extracted from the `select` callback so the keyboard path is the same code rather than a
---second copy that has to be kept in step with menu history, focus and the sound.
---@param optionType string
---@param id number
---@param zoneId? number
function selectOption(optionType, id, zoneId)
    local zone = zoneId and nearbyZones and nearbyZones[zoneId]

    ---@type OxTargetOption?
    local option = zone and zone.options[id] or optionType and options[optionType] and options[optionType][id]

    if sounds and option then
        PlaySoundFrontend(-1, 'SELECT', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true)
    end

    if option then
        if option.openMenu then
            local menuDepth = #menuHistory

            if option.name == 'builtin:goback' then
                option.menuName = option.openMenu
                option.openMenu = menuHistory[menuDepth]

                if menuDepth > 0 then
                    menuHistory[menuDepth] = nil
                end
            else
                menuHistory[menuDepth + 1] = currentMenu
            end

            menuChanged = true
            currentMenu = option.openMenu ~= 'home' and option.openMenu or nil

            options:wipe()
        else
            state.setNuiFocus(false)
        end

        currentTarget.zone = zone?.id

        if option.onSelect then
            option.onSelect(option.qtarget and currentTarget.entity or getResponse(option))
        elseif option.export then
            exports[option.resource or zone.resource][option.export](nil, getResponse(option))
        elseif option.event then
            TriggerEvent(option.event, getResponse(option))
        elseif option.serverEvent then
            TriggerServerEvent(option.serverEvent, getResponse(option, true))
        elseif option.command then
            ExecuteCommand(option.command)
        end

        if option.menuName == 'home' then return end
    end

    if not option?.openMenu and IsNuiFocused() then
        state.setActive(false)
    end
end

RegisterNUICallback('select', function(data, cb)
    cb(1)
    selectOption(data[1], data[2], data[3])
end)

---The page reports the order it is actually drawing, so a number key can mean the row the
---player is looking at rather than the row Lua happens to hold third.
RegisterNUICallback('order', function(data, cb)
    cb(1)
    keyOrder = data
end)

---The UI asks for this once on mount, mirroring ox_lib's `init` handshake.
---
---ox_target ships locales/*.json but has never had a way to get them into the NUI --
---upstream's page had no strings of its own. The rebuilt UI does (blocked reasons, group
---headings), so they are pushed here rather than hardcoded in English.
RegisterNUICallback('init', function(_, cb)
    cb(1)

    SendNuiMessage(json.encode({
        event = 'init',
        showRestricted = showRestricted,
        holdToConfirm = holdToConfirm,
        locale = {
            go_back = locale('go_back'),
            requires = locale('ui_requires'),
            restricted_to = locale('ui_restricted_to'),
            too_far = locale('ui_too_far'),
            group_general = locale('ui_group_general'),
            group_type = locale('ui_group_type'),
            group_model = locale('ui_group_model'),
            group_entity = locale('ui_group_entity'),
            group_zone = locale('ui_group_zone'),
        }
    }))
end)
