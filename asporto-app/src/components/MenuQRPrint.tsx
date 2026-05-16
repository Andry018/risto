import { QRCodeCanvas } from 'qrcode.react';

const MENU_URL = 'https://risto-taupe.vercel.app/menu';

function QRSlot() {
  return (
    <div className="flex flex-col items-center justify-center p-2" style={{ width: '25%', height: '20%', boxSizing: 'border-box' }}>
      <div className="flex flex-col items-center">
        <QRCodeCanvas value={MENU_URL} size={80} bgColor="#ffffff" fgColor="#000000" level="M" />
        <p className="text-[5px] font-mono text-gray-600 mt-1 leading-tight text-center break-all max-w-[80px]">
          risto-taupe.vercel.app/menu
        </p>
      </div>
    </div>
  );
}

export default function MenuQRPrint() {
  return (
    <div className="bg-white min-h-screen">
      {/* Print-only styles */}
      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Print button */}
      <div className="no-print fixed top-4 right-4 z-50">
        <button
          onClick={() => window.print()}
          className="bg-gold text-black font-black px-6 py-3 rounded-2xl shadow-xl hover:brightness-110 transition-all"
        >
          STAMPA
        </button>
      </div>

      {/* A4 Sheet — 4 cols × 5 rows = 20 QR codes */}
      <div
        className="flex flex-wrap mx-auto"
        style={{ width: '210mm', minHeight: '297mm', padding: '5mm 3mm' }}
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <QRSlot key={i} />
        ))}
      </div>
    </div>
  );
}