--[[--
Menu Girasole: il Kindle come lavagna del menu del giorno.

- Si apre dallo scriptlet "Menu Girasole" nella Libreria (o da KOReader: menu Strumenti → Menu Girasole).
- Mostra a schermo intero l'immagine generata dal gestionale (print agent: /kindle/menu.png) e la
  riscarica ogni 30 secondi; ridisegna lo schermo SOLO se il menu è cambiato (ETag), niente lampeggi inutili.
- Finché è aperto il Kindle non va in standby da solo. Col tasto di accensione lo standby mostra
  l'ultimo menu (default) oppure il logo: si sceglie dalla pressione lunga.
- Tocco semplice: non fa nulla (clienti). Pressione lunga: Torna al Kindle / standby menu o logo.
- Il salvaschermo dell'utente viene salvato e rimesso all'uscita (anche dopo una chiusura anomala).

Configurazione (opzionale) in KOReader → settings.reader.lua:
  menugirasole_url = "https://gestionale.90-minuti.it/print-agent/kindle/menu?cat=Primi,Secondi"
Si usa l'indirizzo pubblico (funziona da qualsiasi Wi-Fi). Niente estensione .png: Cloudflare
metterebbe l'immagine in cache per ore.
--]]--

local Blitbuffer = require("ffi/blitbuffer")
local CenterContainer = require("ui/widget/container/centercontainer")
local ButtonDialog = require("ui/widget/buttondialog")
local Font = require("ui/font")
local FrameContainer = require("ui/widget/container/framecontainer")
local TextBoxWidget = require("ui/widget/textboxwidget")
local Device = require("device")
local Geom = require("ui/geometry")
local GestureRange = require("ui/gesturerange")
local ImageWidget = require("ui/widget/imagewidget")
local InputContainer = require("ui/widget/container/inputcontainer")
local PluginShare = require("pluginshare")
local UIManager = require("ui/uimanager")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local logger = require("logger")
local _ = require("gettext")
local Screen = Device.screen

local DEFAULT_BASE = "https://gestionale.90-minuti.it/print-agent/kindle/"
local DEFAULT_QUERY = "cat=Antipasti,Primi,Secondi,Contorni,Dolci"
local REFRESH_SECONDS = 30
local PAGE_SECONDS = 20 -- se il menu non sta in una pagina, cambia pagina ogni 20 s
local MANUAL_PAUSE_SECONDS = 60 -- dopo che qualcuno sfoglia a mano, niente giro automatico per 1 minuto
local AUTOSTART_FLAG = "/mnt/us/koreader/menugirasole.autostart"
local CACHE_DIR = "/tmp"
-- Dimensione del testo (scelta dalla pressione lunga): normale, grande, molto grande
local ZOOMS = { { value = 1, label = "normale" }, { value = 1.2, label = "grande" }, { value = 1.4, label = "molto grande" } }
local LANGS = { { value = "it", label = "Italiano" }, { value = "en", label = "English" } }

local function nextOf(list, current)
    for i, item in ipairs(list) do
        if item.value == current then return list[i % #list + 1], item end
    end
    return list[2] or list[1], list[1]
end
local LOGO_PATH = "/mnt/us/koreader/menugirasole-logo.png"
local STANDBY_MENU_PATH = "/mnt/us/koreader/menugirasole-standby.png"

-- ------------------------------------------------------------------------------------------------
-- Rete
-- ------------------------------------------------------------------------------------------------

--- GET con timeout brevi. Ritorna body, status, headers (body nil se errore di rete).
local function httpGet(url, etag)
    local http = url:sub(1, 6) == "https:" and require("ssl.https") or require("socket.http")
    local ltn12 = require("ltn12")
    local socketutil = require("socketutil")
    local chunks = {}
    socketutil:set_timeout(5, 15)
    local ok, res, code, headers = pcall(http.request, {
        url = url,
        method = "GET",
        headers = etag and { ["If-None-Match"] = etag } or nil,
        sink = ltn12.sink.table(chunks),
    })
    socketutil:reset_timeout()
    if not ok or not res then
        logger.warn("MenuGirasole: download fallito", url, ok and code or res)
        return nil, tonumber(code) or 0, {}
    end
    return table.concat(chunks), tonumber(code) or 0, headers or {}
end

local function writeFile(path, data)
    local f = io.open(path, "wb")
    if not f then return false end
    f:write(data)
    f:close()
    return true
end

local function fileExists(path)
    local f = io.open(path, "rb")
    if f then f:close() return true end
    return false
end

-- ------------------------------------------------------------------------------------------------
-- Schermata del menu
-- ------------------------------------------------------------------------------------------------

local MenuScreen = InputContainer:extend{
    menu_url = nil,
    on_exit = nil,
}

function MenuScreen:init()
    self.dimen = Geom:new{ x = 0, y = 0, w = Screen:getWidth(), h = Screen:getHeight() }
    self.covers_fullscreen = true
    if Device:isTouchDevice() then
        self.ges_events = {
            Tap = { GestureRange:new{ ges = "tap", range = self.dimen } },
            Hold = { GestureRange:new{ ges = "hold", range = self.dimen } },
            Swipe = { GestureRange:new{ ges = "swipe", range = self.dimen } },
        }
    end
    self.etag = nil
    self.page = 1
    self.pages = 1
    self.counter = 0
    self.image_path = nil
    self._refresh = function() self:refresh() end
    self:setMessage(_("Il Girasole\n\nCaricamento del menu…"))
end

function MenuScreen:pageUrl()
    local sep = self.menu_url:find("?", 1, true) and "&" or "?"
    local view = self.get_view and self.get_view() or { zoom = 1, lang = "it" }
    return string.format("%s%sw=%d&h=%d&page=%d&zoom=%s&lang=%s", self.menu_url, sep,
        Screen:getWidth(), Screen:getHeight(), self.page, tostring(view.zoom), view.lang)
end

--- Dopo un cambio di testo/lingua: ricarica subito dalla prima pagina.
function MenuScreen:reload()
    self.etag = nil
    self.page = 1
    self.pages = 1
    self:refresh()
end

--- Schermata bianca con un messaggio (prima del primo menu, o se il menu non arriva).
function MenuScreen:setMessage(text)
    if self.image_path then return end -- c'è già un menu da mostrare: meglio quello che un errore
    if self[1] then self[1]:free() end
    self[1] = FrameContainer:new{
        width = self.dimen.w, height = self.dimen.h,
        background = Blitbuffer.COLOR_WHITE, bordersize = 0, padding = 0,
        CenterContainer:new{
            dimen = Geom:new{ w = self.dimen.w, h = self.dimen.h },
            TextBoxWidget:new{
                text = text,
                face = Font:getFace("cfont", 26),
                width = math.floor(self.dimen.w * 0.8),
                alignment = "center",
            },
        },
    }
    UIManager:setDirty(self, "full")
end

function MenuScreen:setImage(path)
    if self[1] then self[1]:free() end
    self[1] = ImageWidget:new{
        file = path,
        file_do_cache = false,
        width = self.dimen.w,
        height = self.dimen.h,
        scale_factor = 0, -- adatta allo schermo mantenendo le proporzioni
    }
    -- "full": refresh completo dell'e-ink, niente ombre dell'immagine precedente
    UIManager:setDirty(self, "full")
end

--- Scarica il menu; se è cambiato lo ridisegna. Si ripianifica da solo.
--- Scarica la pagina corrente (self.page); se è cambiata la ridisegna.
function MenuScreen:load()
    local body, code, headers = httpGet(self:pageUrl(), self.etag)
    if code == 200 and body and #body > 0 then
        self.pages = tonumber(headers["x-pages"]) or 1
        if self.page > self.pages then self.page = 1 end
        self.etag = headers["etag"]
        -- nome file sempre nuovo: evita qualsiasi cache dell'immagine
        self.counter = self.counter + 1
        local path = string.format("%s/menugirasole-%d.png", CACHE_DIR, self.counter % 2)
        if writeFile(path, body) then
            self.image_path = path
            self:setImage(path)
            -- copia per lo standby (l'immagine mostrata quando si preme il tasto di accensione)
            if self.page == 1 and writeFile(STANDBY_MENU_PATH, body) and self.on_new_menu then
                self.on_new_menu()
            end
        end
    elseif code ~= 304 and not self.image_path then
        logger.warn("MenuGirasole: menu non disponibile, codice", code)
        self:setMessage(_("Il Girasole\n\nMenu non raggiungibile.\nControlla il Wi-Fi: riprovo tra poco.\n\n(tieni premuto per uscire)"))
    end
end

--- Giro automatico: controlla il menu e, se ha più pagine, passa alla successiva
--- (salvo che qualcuno abbia appena sfogliato a mano). Si ripianifica da solo.
function MenuScreen:refresh()
    UIManager:unschedule(self._refresh)
    if self.pages > 1 and os.time() >= (self.manual_until or 0) then
        self.page = self.page % self.pages + 1
        self.etag = nil -- pagina diversa = immagine diversa
    end
    self:load()
    UIManager:scheduleIn(self.pages > 1 and PAGE_SECONDS or REFRESH_SECONDS, self._refresh)
end

--- Sfoglia a mano: dito verso sinistra/su = pagina dopo, verso destra/giù = pagina prima.
function MenuScreen:onSwipe(_, ges)
    if self.pages <= 1 then return true end
    local dir = ges and ges.direction
    if dir == "west" or dir == "north" then
        self.page = self.page % self.pages + 1
    elseif dir == "east" or dir == "south" then
        self.page = (self.page - 2) % self.pages + 1
    else
        return true
    end
    self.etag = nil
    self.manual_until = os.time() + MANUAL_PAUSE_SECONDS
    UIManager:unschedule(self._refresh)
    self:load()
    UIManager:scheduleIn(PAGE_SECONDS, self._refresh)
    return true
end

function MenuScreen:onShow()
    self:refresh()
    return true
end

function MenuScreen:onTap()
    return true -- un tocco del cliente non deve fare nulla
end

function MenuScreen:onHold()
    local dialog
    local logo = self.get_standby and self.get_standby() == "logo"
    dialog = ButtonDialog:new{
        title = _("Menu Girasole"),
        buttons = {
            {{ text = _("Torna al Kindle"), callback = function()
                UIManager:close(dialog)
                if self.on_exit then self.on_exit() end
            end }},
            {{ text = logo and _("In standby: logo  →  passa al menu") or _("In standby: menu  →  passa al logo"),
               callback = function()
                UIManager:close(dialog)
                if self.set_standby then self.set_standby(logo and "menu" or "logo") end
            end }},
            (function()
                local view = self.get_view and self.get_view() or { zoom = 1, lang = "it" }
                local nextZoom, curZoom = nextOf(ZOOMS, view.zoom)
                local nextLang, curLang = nextOf(LANGS, view.lang)
                return {
                    { text = string.format(_("Testo: %s  →  %s"), curZoom.label, nextZoom.label), callback = function()
                        UIManager:close(dialog)
                        if self.set_view then self.set_view({ zoom = nextZoom.value }) end
                        self:reload()
                    end },
                    { text = string.format(_("Lingua: %s  →  %s"), curLang.label, nextLang.label), callback = function()
                        UIManager:close(dialog)
                        if self.set_view then self.set_view({ lang = nextLang.value }) end
                        self:reload()
                    end },
                }
            end)(),
            {{ text = _("Resta sul menu"), callback = function() UIManager:close(dialog) end }},
        },
    }
    UIManager:show(dialog)
    return true
end

function MenuScreen:onCloseWidget()
    UIManager:unschedule(self._refresh)
    if self[1] then self[1]:free() end
end

-- ------------------------------------------------------------------------------------------------
-- Plugin
-- ------------------------------------------------------------------------------------------------

local MenuGirasole = WidgetContainer:extend{
    name = "menugirasole",
    is_doc_only = false,
}

function MenuGirasole:init()
    self.ui.menu:registerToMainMenu(self)
    -- KOReader chiuso male col menu aperto: rimetti il salvaschermo dell'utente
    if not MenuGirasole.active then self:restoreScreensaver() end
    -- Avvio dallo scriptlet "Menu Girasole": lo scriptlet crea il file segnale prima di lanciare KOReader
    if fileExists(AUTOSTART_FLAG) then
        os.remove(AUTOSTART_FLAG)
        UIManager:scheduleIn(1, function() self:start(true) end)
    end
end

function MenuGirasole:addToMainMenu(menu_items)
    menu_items.menu_girasole = {
        text = _("Menu Girasole"),
        sorting_hint = "tools",
        callback = function() self:start(false) end,
    }
end

function MenuGirasole:base()
    local url = G_reader_settings:readSetting("menugirasole_url")
    if url and url ~= "" then
        return url:match("^(.-/kindle/)") or DEFAULT_BASE, url
    end
    return DEFAULT_BASE, DEFAULT_BASE .. "menu?" .. DEFAULT_QUERY
end

function MenuGirasole:getStandby()
    return G_reader_settings:readSetting("menugirasole_standby") or "menu"
end

--- Punta il salvaschermo all'immagine giusta: ultimo menu (se c'è) o logo.
function MenuGirasole:applyStandby()
    local path = LOGO_PATH
    if self:getStandby() == "menu" and fileExists(STANDBY_MENU_PATH) then path = STANDBY_MENU_PATH end
    if not fileExists(path) then return end
    -- "document_cover" con un file immagine = mostra quell'immagine (frontend/ui/screensaver.lua)
    G_reader_settings:saveSetting("screensaver_type", "document_cover")
    G_reader_settings:saveSetting("screensaver_document_cover", path)
end

--- Salva il salvaschermo dell'utente (su disco: sopravvive a una chiusura anomala) e mette il nostro.
function MenuGirasole:takeOverScreensaver()
    local base = self:base()
    if not fileExists(LOGO_PATH) then
        local body, code = httpGet(string.format("%slogo?w=%d&h=%d", base, Screen:getWidth(), Screen:getHeight()))
        if code == 200 and body and #body > 0 then writeFile(LOGO_PATH, body) end
    end
    if not G_reader_settings:has("menugirasole_prev_ss") then
        G_reader_settings:saveSetting("menugirasole_prev_ss", {
            type = G_reader_settings:readSetting("screensaver_type") or "disable",
            cover = G_reader_settings:readSetting("screensaver_document_cover") or "",
        })
    end
    self:applyStandby()
    G_reader_settings:flush()
end

function MenuGirasole:restoreScreensaver()
    local prev = G_reader_settings:readSetting("menugirasole_prev_ss")
    if not prev then return end
    G_reader_settings:saveSetting("screensaver_type", prev.type)
    if prev.cover and prev.cover ~= "" then
        G_reader_settings:saveSetting("screensaver_document_cover", prev.cover)
    else
        G_reader_settings:delSetting("screensaver_document_cover")
    end
    G_reader_settings:delSetting("menugirasole_prev_ss")
    G_reader_settings:flush()
end

local function keepAwake(on)
    PluginShare.pause_auto_suspend = on -- autosuspend di KOReader
    if Device:isKindle() then -- standby del sistema Kindle (come il plugin keepalive)
        os.execute("lipc-set-prop com.lab126.powerd preventScreenSaver " .. (on and "1" or "0"))
    end
end

function MenuGirasole:start(from_launcher)
    if self.screen then return end
    local _, menu_url = self:base()
    MenuGirasole.active = true
    self:takeOverScreensaver()
    keepAwake(true)
    self.screen = MenuScreen:new{
        menu_url = menu_url,
        on_exit = function() self:stop(from_launcher) end,
        on_new_menu = function() self:applyStandby() end,
        get_standby = function() return self:getStandby() end,
        get_view = function()
            return {
                zoom = G_reader_settings:readSetting("menugirasole_zoom") or 1,
                lang = G_reader_settings:readSetting("menugirasole_lang") or "it",
            }
        end,
        set_view = function(changes)
            if changes.zoom then G_reader_settings:saveSetting("menugirasole_zoom", changes.zoom) end
            if changes.lang then G_reader_settings:saveSetting("menugirasole_lang", changes.lang) end
            G_reader_settings:flush()
        end,
        set_standby = function(mode)
            G_reader_settings:saveSetting("menugirasole_standby", mode)
            self:applyStandby()
            G_reader_settings:flush()
        end,
    }
    UIManager:show(self.screen, "full")
end

function MenuGirasole:stop(quit_koreader)
    if self.screen then
        UIManager:close(self.screen, "full")
        self.screen = nil
    end
    MenuGirasole.active = false
    keepAwake(false)
    self:restoreScreensaver()
    if quit_koreader then
        -- Aperto dallo scriptlet: si esce da KOReader e si torna al Kindle normale
        local FileManager = require("apps/filemanager/filemanager")
        if FileManager.instance then
            FileManager.instance:onClose()
        else
            UIManager:quit()
        end
    end
end

function MenuGirasole:onCloseWidget()
    -- KOReader si chiude mentre il menu è aperto: rimetti tutto com'era
    if self.screen then
        MenuGirasole.active = false
        keepAwake(false)
        self:restoreScreensaver()
    end
end

return MenuGirasole
