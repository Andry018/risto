import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { ArrowLeft, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';

const BASE_URL = window.location.origin;

export default function MenuQRView() {
  const [tableName, setTableName] = useState('');

  const url = tableName.trim()
    ? `${BASE_URL}/menu?tavolo=${encodeURIComponent(tableName.trim())}`
    : `${BASE_URL}/menu`;

  return (
    <div className="min-h-screen bg-[#f8f7f4] flex flex-col items-center justify-center p-8">
      <div className="bg-white rounded-[40px] shadow-2xl p-10 flex flex-col items-center max-w-sm w-full">
        <div className="w-20 h-20 bg-gradient-to-br from-gold to-amber-600 rounded-[20px] flex items-center justify-center mb-6 shadow-lg">
          <span className="text-3xl font-black text-black">IG</span>
        </div>
        <h1 className="text-2xl font-black text-gray-800 text-center mb-1">Il Girasole</h1>
        <p className="text-sm text-gray-500 font-medium mb-6">Ristorante Pizzeria</p>

        <div className="w-full mb-6">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 block text-center">
            Tavolo (opzionale)
          </label>
          <input
            type="text"
            value={tableName}
            onChange={e => setTableName(e.target.value)}
            placeholder="es. 5 o Sala Interna"
            className="w-full bg-gray-100 border border-gray-200 rounded-2xl p-3.5 text-sm font-bold text-gray-800 outline-none focus:border-gold transition-colors text-center"
          />
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100 mb-4">
          <QRCodeCanvas
            value={url}
            size={200}
            bgColor="#ffffff"
            fgColor="#1a1a1a"
            level="M"
          />
        </div>

        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest text-center mb-2">
          {tableName.trim() ? `Menu — Tavolo ${tableName}` : 'Menu digitale'}
        </p>

        <div className="w-full bg-gray-100 rounded-2xl p-3 text-center mb-6">
          <p className="text-[9px] text-gray-500 font-mono break-all">{url}</p>
        </div>

        <div className="flex gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} /> Home
          </Link>
          {tableName.trim() && (
            <button
              onClick={() => {
                const canvas = document.querySelector('canvas');
                if (canvas) {
                  const link = document.createElement('a');
                  link.download = `QR-${tableName.trim()}.png`;
                  link.href = canvas.toDataURL();
                  link.click();
                }
              }}
              className="flex items-center gap-2 text-sm font-bold text-gold hover:text-amber-600 transition-colors"
            >
              <Printer size={16} /> Scarica QR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
