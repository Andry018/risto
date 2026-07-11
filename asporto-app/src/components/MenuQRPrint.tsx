import { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { Printer } from 'lucide-react';

const BASE_URL = window.location.origin;

export default function MenuQRPrint() {
  const [tables, setTables] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from('tavoli').select('nome').order('nome');
      if (data) setTables(data.map(t => t.nome));
    })();
  }, []);

  return (
    <div className="bg-white min-h-screen">
      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50 flex gap-3">
        <button
          onClick={() => window.print()}
          className="bg-gold text-black font-black px-6 py-3 rounded-2xl shadow-xl hover:brightness-110 transition-all flex items-center gap-2"
        >
          <Printer size={18} /> STAMPA
        </button>
      </div>

      <div
        className="flex flex-wrap mx-auto"
        style={{ width: '210mm', minHeight: '297mm', padding: '5mm 3mm' }}
      >
        {tables.length === 0
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center justify-center p-2" style={{ width: '25%', height: '20%', boxSizing: 'border-box' }}>
                <div className="flex flex-col items-center">
                  <div className="w-[80px] h-[80px] bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            ))
          : tables.map(table => {
              const url = `${BASE_URL}/menu?tavolo=${encodeURIComponent(table)}`;
              return (
                <div key={table} className="flex flex-col items-center justify-center p-2" style={{ width: '25%', height: '20%', boxSizing: 'border-box' }}>
                  <div className="flex flex-col items-center">
                    <p className="text-[8px] font-black text-gray-700 uppercase tracking-wider mb-1">{table}</p>
                    <QRCodeCanvas value={url} size={80} bgColor="#ffffff" fgColor="#000000" level="M" />
                    <p className="text-[5px] font-mono text-gray-400 mt-1 leading-tight text-center break-all max-w-[80px]">
                      {url}
                    </p>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
