import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

const SCANNER_ELEMENT_ID = 'barcode-scanner-region';

export default function BarcodeScanner({ isOpen, onClose, onScan }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    let cancelled = false;
    let handledResult = false;

    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
    });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 160 } },
        (decodedText) => {
          if (cancelled || handledResult) return;
          handledResult = true;
          onScan(decodedText);
        },
        () => { /* nessun codice nel frame corrente: normale, si ignora */ }
      )
      .catch(() => {
        if (!cancelled) setError('Impossibile accedere alla fotocamera. Controlla i permessi del browser.');
      });

    return () => {
      cancelled = true;
      scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, [isOpen, onScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-black italic uppercase text-white flex items-center gap-2">
            <Camera size={20} className="text-gold" /> Scansiona
          </h2>
          <button onClick={onClose} className="p-2 bg-charcoal rounded-xl text-gray-400 hover:text-white border border-surface-light">
            <X size={18} />
          </button>
        </div>
        <div id={SCANNER_ELEMENT_ID} className="w-full rounded-2xl overflow-hidden bg-charcoal" />
        {error && <p className="text-red-400 text-sm font-bold text-center mt-4">{error}</p>}
        <p className="text-gray-500 text-xs text-center mt-4">Inquadra il codice a barre del prodotto</p>
        <button
          onClick={onClose}
          className="w-full mt-4 py-3.5 rounded-2xl bg-charcoal border border-surface-light text-gray-400 font-black text-xs uppercase tracking-widest hover:text-white transition-all"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
