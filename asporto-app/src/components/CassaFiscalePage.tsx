import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import CassaFiscaleTab from './admin/CassaFiscaleTab';

export default function CassaFiscalePage() {
  const navigate = useNavigate();
  return (
    <div className="h-dvh flex flex-col bg-charcoal text-white overflow-hidden">
      <header className="flex items-center gap-4 px-6 pt-6 pb-4 flex-shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="p-3 bg-surface border border-surface-light rounded-2xl text-gray-500 hover:text-white transition-all shadow-xl"
        >
          <ArrowLeft size={22} />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-8 md:px-10">
        <CassaFiscaleTab />
      </div>
    </div>
  );
}
