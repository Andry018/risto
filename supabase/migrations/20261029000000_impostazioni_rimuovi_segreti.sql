-- I segreti (Pannello Sistema, pubblicazione menu) non devono stare in `impostazioni`:
-- la tabella è leggibile con la anon key pubblica. Da ora l'app li tiene solo nel localStorage
-- del dispositivo (LOCAL_ONLY_KEYS in src/lib/appSettings.ts).
DELETE FROM public.impostazioni
WHERE chiave IN ('risto_setting_system_panel_secret', 'risto_setting_publish_menu_secret');
