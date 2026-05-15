import { useEffect, useState } from 'react';
import { FileText, Download, Share2, Plus, Search } from 'lucide-react';
import type { DocumentoEmesso } from '../lib/supabase';
import { fetchDocuments } from '../lib/billingUtils';
import BillingModal from './BillingModal';

export default function ArchiveView() {
  const [documents, setDocuments] = useState<DocumentoEmesso[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const docs = await fetchDocuments();
    setDocuments(docs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = documents.filter(d =>
    d.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    d.doc_number.toLowerCase().includes(search.toLowerCase()) ||
    d.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleDownload = (doc: DocumentoEmesso) => {
    if (doc.file_url) {
      window.open(doc.file_url, '_blank');
    }
  };

  const handleShare = async (doc: DocumentoEmesso) => {
    if (!doc.file_url) return;
    setSharingId(doc.id);
    try {
      await navigator.share({
        title: `Fattura ${doc.doc_number}`,
        text: `Fattura ${doc.doc_number} - ${doc.customer_name}`,
        url: doc.file_url,
      });
    } catch {
      // user cancelled
    } finally {
      setSharingId(null);
    }
  };

  const handleBillingSuccess = () => {
    load();
  };

  return (
    <div className="h-full flex flex-col p-6 bg-charcoal">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">
            Archivio <span className="text-gold">Fatture</span>
          </h2>
          <p className="text-xs text-gray-500 font-bold mt-1">{documents.length} documenti emessi</p>
        </div>
        <button
          onClick={() => setIsBillingOpen(true)}
          className="bg-gold hover:bg-gold-hover text-black font-black text-sm px-5 py-3 rounded-2xl transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-gold/20"
        >
          <Plus size={16} /> Nuova Fattura
        </button>
      </header>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca per cliente, numero o descrizione..."
          className="w-full bg-surface border border-surface-light rounded-2xl py-3 pl-12 pr-4 text-white font-bold text-sm outline-none focus:border-gold/50 transition-all"
        />
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-600">
            <FileText size={48} className="opacity-30 mb-3" />
            <p className="font-black text-[10px] uppercase tracking-widest">Nessun documento trovato</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(doc => (
              <div
                key={doc.id}
                className="bg-surface border border-surface-light rounded-3xl p-5 flex items-center justify-between hover:border-gold/30 transition-all group"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center shrink-0">
                    <FileText size={20} className="text-gold" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-white text-sm">{doc.doc_number}</h3>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        doc.mode === 'linked' ? 'text-sky-400 border-sky-500/30 bg-sky-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                      }`}>
                        {doc.mode === 'linked' ? 'DA ORDINE' : 'MANUALE'}
                      </span>
                    </div>
                    <p className="text-sm text-white font-bold truncate">{doc.customer_name}</p>
                    <p className="text-[10px] text-gray-500 font-bold truncate">{doc.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-gray-600 font-black">{new Date(doc.created_at).toLocaleDateString('it-IT')}</span>
                      {doc.piva_cf && <span className="text-[10px] text-gray-600 font-black">C.F.: {doc.piva_cf}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <div className="text-right mr-3">
                    <p className="font-black text-gold text-lg">€{doc.total.toFixed(2)}</p>
                  </div>
                  {doc.file_url && (
                    <>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="p-3 bg-charcoal border border-surface-light rounded-2xl text-gray-500 hover:text-white hover:border-gold/30 transition-all active:scale-90"
                        title="Scarica"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => handleShare(doc)}
                        disabled={sharingId === doc.id}
                        className="p-3 bg-charcoal border border-surface-light rounded-2xl text-gray-500 hover:text-gold hover:border-gold/30 transition-all active:scale-90 disabled:opacity-50"
                        title="Condividi"
                      >
                        <Share2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BillingModal
        isOpen={isBillingOpen}
        onClose={() => setIsBillingOpen(false)}
        onSuccess={handleBillingSuccess}
      />
    </div>
  );
}
