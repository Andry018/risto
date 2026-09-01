/**
 * appSettings — impostazioni centralizzate nel DB (tabella `impostazioni`).
 *
 * Strategia:
 *  1. Prima render: legge da memCache → localStorage (istantaneo, no flicker).
 *  2. Al mount: carica dal DB e aggiorna in memoria + localStorage cache.
 *  3. Al salvataggio: scrive in memoria + localStorage (sync), poi upsert DB (async).
 *  4. Prima esecuzione: migra automaticamente le chiavi da localStorage → DB.
 *  5. Offline / DB non disponibile: continua a funzionare con localStorage.
 *
 * I hook useSetting / useBooleanSetting mantengono la stessa firma —
 * nessuna modifica necessaria nei componenti.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Bus eventi — notifica i hook React ad ogni modifica
// ---------------------------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach(l => l());
}

export function subscribeSettings(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------------------------------------------------------------------------
// Cache in memoria (source of truth durante la sessione)
// ---------------------------------------------------------------------------

const memCache = new Map<string, string>();

function read(key: string, fallback: string): string {
  if (memCache.has(key)) return memCache.get(key)!;
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function write(key: string, value: string) {
  memCache.set(key, value);
  try { localStorage.setItem(key, value); } catch {}
  void upsertSetting(key, value);
  emit();
}

async function upsertSetting(chiave: string, valore: string) {
  if (!supabase) return;
  try {
    await supabase
      .from('impostazioni')
      .upsert({ chiave, valore }, { onConflict: 'chiave' });
  } catch {
    // Offline — il valore rimane in localStorage, sincronizzato alla prossima sessione
  }
}

// ---------------------------------------------------------------------------
// Inizializzazione DB — carica tutto una volta sola per sessione
// ---------------------------------------------------------------------------

let initPromise: Promise<void> | null = null;

async function loadFromDb(): Promise<void> {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from('impostazioni')
      .select('chiave, valore');

    if (error || !data) return;

    const rows = data as { chiave: string; valore: string }[];
    const dbKeys = new Set(rows.map(r => r.chiave));

    // 1. Popola memCache dai dati del DB
    for (const { chiave, valore } of rows) {
      memCache.set(chiave, valore);
      try { localStorage.setItem(chiave, valore); } catch {}
    }

    // 2. Prima esecuzione: migra le chiavi esistenti in localStorage → DB
    const toMigrate: { chiave: string; valore: string }[] = [];
    for (const key of Object.values(SETTINGS_KEYS)) {
      if (!dbKeys.has(key)) {
        let v: string | null = null;
        try { v = localStorage.getItem(key); } catch {}
        if (v !== null) {
          memCache.set(key, v);
          toMigrate.push({ chiave: key, valore: v });
        }
      }
    }
    if (toMigrate.length > 0) {
      void supabase.from('impostazioni').upsert(toMigrate, { onConflict: 'chiave' });
    }

    emit(); // aggiorna tutti i componenti montati
  } catch {
    // Offline o tabella non ancora creata — nessun blocco, usa localStorage
  }
}

function ensureInit(): Promise<void> {
  if (!initPromise) initPromise = loadFromDb();
  return initPromise;
}

// ---------------------------------------------------------------------------
// Chiavi note — unica lista di riferimento in tutta l'app
// ---------------------------------------------------------------------------

export const SETTINGS_KEYS = {
  restaurantName:    'risto_setting_restaurant_name',
  restaurantTagline: 'risto_setting_restaurant_tagline',
  printAgentUrl:     'risto_setting_print_agent_url',
  printerIp:         'risto_setting_printer_ip',
  printerPort:       'risto_setting_printer_port',
  printDeltaQty:     'risto_print_delta_qty',
  wakeLock:          'risto_wake_lock',
  theme:             'app_theme',
  publishMenuUrl:    'risto_setting_publish_menu_url',
  publishMenuSecret: 'risto_setting_publish_menu_secret',
  systemPanelSecret: 'risto_setting_system_panel_secret',
  ecrAgentUrl:       'risto_setting_ecr_agent_url',
} as const;

// ---------------------------------------------------------------------------
// API imperativa (per codice non-React)
// ---------------------------------------------------------------------------

export function getSetting(key: string, fallback: string): string {
  return read(key, fallback);
}

export function setSetting(key: string, value: string): void {
  write(key, value);
}

export function getBooleanSetting(key: string, fallback = false): boolean {
  const v = read(key, '');
  return v === '' ? fallback : v === 'true';
}

export function setBooleanSetting(key: string, value: boolean): void {
  write(key, String(value));
}

// ---------------------------------------------------------------------------
// Hook React
// ---------------------------------------------------------------------------

export function useSetting(key: string, fallback: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => read(key, fallback));

  useEffect(() => {
    // Carica dal DB (lazy, solo la prima volta in assoluto)
    void ensureInit().then(() => setValue(read(key, fallback)));
    // Resta in ascolto di scritture successive
    return subscribeSettings(() => setValue(read(key, fallback)));
  }, [key, fallback]);

  const set = useCallback((v: string) => write(key, v), [key]);
  return [value, set];
}

export function useBooleanSetting(key: string, fallback = false): [boolean, (v: boolean) => void] {
  const parse = (raw: string) => raw === '' ? fallback : raw === 'true';

  const [value, setValue] = useState(() => parse(read(key, '')));

  useEffect(() => {
    void ensureInit().then(() => setValue(parse(read(key, ''))));
    return subscribeSettings(() => setValue(parse(read(key, ''))));
  }, [key, fallback]);

  const set = useCallback((v: boolean) => write(key, String(v)), [key]);
  return [value, set];
}
