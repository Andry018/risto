import { QRCodeCanvas } from 'qrcode.react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const MENU_URL = 'https://risto-taupe.vercel.app/menu';

export default function MenuQRView() {
  return (
    <div className="min-h-screen bg-[#f8f7f4] flex flex-col items-center justify-center p-8">
      <div className="bg-white rounded-[40px] shadow-2xl p-10 flex flex-col items-center max-w-sm w-full">
        <div className="w-20 h-20 bg-gradient-to-br from-gold to-amber-600 rounded-[20px] flex items-center justify-center mb-6 shadow-lg">
          <span className="text-3xl font-black text-black">IG</span>
        </div>
        <h1 className="text-2xl font-black text-gray-800 text-center mb-1">Il Girasole</h1>
        <p className="text-sm text-gray-500 font-medium mb-8">Ristorante Pizzeria</p>
        <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100 mb-6">
          <QRCodeCanvas
            value={MENU_URL}
            size={220}
            bgColor="#ffffff"
            fgColor="#1a1a1a"
            level="M"
          />
        </div>
        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest text-center mb-2">
          Inquadra per vedere il menu
        </p>
        <div className="w-full bg-gray-100 rounded-2xl p-3 text-center mb-6">
          <p className="text-[9px] text-gray-500 font-mono break-all">{MENU_URL}</p>
        </div>
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={16} /> Torna alla home
        </Link>
      </div>
    </div>
  );
}