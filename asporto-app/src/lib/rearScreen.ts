/**
 * rearScreen — "mini presentazione" sul retro dello Xiaomi 17 Pro / Pro Max.
 *
 * Il Magic Back Screen non espone API web: l'unico canale che una PWA può usare
 * è il widget musica, che mostra i metadati della Media Session di Chrome
 * (titolo, artista, copertina). Quindi:
 *  1. si riproduce in loop un audio silenzioso (serve per avere una sessione media attiva);
 *  2. ogni "scena" diventa metadata: titolo = tavolo + totale, artista = dettaglio,
 *     copertina = immagine disegnata su canvas.
 *
 * Funziona anche su qualsiasi Android (notifica media / lockscreen).
 * La scena corrente viene anche trasmessa su BroadcastChannel per l'anteprima `/rear`.
 *
 * Impostazione per dispositivo (localStorage, non sincronizzata nel DB).
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CustomizedItem } from '../types/entities';

const STORAGE_KEY = 'risto_rear_screen';
const CHANNEL_NAME = 'risto-rear-screen';
const FLASH_MS = 3500;

export type RearScene =
  | { kind: 'idle' }
  | { kind: 'table'; table: string; total: number; items: number; flash?: { qty: number; nome: string } }
  | { kind: 'status'; table: string; total: number; status: 'saved' | 'paying' | 'paid' };

export interface RearFrame {
  title: string;
  subtitle: string;
  artwork: string;
}

// ---------------------------------------------------------------------------
// Abilitazione (per dispositivo)
// ---------------------------------------------------------------------------

const enabledListeners = new Set<() => void>();

export function isRearScreenEnabled(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
}

export function setRearScreenEnabled(enabled: boolean) {
  try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch { /* storage non disponibile */ }
  enabledListeners.forEach(l => l());
  if (enabled) void startRearScreen();
  else stopRearScreen();
}

export function useRearScreenEnabled(): boolean {
  return useSyncExternalStore(
    fn => { enabledListeners.add(fn); return () => enabledListeners.delete(fn); },
    isRearScreenEnabled,
    () => false,
  );
}

export function isRearScreenSupported(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

// ---------------------------------------------------------------------------
// Audio silenzioso (tiene viva la sessione media)
// ---------------------------------------------------------------------------

let audio: HTMLAudioElement | null = null;
let currentScene: RearScene = { kind: 'idle' };

/** WAV PCM 8 bit mono, tutto a 128 (= silenzio). Chrome ignora i media < 5 s, quindi 10 s. */
function silentWavUrl(): string {
  const sampleRate = 8000;
  const samples = sampleRate * 10;
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, samples, true);
  new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/** Va chiamata dentro un gesto utente (tap), altrimenti il browser blocca play(). */
export async function startRearScreen(): Promise<boolean> {
  if (!isRearScreenSupported() || !isRearScreenEnabled()) return false;
  if (!audio) {
    audio = new Audio(silentWavUrl());
    audio.loop = true;
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => { void audio?.play(); ms.playbackState = 'playing'; });
    ms.setActionHandler('pause', () => { audio?.pause(); ms.playbackState = 'paused'; });
    ms.setActionHandler('stop', () => setRearScreenEnabled(false));
  }
  if (!audio.paused) return true;
  try {
    await audio.play();
    navigator.mediaSession.playbackState = 'playing';
    renderScene(currentScene);
    return true;
  } catch {
    return false;
  }
}

export function stopRearScreen() {
  lastKey = '';
  if (audio) {
    audio.pause();
    URL.revokeObjectURL(audio.src);
    audio = null;
  }
  if (isRearScreenSupported()) {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  }
}

// Dopo un reload il play() deve aspettare il primo tap: lo agganciamo una volta sola.
if (typeof window !== 'undefined') {
  const kick = () => { if (isRearScreenEnabled() && (!audio || audio.paused)) void startRearScreen(); };
  // Su touch l'attivazione utente arriva al pointerup (non al pointerdown)
  window.addEventListener('pointerup', kick, { capture: true, passive: true });
  window.addEventListener('keydown', kick, { capture: true });
}

// ---------------------------------------------------------------------------
// Rendering della scena
// ---------------------------------------------------------------------------

const eur = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

const STATUS_LABEL = {
  saved: 'Comanda inviata',
  paying: 'Pagamento in corso…',
  paid: 'Pagato ✓',
} as const;

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxSize: number, weight = 900): void {
  let size = maxSize;
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  while (size > 18 && ctx.measureText(text).width > maxWidth) {
    size -= 4;
    ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  }
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

/** Copertina 512×512: label in alto, contenuto grande al centro, riga in basso. */
function drawArtwork(top: string, main: string, bottom: string, accent: string): string {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, S, 10);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const maxW = S - 64;

  ctx.fillStyle = accent;
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillText(ellipsize(ctx, top.toUpperCase(), maxW), S / 2, 90);

  ctx.fillStyle = '#ffffff';
  fitText(ctx, main, maxW, 120);
  ctx.fillText(ellipsize(ctx, main, maxW), S / 2, S / 2);

  ctx.fillStyle = '#9ca3af';
  ctx.font = '700 36px system-ui, sans-serif';
  ctx.fillText(ellipsize(ctx, bottom, maxW), S / 2, S - 90);

  return canvas.toDataURL('image/png');
}

export function sceneToFrame(scene: RearScene): Omit<RearFrame, 'artwork'> & { art: [string, string, string, string] } {
  const GOLD = '#CFA055';
  switch (scene.kind) {
    case 'idle':
      return { title: 'Il Girasole', subtitle: 'In servizio', art: ['Il Girasole', '🌻', 'In servizio', GOLD] };
    case 'table': {
      const detail = `${scene.items} ${scene.items === 1 ? 'articolo' : 'articoli'}`;
      if (scene.flash) {
        const add = `+${scene.flash.qty} ${scene.flash.nome}`;
        return { title: add, subtitle: `${scene.table} · ${eur(scene.total)}`, art: [scene.table, add, `Totale ${eur(scene.total)}`, '#34d399'] };
      }
      return { title: `${scene.table} · ${eur(scene.total)}`, subtitle: detail, art: [scene.table, eur(scene.total), detail, GOLD] };
    }
    case 'status': {
      const label = STATUS_LABEL[scene.status];
      const color = scene.status === 'paying' ? '#60a5fa' : '#34d399';
      return { title: label, subtitle: `${scene.table} · ${eur(scene.total)}`, art: [scene.table, eur(scene.total), label, color] };
    }
  }
}

let channel: BroadcastChannel | null = null;
let lastKey = '';

function renderScene(scene: RearScene) {
  const f = sceneToFrame(scene);
  const key = JSON.stringify(f);
  const active = !!audio && !audio.paused;
  if (key === lastKey && active) return;

  const artwork = drawArtwork(...f.art);
  const frame: RearFrame = { title: f.title, subtitle: f.subtitle, artwork };

  if (active) {
    lastKey = key;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: frame.title,
      artist: frame.subtitle,
      album: 'Il Girasole',
      artwork: artwork ? [{ src: artwork, sizes: '512x512', type: 'image/png' }] : [],
    });
  }

  try {
    channel ??= new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(frame);
  } catch { /* BroadcastChannel non supportato */ }
}

export function showRearScene(scene: RearScene) {
  currentScene = scene;
  if (!isRearScreenEnabled()) return;
  renderScene(scene);
}

/** Per la pagina di anteprima `/rear`. */
export function subscribeRearFrames(fn: (f: RearFrame) => void): () => void {
  const ch = new BroadcastChannel(CHANNEL_NAME);
  ch.onmessage = e => fn(e.data as RearFrame);
  return () => ch.close();
}

// ---------------------------------------------------------------------------
// Diff del carrello → "+1 Margherita"
// ---------------------------------------------------------------------------

/**
 * Restituisce l'articolo aggiunto tra due stati del carrello, oppure null.
 * Solo se è cambiata UNA riga in aumento: un caricamento ordine/bozza (molte righe
 * insieme) non deve sembrare un'aggiunta.
 */
export function detectAddition(prev: CustomizedItem[], next: CustomizedItem[]): { qty: number; nome: string } | null {
  const before = new Map(prev.map(i => [i.uniqueId, i.quantity]));
  const increases = next
    .map(i => ({ nome: i.nome, qty: i.quantity - (before.get(i.uniqueId) ?? 0) }))
    .filter(d => d.qty > 0);
  return increases.length === 1 ? increases[0] : null;
}

// ---------------------------------------------------------------------------
// Hook per le viste
// ---------------------------------------------------------------------------

export interface RearScreenInput {
  /** null = nessun tavolo aperto (scena idle) */
  table: string | null;
  cart: CustomizedItem[];
  total: number;
  status?: 'saved' | 'paying' | 'paid' | null;
}

export function useRearScreen({ table, cart, total, status }: RearScreenInput) {
  const enabled = useRearScreenEnabled();
  const prevCart = useRef<CustomizedItem[]>(cart);
  const prevTable = useRef<string | null>(table);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [flash, setFlash] = useState<{ qty: number; nome: string } | null>(null);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pulsed, setPulsed] = useState<{ status: NonNullable<RearScreenInput['status']>; total?: number } | null>(null);

  useEffect(() => {
    const sameTable = prevTable.current === table;
    const added = sameTable ? detectAddition(prevCart.current, cart) : null;
    prevTable.current = table;
    prevCart.current = cart;
    if (!sameTable) {
      clearTimeout(flashTimer.current);
      setFlash(null);
    } else if (added) {
      clearTimeout(flashTimer.current);
      setFlash(added);
      flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
    }
  }, [cart, table]);

  const effectiveStatus = status ?? pulsed?.status ?? null;
  const shownTotal = !status && pulsed?.total != null ? pulsed.total : total;

  useEffect(() => {
    if (!enabled) return;
    const items = cart.reduce((n, i) => n + i.quantity, 0);
    if (!table) showRearScene({ kind: 'idle' });
    else if (effectiveStatus) showRearScene({ kind: 'status', table, total: shownTotal, status: effectiveStatus });
    else showRearScene({ kind: 'table', table, total, items, flash: flash ?? undefined });
  }, [enabled, table, cart, total, shownTotal, effectiveStatus, flash]);

  useEffect(() => () => {
    clearTimeout(flashTimer.current);
    clearTimeout(pulseTimer.current);
    showRearScene({ kind: 'idle' });
  }, []);

  /**
   * Mostra uno stato per qualche secondo (es. "Comanda inviata") poi torna al riepilogo.
   * `total` serve quando il carrello viene svuotato subito dopo (es. conto pagato).
   */
  const pulse = useCallback((s: NonNullable<RearScreenInput['status']>, total?: number, ms = FLASH_MS) => {
    clearTimeout(pulseTimer.current);
    setPulsed({ status: s, total });
    pulseTimer.current = setTimeout(() => setPulsed(null), ms);
  }, []);

  return { pulse };
}
