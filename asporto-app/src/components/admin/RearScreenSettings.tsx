import { useEffect, useState } from 'react';
import {
  checkRearBridge,
  isMediaSessionSupported,
  setRearScreenMode,
  showRearScene,
  useRearScreenMode,
  type RearScreenMode,
} from '../../lib/rearScreen';

const RELEASE_URL = 'https://github.com/Andry018/risto/releases/tag/rear-latest';

const MODES: { value: RearScreenMode; label: string }[] = [
  { value: 'off', label: 'Spento' },
  { value: 'outerview', label: 'Card OuterView' },
  { value: 'media', label: 'Widget musica' },
];

/** Impostazioni dello schermo posteriore Xiaomi 17 Pro (per dispositivo). */
export default function RearScreenSettings() {
  const mode = useRearScreenMode();
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (mode !== 'outerview') return;
    let alive = true;
    const check = () => { void checkRearBridge().then(ok => { if (alive) setBridgeOk(ok); }); };
    check();
    const t = setInterval(check, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [mode]);

  const test = () =>
    showRearScene({ kind: 'table', table: 'Tavolo 5', total: 42.5, items: 6, flash: { qty: 1, nome: 'Margherita' } });

  return (
    <div className="pt-4 border-t border-surface-light space-y-3">
      <div>
        <p className="text-sm font-bold text-white">Schermo posteriore (Xiaomi 17 Pro)</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Mostra sul retro tavolo, totale e articoli appena aggiunti. Solo questo dispositivo.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MODES.map(m => (
          <button
            key={m.value}
            type="button"
            onClick={() => setRearScreenMode(m.value)}
            className={`px-2 py-2 rounded-xl text-xs font-bold border transition ${
              mode === m.value ? 'bg-gold/15 text-gold border-gold/40' : 'bg-charcoal text-gray-400 border-surface-light'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'outerview' && (
        <div className="text-xs text-gray-400 bg-charcoal border border-surface-light rounded-xl p-3 space-y-2">
          <p>
            App ponte:{' '}
            {bridgeOk === null ? 'verifica…' : bridgeOk
              ? <b className="text-emerald-400">collegata ✓</b>
              : <b className="text-amber-400">non raggiungibile</b>}
          </p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Dalla <a href={RELEASE_URL} target="_blank" rel="noreferrer" className="text-gold underline">release rear-latest</a> scarica e installa <b className="text-white">girasole-rear.apk</b>, aprila una volta (resta attiva con una notifica).</li>
            <li>Scarica <b className="text-white">girasole-rear-card.zip</b> e importalo in OuterView (root + LSPosed), poi aggiungi la card dalla gestione app del retro.</li>
            <li>Premi <b className="text-white">Prova</b>: la prima volta Chrome chiede il permesso di accedere ai dispositivi sulla rete locale → Consenti.</li>
          </ol>
        </div>
      )}

      {mode === 'media' && (
        isMediaSessionSupported() ? (
          <p className="text-xs text-gray-400 bg-charcoal border border-surface-light rounded-xl p-3">
            L'app riproduce un audio muto per restare nel widget musica: sul retro scegli il widget
            <b className="text-white"> Musica</b>. Pausa dal widget sospende, "stop" spegne.
            Mette in pausa altra musica sul telefono.
          </p>
        ) : (
          <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            Questo browser non supporta Media Session: usa Chrome su Android con l'app installata come PWA.
          </p>
        )
      )}

      {mode !== 'off' && (
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={test} className="px-3 py-1.5 rounded-lg bg-gold/15 text-gold font-bold border border-gold/30">
            Prova
          </button>
          <a href="/rear" target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-surface-light text-white font-bold">
            Anteprima
          </a>
        </div>
      )}
    </div>
  );
}
