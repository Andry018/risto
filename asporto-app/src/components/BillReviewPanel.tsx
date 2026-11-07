import type { CustomizedItem, Ingredient } from '../types/entities';
import { calculateItemPrice } from '../lib/priceUtils';
import type { PendingSummary } from '../lib/orderPending';
import { X, Receipt, Users, Plus, Pause, DoorOpen, CheckCircle, ChefHat, Save, Percent } from 'lucide-react';

interface Props {
  cart: CustomizedItem[];
  ingredients: Ingredient[];
  tableName: string | null;
  covers: number;
  total: number;
  discountedTotal: number;
  scontoTipo: 'percentuale' | 'fisso' | null;
  scontoValore: number;
  pending: PendingSummary;
  isTable: boolean;
  busy: boolean;
  printBusy: boolean;
  portate: readonly { value: string; label: string; color: string }[];
  onClose: () => void;
  onDiscount: () => void;
  onPrintReceipt: () => void;
  onSend: () => void;
  onSplit: () => void;
  onHold: () => void;
  onFreeTable: () => void;
  onCheckout: () => void;
}

const euro = (n: number) => `€${n.toFixed(2)}`;

/**
 * Riepilogo del conto (POS): lo scontrino a sinistra, le azioni a destra in ordine d'uso.
 * Si apre entrando in un tavolo che ha già una comanda, o dal pulsante "Riepilogo" dello scontrino.
 */
export default function BillReviewPanel({
  cart, ingredients, tableName, covers, total, discountedTotal, scontoTipo, scontoValore, pending,
  isTable, busy, printBusy, portate,
  onClose, onDiscount, onPrintReceipt, onSend, onSplit, onHold, onFreeTable, onCheckout,
}: Props) {
  const toPay = scontoTipo ? discountedTotal : total;
  const pieces = cart.filter(i => i.categoria !== 'Servizio').reduce((s, i) => s + i.quantity, 0);

  // righe raggruppate per uscita (senza uscita in fondo)
  const groups = new Map<string, CustomizedItem[]>();
  for (const item of cart) {
    const k = item.portata || '_';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(item);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === '_' ? 99 : Number(a)) - (b === '_' ? 99 : Number(b)));

  return (
    <div className="fixed inset-0 z-[100] flex bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="flex-1 min-h-0 p-3 md:p-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-3 md:gap-4">
        {/* ── Scontrino ─────────────────────────────────────────── */}
        <section className="bg-surface border border-surface-light rounded-3xl overflow-hidden flex flex-col min-h-0">
          <header className="px-5 py-4 border-b border-surface-light flex items-center gap-4">
            <button
              onClick={onClose}
              aria-label="Chiudi riepilogo"
              className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-charcoal border border-surface-light text-gray-300 active:scale-95"
            >
              <X size={20} />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-400">Riepilogo conto</p>
              <h2 className="text-2xl font-black text-white tracking-tight truncate">{tableName || 'Banco'}</h2>
            </div>
            <div className="ml-auto flex gap-2 text-sm">
              {covers > 0 && (
                <span className="px-3 py-1.5 rounded-xl bg-charcoal border border-surface-light text-gray-200 font-bold flex items-center gap-1.5">
                  <Users size={14} className="text-gold" /> {covers} coperti
                </span>
              )}
              <span className="px-3 py-1.5 rounded-xl bg-charcoal border border-surface-light text-gray-200 font-bold">
                {pieces} {pieces === 1 ? 'piatto' : 'piatti'}
              </span>
            </div>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 custom-scrollbar">
            {ordered.map(([k, items]) => {
              const meta = portate.find(p => p.value === k);
              const sub = items.reduce((s, i) => s + calculateItemPrice(i, ingredients), 0);
              return (
                <div key={k} className="mb-4">
                  <div className="flex items-center justify-between py-1.5 border-b border-surface-light">
                    <span className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${meta?.color ?? 'text-gray-400 border-surface-light'}`}>
                      {meta?.label ?? 'Senza uscita'}
                    </span>
                    <span className="text-xs font-bold text-gray-400 tabular-nums">{euro(sub)}</span>
                  </div>
                  {items.map(item => {
                    const fresh = pending.newQtyById.get(item.uniqueId) || 0;
                    return (
                      <div key={item.uniqueId} className="flex items-start gap-3 py-2.5 border-b border-surface-light/40 last:border-0">
                        <span className="w-9 shrink-0 text-right font-black text-gold tabular-nums">{item.quantity}×</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white leading-snug">
                            {item.nome}
                            {fresh > 0 && (
                              <span className="ml-2 align-middle text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md bg-gold text-black">
                                {fresh === item.quantity ? 'da inviare' : `+${fresh} da inviare`}
                              </span>
                            )}
                          </p>
                          {(item.addedIngredients.length > 0 || item.removedIngredients.length > 0 || item.notes) && (
                            <p className="text-xs mt-0.5 leading-snug">
                              {item.addedIngredients.map(a => <span key={a.nome} className="text-emerald-400 mr-2">+{a.nome}</span>)}
                              {item.removedIngredients.map(r => <span key={r} className="text-rose-400 mr-2">senza {r}</span>)}
                              {item.notes && <span className="text-amber-300 italic">“{item.notes}”</span>}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 font-bold text-white tabular-nums">{euro(calculateItemPrice(item, ingredients))}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {cart.length === 0 && <p className="py-16 text-center text-gray-400 font-bold">Nessun piatto sul conto</p>}
          </div>

          {/* Totale */}
          <footer className="px-5 py-4 border-t border-surface-light bg-charcoal/60 flex items-end justify-between gap-4">
            <div className="text-sm text-gray-400 space-y-0.5">
              {scontoTipo && (
                <p>
                  Subtotale <span className="line-through tabular-nums">{euro(total)}</span>
                  <span className="ml-2 text-emerald-400 font-bold">
                    sconto {scontoTipo === 'percentuale' ? `${scontoValore}%` : euro(scontoValore)}
                  </span>
                </p>
              )}
              {covers > 1 && toPay > 0 && <p>A testa <span className="font-bold text-gray-200 tabular-nums">{euro(toPay / covers)}</span></p>}
              <button type="button" onClick={onDiscount} className="flex items-center gap-1 font-bold text-gray-400 hover:text-gold">
                <Percent size={14} /> {scontoTipo ? 'Modifica sconto' : 'Applica sconto'}
              </button>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-400">Totale</p>
              <p className="text-5xl font-black text-gold tabular-nums tracking-tight leading-none">{euro(toPay)}</p>
            </div>
          </footer>
        </section>

        {/* ── Azioni ───────────────────────────────────────────── */}
        <aside className="bg-surface border border-surface-light rounded-3xl p-4 flex flex-col gap-2.5 min-h-0 overflow-y-auto">
          <button
            onClick={onCheckout}
            disabled={cart.length === 0 || busy}
            className="w-full min-h-[72px] bg-gold hover:bg-gold-hover text-black font-black text-xl rounded-2xl shadow-lg shadow-gold/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {busy ? 'Attendi…' : <>Chiudi conto <CheckCircle size={22} /></>}
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            {isTable && (
              <button
                onClick={onSplit}
                disabled={cart.length === 0 || busy}
                className="min-h-[64px] rounded-2xl bg-charcoal border border-surface-light text-white font-bold flex flex-col items-center justify-center gap-1 active:scale-95 disabled:opacity-40"
              >
                <Users size={18} className="text-gold" /> Dividi conto
              </button>
            )}
            <button
              onClick={onPrintReceipt}
              disabled={cart.length === 0 || printBusy}
              className={`min-h-[64px] rounded-2xl bg-charcoal border border-surface-light text-white font-bold flex flex-col items-center justify-center gap-1 active:scale-95 disabled:opacity-40 ${isTable ? '' : 'col-span-2'}`}
            >
              <Receipt size={18} className="text-sky-300" /> {printBusy ? 'Stampa…' : 'Stampa ricevuta'}
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full min-h-[56px] rounded-2xl bg-charcoal border border-surface-light text-white font-bold flex items-center justify-center gap-2 active:scale-95"
          >
            <Plus size={18} className="text-gold" /> Aggiungi piatti / modifica
          </button>

          {isTable && pending.dirty && (
            <button
              onClick={onSend}
              disabled={busy}
              className="w-full min-h-[56px] rounded-2xl bg-amber-500/15 border border-amber-500/50 text-amber-200 font-black flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40"
            >
              {pending.count > 0
                ? <><ChefHat size={18} /> Invia {pending.count} {pending.count === 1 ? 'nuovo' : 'nuovi'} in cucina</>
                : <><Save size={18} /> Salva modifiche</>}
            </button>
          )}

          {/* azioni rare, separate */}
          <div className="mt-auto pt-3 border-t border-surface-light grid grid-cols-2 gap-2">
            <button
              onClick={onHold}
              disabled={cart.length === 0 || busy}
              className="min-h-[48px] rounded-xl bg-transparent border border-surface-light text-amber-300 font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-40"
            >
              <Pause size={16} /> In sospeso
            </button>
            {isTable && (
              <button
                onClick={onFreeTable}
                disabled={busy}
                title="Libera il tavolo senza registrare una vendita"
                className="min-h-[48px] rounded-xl bg-transparent border border-rose-500/30 text-rose-300 font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-40"
              >
                <DoorOpen size={16} /> Libera tavolo
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
