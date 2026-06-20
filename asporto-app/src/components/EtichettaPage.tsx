import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Package, Truck, Calendar, Barcode } from 'lucide-react';

interface Etichetta {
  id: string;
  lotto: string;
  prodotto_id: string;
  data_preparazione: string;
  data_scadenza: string;
  created_at: string;
}

interface Prodotto {
  id: string;
  nome_prodotto: string;
  ingredienti: string;
  allergeni: string;
  conservazione: string;
}

interface Fornitore {
  id: string;
  nome: string;
  partita_iva: string;
  telefono: string;
}

export default function EtichettaPage() {
  const { lotto } = useParams<{ lotto: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [etichetta, setEtichetta] = useState<Etichetta | null>(null);
  const [prodotto, setProdotto] = useState<Prodotto | null>(null);
  const [fornitori, setFornitori] = useState<Fornitore[]>([]);

  useEffect(() => {
    if (!lotto) { setError('Nessun lotto specificato'); setLoading(false); return; }

    (async () => {
      try {
        const { data: et, error: e1 } = await supabase
          .from('haccp_etichette')
          .select('*')
          .eq('lotto', lotto)
          .single();
        if (e1 || !et) { setError('Etichetta non trovata per questo lotto'); setLoading(false); return; }
        setEtichetta(et);

        const { data: prod } = await supabase
          .from('haccp_prodotti')
          .select('*')
          .eq('id', et.prodotto_id)
          .single();
        if (prod) setProdotto(prod);

        const { data: links } = await supabase
          .from('haccp_prodotti_fornitori')
          .select('fornitore_id')
          .eq('prodotto_id', et.prodotto_id);
        if (links && links.length > 0) {
          const ids = links.map(l => l.fornitore_id);
          const { data: forn } = await supabase
            .from('haccp_fornitori')
            .select('*')
            .in('id', ids);
          if (forn) setFornitori(forn);
        }
      } catch {
        setError('Errore nel caricamento dei dati');
      } finally {
        setLoading(false);
      }
    })();
  }, [lotto]);

  function formatDate(d: string) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white/50 text-sm font-bold animate-pulse">Caricamento...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Barcode size={48} className="mx-auto mb-4 text-gray-600" />
          <h1 className="text-white font-black text-xl mb-2">Lotto non trovato</h1>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-surface-light">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck size={20} className="text-gold" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Tracciabilità HACCP</span>
          </div>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter mt-2">
            {prodotto?.nome_prodotto || 'Prodotto'}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] font-mono bg-charcoal px-3 py-1 rounded-full text-gold font-bold tracking-wider">
              Lotto: {etichetta?.lotto}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Date */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface border border-surface-light rounded-2xl p-5">
            <div className="flex items-center gap-2 text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">
              <Calendar size={14} /> Preparazione
            </div>
            <p className="text-white font-bold text-lg">{etichetta?.data_preparazione ? formatDate(etichetta.data_preparazione) : ''}</p>
          </div>
          <div className="bg-surface border border-surface-light rounded-2xl p-5">
            <div className="flex items-center gap-2 text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">
              <Calendar size={14} /> Scadenza
            </div>
            <p className="text-amber-400 font-bold text-lg">{etichetta?.data_scadenza ? formatDate(etichetta.data_scadenza) : ''}</p>
          </div>
        </div>

        {/* Allergeni */}
        {prodotto?.allergeni && (
          <div className="bg-surface border border-surface-light rounded-2xl p-5">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Allergeni</p>
            <p className="text-red-400 font-bold">{prodotto.allergeni}</p>
          </div>
        )}

        {/* Ingredienti */}
        {prodotto?.ingredienti && (
          <div className="bg-surface border border-surface-light rounded-2xl p-5">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Ingredienti</p>
            <p className="text-gray-300 text-sm leading-relaxed">{prodotto.ingredienti}</p>
          </div>
        )}

        {/* Conservazione */}
        {prodotto?.conservazione && (
          <div className="bg-surface border border-surface-light rounded-2xl p-5">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Conservazione</p>
            <p className="text-gray-300 text-sm">{prodotto.conservazione}</p>
          </div>
        )}

        {/* Fornitori */}
        {fornitori.length > 0 && (
          <div className="bg-surface border border-surface-light rounded-2xl p-5">
            <div className="flex items-center gap-2 text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3">
              <Truck size={14} /> Fornitori
            </div>
            <div className="space-y-3">
              {fornitori.map(f => (
                <div key={f.id} className="bg-charcoal rounded-xl p-4">
                  <p className="text-white font-bold">{f.nome}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                    {f.partita_iva && <span>P.IVA: {f.partita_iva}</span>}
                    {f.telefono && <span>Tel: {f.telefono}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <p className="text-[10px] text-gray-600 font-mono">
            Documento generato da Risto HACCP &mdash; {etichetta?.created_at ? formatDate(etichetta.created_at) : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
