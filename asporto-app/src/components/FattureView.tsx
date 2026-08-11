import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, getDefaultRouteForRole } from '../lib/staffAuth';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import type { DocumentoEmesso } from '../types/entities';
import { LayoutDashboard, FileText, Plus, Download, Share2, Trash2 } from 'lucide-react';
import BillingModal from './BillingModal';
import { useConfirm } from './ConfirmModal';
import { deleteDocument } from '../lib/billingUtils';

export default function FattureView({ onNavigateHome }: { onNavigateHome?: () => void } = {}) {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  useEffect(() => {
    const user = getCurrentUser();
    if (user && user.role !== 'admin') {
      navigate(getDefaultRouteForRole(user.role), { replace: true });
    }
  }, []);

  const [documents, setDocuments] = useState<DocumentoEmesso[]>([]);
  const [billingOpen, setBillingOpen] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);

  async function fetchDocuments() {
    if (IS_DEMO_MODE) { setDocuments([]); return; }
    if (!supabase) return;
    const { data, error } = await supabase.from('documenti_emessi').select('*').order('created_at', { ascending: false }).limit(50);
    if (data) setDocuments(data as DocumentoEmesso[]);
    else if (error && import.meta.env.DEV) console.error(error);
  }

  useEffect(() => { void fetchDocuments(); }, []);

  return (
    <div className="min-h-screen bg-charcoal text-white p-6 md:p-10 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div className="flex items-center gap-6">
            {onNavigateHome ? (
              <button onClick={onNavigateHome} className="p-3 bg-surface border border-surface-light rounded-2xl text-gray-500 hover:text-white transition-all">
                <LayoutDashboard size={24} />
              </button>
            ) : (
              <Link to="/" className="p-3 bg-surface border border-surface-light rounded-2xl text-gray-500 hover:text-white transition-all">
                <LayoutDashboard size={24} />
              </Link>
            )}
            <div>
              <h1 className="text-4xl font-black italic uppercase tracking-tighter">Fatture <span className="text-gold">& Documenti</span></h1>
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mt-1">{documents.length} documenti emessi</p>
            </div>
          </div>
          <Link
            to="/reports"
            className="text-xs font-black text-gray-500 hover:text-gold uppercase tracking-widest transition-all"
          >
            Vai a Report &amp; Analytics →
          </Link>
        </header>

        {IS_DEMO_MODE ? (
          <div className="bg-surface border border-surface-light rounded-[40px] p-8 text-center">
            <p className="text-gray-500 italic">La gestione fatture non è disponibile in modalità demo.</p>
          </div>
        ) : (
          <div className="bg-surface border border-surface-light rounded-[40px] p-8">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <FileText className="text-gold" size={20} />
                <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">Documenti Fiscali</h2>
              </div>
              <button
                onClick={() => setBillingOpen(true)}
                className="bg-gold hover:bg-gold-hover text-black font-black text-sm px-5 py-3 rounded-2xl transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-gold/20"
              >
                <Plus size={16} /> Nuova Fattura
              </button>
            </div>

            {documents.length === 0 ? (
              <p className="text-gray-500 italic text-sm">Nessuna fattura emessa</p>
            ) : (
              <div className="space-y-3">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between bg-charcoal/50 rounded-2xl p-4 border border-surface-light group">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center shrink-0">
                        <FileText size={18} className="text-gold" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white text-sm">{doc.doc_number}</span>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            doc.mode === 'linked' ? 'text-sky-400 border-sky-500/30 bg-sky-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                          }`}>
                            {doc.mode === 'linked' ? 'DA ORDINE' : 'MANUALE'}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-white truncate">{doc.customer_name}</p>
                          {doc.company_name && <p className="text-[10px] text-gray-400 font-bold">{doc.company_name}</p>}
                          {doc.codice_univoco && <p className="text-[10px] text-gray-500 font-bold">Cod. Univoco: {doc.codice_univoco}</p>}
                          <p className="text-[10px] text-gray-500 font-bold">{doc.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <div className="text-right mr-2">
                        <p className="font-black text-gold">€{doc.total.toFixed(2)}</p>
                        <p className="text-[10px] text-gray-600 font-black">{new Date(doc.doc_date || doc.created_at).toLocaleDateString('it-IT')} · {doc.payment_method === 'carta' ? 'CARTA' : 'CONTANTI'}</p>
                      </div>
                      {doc.file_url && (
                        <>
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 bg-charcoal border border-surface-light rounded-xl text-gray-500 hover:text-white hover:border-gold/30 transition-all active:scale-90"
                            title="Scarica"
                          >
                            <Download size={14} />
                          </a>
                          <button
                            onClick={async () => {
                              setSharingId(doc.id);
                              try { await navigator.share({ title: `Fattura ${doc.doc_number}`, url: doc.file_url }); }
                              catch { /* user cancelled */ }
                              finally { setSharingId(null); }
                            }}
                            disabled={sharingId === doc.id}
                            className="p-2.5 bg-charcoal border border-surface-light rounded-xl text-gray-500 hover:text-gold hover:border-gold/30 transition-all active:scale-90 disabled:opacity-50"
                            title="Condividi"
                          >
                            <Share2 size={14} />
                          </button>
                          <button
                            onClick={async () => {
                              const ok = await confirm({ title: 'Elimina fattura', message: `Eliminare la fattura ${doc.doc_number}?`, destructive: true });
                              if (!ok) return;
                              await deleteDocument(doc.id);
                              fetchDocuments();
                            }}
                            className="p-2.5 bg-charcoal border border-surface-light rounded-xl text-gray-500 hover:text-red-400 hover:border-red-500/30 transition-all active:scale-90"
                            title="Elimina"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <footer className="text-center py-8">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.5em]">Il Girasole · Fatture</p>
        </footer>
      </div>

      <BillingModal isOpen={billingOpen} onClose={() => setBillingOpen(false)} onSuccess={() => fetchDocuments()} />
    </div>
  );
}
