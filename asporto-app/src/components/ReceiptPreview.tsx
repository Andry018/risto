import type { CustomizedItem } from '../types/entities';
import { PORTATE } from '../types/entities';
import { Printer, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  pickupTime: string;
  items: CustomizedItem[];
  variant?: 'kitchen' | 'receipt';
  onPrint?: () => void;
}

const PORTATA_ORDER = ['1', '2', '3', '4', '5', '_'];
const CATEGORIES_NO_KITCHEN = ['Bevande', 'Caffè e Liquori', 'Servizio'];
const VARIANT_NOISE = ['Pizze Bianca', 'Pizze Rosse', 'Pizze', 'Impasto'];
const PIZZA_VARIANTS = new Set(['Bianca', 'Rossa', 'Rosè', 'Rose']);
const PRIORITY_MODS = ['Senza Glutine', 'Senza Lattosio'];

function portataLabel(key: string): string {
  const p = PORTATE.find(portata => portata.value === key);
  return p?.label || (key === '_' ? 'Senza uscita' : key);
}

function truncate(text: string, max = 34): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function groupItems(items: CustomizedItem[]) {
  const grouped = new Map<string, CustomizedItem[]>();
  for (const item of items) {
    const key = item.portata || '_';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }
  return [...grouped.entries()].sort((a, b) => PORTATA_ORDER.indexOf(a[0]) - PORTATA_ORDER.indexOf(b[0]));
}

function getItemExtras(item: CustomizedItem) {
  return item.addedIngredients.filter(a => !VARIANT_NOISE.includes(a.nome));
}

function normalizeVariantNotes(text: string) {
  return text
    .replace(/\b(Bianca|Rossa|Ros[eè])\b/gi, '')
    .replace(/,\s*,/g, ',')
    .replace(/^,\s*/, '')
    .replace(/,\s*$/, '')
    .trim();
}

function getPriorityMods(item: CustomizedItem) {
  return item.addedIngredients
    .filter(a => PRIORITY_MODS.includes(a.nome))
    .map(a => a.nome);
}

function getDisplayName(item: CustomizedItem) {
  const extras = item.addedIngredients.map(a => a.nome);
  const variant = extras.find(name => PIZZA_VARIANTS.has(name)) || item.notes.split(',').map(s => s.trim()).find(name => PIZZA_VARIANTS.has(name));
  const baseName = item.nome.trim();
  if (variant && !baseName.toLowerCase().includes(variant.toLowerCase())) {
    return `${baseName} ${variant}`.toUpperCase();
  }
  return baseName.toUpperCase();
}

export default function ReceiptPreview({ isOpen, onClose, customerName, pickupTime, items, variant = 'kitchen', onPrint }: Props) {
  if (!isOpen) return null;

  const filteredItems = items.filter(i => i.nome !== 'COPERTO' && (variant === 'receipt' || !CATEGORIES_NO_KITCHEN.includes(i.categoria)));
  const sortedGroups = groupItems(filteredItems);
  const isKitchen = variant === 'kitchen';
  const timeLabel = isKitchen ? 'ORARIO ORDINE' : 'ORARIO USCITA';
  const headerLabel = isKitchen ? 'TAVOLO' : 'CLIENTE';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-[80mm] max-w-[calc(100vw-1rem)] bg-white text-black border border-black overflow-hidden"
        style={{ fontFamily: '"Arial Black", Arial, Helvetica, sans-serif' }}
      >
        <div className="flex items-start justify-between gap-3 p-3 border-b border-black">
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-black uppercase leading-none mt-1 truncate">{truncate(customerName || 'TAVOLO', 18)}</h2>
          </div>
          <button onClick={onClose} className="shrink-0 w-8 h-8 border border-black/20 flex items-center justify-center active:scale-95">
            <X size={16} />
          </button>
        </div>

        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between gap-3 border border-black px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-black/55">{headerLabel}</p>
              <p className="text-[20px] font-black uppercase leading-none mt-1 truncate">{truncate(customerName || 'TAVOLO', 18)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-black/55">{timeLabel}</p>
              <p className="text-[20px] font-black leading-none mt-1">{pickupTime || '--:--'}</p>
            </div>
          </div>
        </div>

        <div className="px-3 pb-3 space-y-2">
          {sortedGroups.map(([portata, groupItems], index) => {
            const info = PORTATE.find(p => p.value === portata);
            return (
              <div key={portata} className="break-inside-avoid">
                {index > 0 && <div className="border-t border-black my-2" />}
                <div className={`inline-flex items-center gap-2 px-2 py-1 border text-[11px] font-black uppercase tracking-[0.3em] ${info?.color || 'text-black border-black/20 bg-black/5'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {portataLabel(portata)}
                </div>

                <div className="mt-2 space-y-1.5">
                  {groupItems.map((item, idx) => {
                    const extras = getItemExtras(item).filter(a => !PIZZA_VARIANTS.has(a.nome));
                    const priorityMods = getPriorityMods(item);
                    const notes = normalizeVariantNotes(item.notes.trim());
                    return (
                      <div key={`${portata}-${idx}`} className="border border-black/10 px-2.5 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-black uppercase leading-tight break-words">
                              <span className="mr-1">{item.quantity}x</span>
                              {truncate(getDisplayName(item), 34)}
                            </p>
                          </div>
                        </div>

                        {(priorityMods.length > 0 || extras.length > 0 || item.removedIngredients.length > 0 || notes) && (
                          <div className="mt-1 space-y-0.5">
                            {priorityMods.length > 0 && (
                              <p className="text-[16px] font-black text-black leading-tight break-words">
                                {priorityMods.join(' / ')}
                              </p>
                            )}
                            {extras.length > 0 && (
                              <p className="text-[15px] font-bold text-black/80 leading-tight break-words">
                                + {truncate(extras.map(a => a.nome).join(', '), 44)}
                              </p>
                            )}
                            {item.removedIngredients.length > 0 && (
                              <p className="text-[15px] font-bold text-black/60 leading-tight break-words">
                                - {truncate(item.removedIngredients.join(', '), 44)}
                              </p>
                            )}
                            {notes && (
                              <p className="text-[16px] font-bold italic text-black/80 leading-tight break-words">
                                NOTE: {truncate(notes.toUpperCase(), 46)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {sortedGroups.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-lg font-black text-black/50 uppercase tracking-[0.2em]">Nessun piatto da preparare</p>
            </div>
          )}
        </div>

        {!isKitchen && (
          <div className="px-3 pb-3">
            <div className="pt-2 border-t border-black text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.35em] text-black/50">{new Date().toLocaleString('it-IT')}</p>
            </div>
          </div>
        )}

        {onPrint && (
          <div className="px-3 pb-3">
            <button
              onClick={onPrint}
              className="w-full py-3 bg-black text-white font-black uppercase text-[12px] tracking-[0.3em] flex items-center justify-center gap-2 active:scale-95"
            >
              <Printer size={16} /> STAMPA ORA
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
