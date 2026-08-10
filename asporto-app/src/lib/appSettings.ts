import { useState, useEffect, useCallback } from 'react';

type Listener = () => void;

const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeSettings(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
  emit();
}

export const SETTINGS_KEYS = {
  restaurantName: 'risto_setting_restaurant_name',
  restaurantTagline: 'risto_setting_restaurant_tagline',
  printAgentUrl: 'risto_setting_print_agent_url',
  printerIp: 'risto_setting_printer_ip',
  printerPort: 'risto_setting_printer_port',
  printDeltaQty: 'risto_print_delta_qty',
  wakeLock: 'risto_wake_lock',
  theme: 'app_theme',
  publishMenuUrl: 'risto_setting_publish_menu_url',
  publishMenuSecret: 'risto_setting_publish_menu_secret',
} as const;

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

export function useSetting(key: string, fallback: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => read(key, fallback));
  useEffect(() => subscribeSettings(() => setValue(read(key, fallback))), [key, fallback]);
  const set = useCallback((v: string) => write(key, v), [key]);
  return [value, set];
}

export function useBooleanSetting(key: string, fallback = false): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => {
    const v = read(key, '');
    return v === '' ? fallback : v === 'true';
  });
  useEffect(() => subscribeSettings(() => {
    const v = read(key, '');
    setValue(v === '' ? fallback : v === 'true');
  }), [key, fallback]);
  const set = useCallback((v: boolean) => write(key, String(v)), [key]);
  return [value, set];
}
