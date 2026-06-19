import { useEffect, useState } from 'react';
import { X, FileText, Link, Type, Share2, CheckCircle, AlertCircle } from 'lucide-react';
import { IS_DEMO_MODE } from '../lib/supabase';
import {
  generateInvoicePdf,
  uploadPdfToStorage,
  saveDocumentMetadata,
  fetchCompletedOrders,
  generateDocNumber,
  fetchUniqueCustomers,
} from '../lib/billingUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BillingModal({ isOpen, onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<'linked' | 'manual'>('linked');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualTotal, setManualTotal] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [pivaCf, setPivaCf] = useState('');
  const [codiceUnivoco, setCodiceUnivoco] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [docDate, setDocDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'contanti' | 'carta'>('contanti');
  const [completedOrders, setCompletedOrders] = useState<{ id: string; nome_cliente: string; totale: number; created_at: string }[]>([]);
  const [customerSuggestions, setCustomerSuggestions] = useState<{ customer_name: string; piva_cf: string; customer_address: string; company_name: string }[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [docNumber, setDocNumber] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; fileUrl?: string; docNumber?: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setResult(null);
    setError('');
    setGenerating(false);
    setSelectedOrderId('');
    setManualDescription('');
    setManualTotal('');
    setCustomerName('');
    setPivaCf('');
    setCodiceUnivoco('');
    setCustomerAddress('');
    setCompanyName('');
    setPaymentMethod('contanti');
    generateDocNumber().then(setDocNumber);
    setDocDate(new Date().toISOString().split('T')[0]);

    if (!IS_DEMO_MODE) {
      fetchCompletedOrders().then(setCompletedOrders);
      fetchUniqueCustomers().then(setCustomerSuggestions);
    } else {
      setCompletedOrders([
        { id: 'o_demo_1', nome_cliente: 'MARIO ROSSI', totale: 18.5, created_at: new Date().toISOString() },
        { id: 'o_demo_2', nome_cliente: 'LUCA BIANCHI', totale: 25.0, created_at: new Date().toISOString() },
      ]);
    }
  }, [isOpen]);

  const selectedOrder = completedOrders.find(o => o.id === selectedOrderId);
  const description = mode === 'linked' ? 'Consumazione Pranzo/Cena' : manualDescription;
  const total = mode === 'linked' ? selectedOrder?.totale : parseFloat(manualTotal.replace(',', '.'));
  const canGenerate = mode === 'linked'
    ? selectedOrderId && customerName.trim()
    : manualDescription.trim() && manualTotal.trim() && !isNaN(total as number) && (total as number) >= 0 && customerName.trim();

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setError('');
    setResult(null);

    let aborted = false;
    const timeout = setTimeout(() => {
      aborted = true;
      setError('Timeout: la generazione ha impiegato troppo tempo. Riprova.');
      setGenerating(false);
    }, 25000);

    try {
      const now = new Date().toISOString();

      const pdfBlob = await generateInvoicePdf({
        docNumber,
        companyName: companyName.trim(),
        customerName: customerName.trim(),
        pivaCf: pivaCf.trim(),
        customerAddress: customerAddress.trim(),
        codiceUnivoco: codiceUnivoco.trim(),
        description,
        total: total as number,
        paymentMethod,
        docDate,
        createdAt: now,
      });

      if (aborted) return;
      if (pdfBlob.size === 0) throw new Error('PDF generato vuoto');

      let fileUrl = '';
      if (!IS_DEMO_MODE) {
        fileUrl = (await uploadPdfToStorage(pdfBlob, docNumber)) || '';
        if (aborted) return;
        const saved = await saveDocumentMetadata({
          doc_number: docNumber,
          customer_name: customerName.trim(),
          piva_cf: pivaCf.trim(),
          customer_address: customerAddress.trim(),
          company_name: companyName.trim(),
          codice_univoco: codiceUnivoco.trim(),
          description,
          total: total as number,
          payment_method: paymentMethod,
          doc_date: docDate,
          file_url: fileUrl,
          mode,
          order_id: mode === 'linked' ? selectedOrderId : undefined,
        });
        if (!saved) throw new Error('Errore salvataggio documento');
      }

      clearTimeout(timeout);
      setResult({ success: true, fileUrl, docNumber });
      if (onSuccess) onSuccess();
    } catch (e) {
      clearTimeout(timeout);
      if (!aborted) setError(e instanceof Error ? e.message : 'Errore durante la generazione');
    } finally {
      clearTimeout(timeout);
      if (!aborted) setGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!result?.fileUrl) return;
    try {
      await navigator.share({
        title: `Fattura ${result.docNumber}`,
        text: `Fattura ${result.docNumber} - ${customerName}`,
        url: result.fileUrl,
      });
    } catch {
      // user cancelled or unsupported
    }
  };

  const handleCustomerSelect = (name: string, cf: string, address: string, comp: string) => {
    setCustomerName(name);
    setPivaCf(cf);
    setCustomerAddress(address);
    setCompanyName(comp);
    setShowCustomerDropdown(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-surface-light w-full max-w-lg rounded-[32px] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="p-6 border-b border-surface-light flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold/20 rounded-2xl flex items-center justify-center">
              <FileText size={20} className="text-gold" />
            </div>
            <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">
              Nuova <span className="text-gold">Fattura</span>
            </h2>
          </div>
          <button onClick={onClose} className="p-2 bg-charcoal border border-surface-light rounded-xl text-gray-500 hover:text-white transition-all active:scale-90">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Mode Selection */}
          <div className="grid grid-cols-2 gap-2 bg-charcoal p-1 rounded-2xl border border-surface-light">
            <button
              onClick={() => setMode('linked')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs transition-all ${
                mode === 'linked' ? 'bg-gold text-black shadow-lg' : 'text-gray-500 hover:text-white'
              }`}
            >
              <Link size={14} /> DA ORDINE
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs transition-all ${
                mode === 'manual' ? 'bg-gold text-black shadow-lg' : 'text-gray-500 hover:text-white'
              }`}
            >
              <Type size={14} /> MANUALE
            </button>
          </div>

          {/* Doc Number (editable) */}
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Numero Documento</label>
            <input
              type="text"
              value={docNumber}
              onChange={e => setDocNumber(e.target.value)}
              placeholder="Doc-2026-001"
              className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50 transition-all"
            />
          </div>

          {/* Mode A: Linked to Order */}
          {mode === 'linked' && (
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Ordine Completato</label>
              <select
                value={selectedOrderId}
                onChange={e => {
                  setSelectedOrderId(e.target.value);
                  const order = completedOrders.find(o => o.id === e.target.value);
                  if (order && !customerName) setCustomerName(order.nome_cliente);
                }}
                className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50 transition-all appearance-none"
              >
                <option value="">Seleziona ordine...</option>
                {completedOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.nome_cliente} — {new Date(o.created_at).toLocaleDateString('it-IT')} — €{o.totale.toFixed(2)}
                  </option>
                ))}
              </select>
              {selectedOrder && (
                <div className="mt-3 bg-charcoal/50 border border-surface-light rounded-2xl p-4">
                  <p className="text-sm text-gray-400 font-bold">
                    <span className="text-white">{selectedOrder.nome_cliente}</span>
                  </p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Consumazione Pranzo/Cena</span>
                    <span className="font-black text-gold text-lg">€{selectedOrder.totale.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mode B: Manual */}
          {mode === 'manual' && (
            <>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Descrizione</label>
                <input
                  type="text"
                  value={manualDescription}
                  onChange={e => setManualDescription(e.target.value)}
                  placeholder="es. Servizio Catering"
                  className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Totale (€)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={manualTotal}
                  onChange={e => setManualTotal(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50 transition-all"
                />
              </div>
            </>
          )}

          {/* Cliente fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Nome Cliente *</label>
              <div className="relative">
                <input
                  type="text"
                  value={customerName}
                  onChange={e => {
                    setCustomerName(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                  placeholder="Mario Rossi"
                  className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50 transition-all"
                />
                {showCustomerDropdown && customerSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-surface-light rounded-2xl shadow-2xl z-10 max-h-40 overflow-y-auto">
                    {customerSuggestions
                      .filter(s => s.customer_name.toLowerCase().includes(customerName.toLowerCase()))
                      .map((s, i) => (
                        <button
                          key={i}
                          onMouseDown={() => handleCustomerSelect(s.customer_name, s.piva_cf, s.customer_address, s.company_name)}
                          className="w-full text-left px-4 py-3 text-sm font-bold text-white hover:bg-charcoal transition-all border-b border-surface-light/50 last:border-0"
                        >
                          <span>{s.customer_name}</span>
                          {s.piva_cf && <span className="text-gray-500 font-normal ml-2">({s.piva_cf})</span>}
                          {s.company_name && <span className="text-gray-600 font-normal ml-2">— {s.company_name}</span>}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">P.IVA / C.F.</label>
              <input
                type="text"
                value={pivaCf}
                onChange={e => setPivaCf(e.target.value)}
                placeholder="12345678901"
                className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Codice Univoco / PEC</label>
            <input
              type="text"
              value={codiceUnivoco}
              onChange={e => setCodiceUnivoco(e.target.value)}
              placeholder="7X9XYZW oppure pec@azienda.it"
              className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Nome Azienda</label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Ristorante XYZ SRL"
                className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Indirizzo</label>
              <input
                type="text"
                value={customerAddress}
                onChange={e => setCustomerAddress(e.target.value)}
                placeholder="Via Roma 1, Milano"
                className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Data Fattura</label>
              <input
                type="date"
                value={docDate}
                onChange={e => setDocDate(e.target.value)}
                className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Metodo Pagamento</label>
              <div className="grid grid-cols-2 gap-2 bg-charcoal p-1 rounded-2xl border border-surface-light">
                <button
                  onClick={() => setPaymentMethod('contanti')}
                  className={`py-3 rounded-xl font-black text-xs transition-all ${
                    paymentMethod === 'contanti' ? 'bg-gold text-black shadow-lg' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  CONTANTI
                </button>
                <button
                  onClick={() => setPaymentMethod('carta')}
                  className={`py-3 rounded-xl font-black text-xs transition-all ${
                    paymentMethod === 'carta' ? 'bg-gold text-black shadow-lg' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  CARTA
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Success Result */}
          {result?.success && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
                <CheckCircle size={18} /> Fattura generata con successo!
              </div>
              <p className="text-xs text-gray-400 font-bold">{result.docNumber}</p>
              <button
                onClick={handleShare}
                disabled={!result.fileUrl}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-black text-sm py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Share2 size={16} /> Condividi
              </button>
            </div>
          )}

          {/* Generate Button */}
          {!result?.success && (
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
              className="w-full bg-gold hover:bg-gold-hover text-black font-black text-lg py-4 rounded-2xl shadow-lg shadow-gold/20 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
            >
              {generating ? (
                <>Generazione in corso…</>
              ) : (
                <><FileText size={20} /> Genera Fattura</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
