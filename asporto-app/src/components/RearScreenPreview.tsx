import { useEffect, useState } from 'react';
import { subscribeRearFrames, type RearFrame } from '../lib/rearScreen';

/**
 * Anteprima dello schermo posteriore: mostra in tempo reale la scena inviata
 * dalle altre schede/finestre della PWA sullo stesso dispositivo (BroadcastChannel).
 * Utile per provare la presentazione da PC senza lo Xiaomi.
 */
export default function RearScreenPreview() {
  const [frame, setFrame] = useState<RearFrame | null>(null);

  useEffect(() => subscribeRearFrames(setFrame), []);

  return (
    <div className="min-h-dvh bg-black flex items-center justify-center p-4">
      {/* Proporzioni del Magic Back Screen: 904 × 572 */}
      <div className="w-full max-w-[904px] aspect-[904/572] rounded-[2rem] bg-[#121212] border border-white/10 flex items-center gap-6 p-6 overflow-hidden">
        {frame ? (
          <>
            {frame.artwork && <img src={frame.artwork} alt="" className="h-full aspect-square rounded-2xl" />}
            <div className="min-w-0">
              <p className="text-2xl md:text-4xl font-black text-white truncate">{frame.title}</p>
              <p className="text-lg md:text-2xl font-bold text-gray-400 truncate mt-2">{frame.subtitle}</p>
            </div>
          </>
        ) : (
          <p className="w-full text-center text-gray-500 font-bold">
            In attesa… apri il POS o la vista cameriere in un'altra scheda (schermo posteriore attivo nelle Impostazioni).
          </p>
        )}
      </div>
    </div>
  );
}
