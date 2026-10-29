import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Search, Send, Check, CheckCheck, Clock, LogOut, RefreshCw, KeyRound, MessageSquarePlus,
  PanelRightOpen, PanelRightClose, CalendarPlus, ShoppingBag, Users, X, Image as ImageIcon, Loader2, Zap, Pencil,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Reservation } from '../types/entities';
import { toLocalISODate } from '../lib/dateUtils';
import { newUniqueId } from '../lib/id';
import { SETTINGS_KEYS, useSetting } from '../lib/appSettings';
import {
  waApi, subscribeWa, getWaToken, setWaToken, WaError, formatPhone, phonesMatch, chatTitle, messagePreview, kindLabel,
  type WaChat, type WaMessage, type WaConnectionState,
} from '../lib/whatsapp';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmModal';
import { usePrompt } from './PromptModal';

const DEFAULT_QUICK_REPLIES = [
  'Ciao! Grazie per averci scritto 😊 Come possiamo aiutarti?',
  'Per stasera siamo al completo, ci dispiace! Vuoi prenotare per un altro giorno?',
  'Il tuo ordine è pronto per il ritiro 🍕',
  'Siamo aperti a pranzo e a cena. Ti aspettiamo!',
];

export default function WhatsAppView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const { prompt } = usePrompt();

  const [token, setToken] = useState(getWaToken);
  const [connState, setConnState] = useState<WaConnectionState | 'loading' | 'error'>('loading');
  const [connError, setConnError] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const [chats, setChats] = useState<WaChat[]>([]);
  const [search, setSearch] = useState('');
  const activeJid = searchParams.get('jid');
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [media, setMedia] = useState<Record<string, string | 'loading' | 'error'>>({});
  const [showPanel, setShowPanel] = useState(() => window.innerWidth >= 1024);

  const activeJidRef = useRef(activeJid);
  activeJidRef.current = activeJid;
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeChat = useMemo<WaChat | null>(() => {
    if (!activeJid) return null;
    return chats.find(c => c.jid === activeJid) ?? {
      jid: activeJid, name: '', phone: activeJid.endsWith('@s.whatsapp.net') ? activeJid.split('@')[0] : '',
      isGroup: activeJid.endsWith('@g.us'), avatar: null, unread: 0, lastMessage: null, updatedAt: 0,
    };
  }, [chats, activeJid]);

  const handleError = useCallback((err: unknown) => {
    if (err instanceof WaError && err.status === 401) {
      setWaToken('');
      setToken('');
      addToast({ type: 'error', title: 'Token WhatsApp non valido', message: 'Reinseriscilo per questo dispositivo' });
      return;
    }
    setConnState('error');
    setConnError(err instanceof Error ? err.message : 'Errore sconosciuto');
  }, [addToast]);

  const loadChats = useCallback(async () => {
    try { setChats(await waApi.chats()); } catch (err) { handleError(err); }
  }, [handleError]);

  const refreshStatus = useCallback(async () => {
    try {
      const { state } = await waApi.status();
      setConnState(state);
      setConnError('');
      return state;
    } catch (err) {
      handleError(err);
      return null;
    }
  }, [handleError]);

  // Stato iniziale + eventi in tempo reale
  useEffect(() => {
    if (!token) return;
    void refreshStatus().then(state => { if (state === 'open') void loadChats(); });

    return subscribeWa(event => {
      if (event.type === 'connection') {
        setConnState(event.state);
        if (event.state === 'open') { setQr(null); void loadChats(); }
      } else if (event.type === 'qr') {
        setQr(event.qr);
      } else if (event.type === 'status') {
        setMessages(prev => prev.map(m => m.id === event.id ? { ...m, status: event.status } : m));
      } else if (event.type === 'message') {
        const m = event.message;
        const isActive = m.jid === activeJidRef.current;
        if (isActive) {
          setMessages(prev => upsertMessage(prev, m));
          if (!m.fromMe && document.visibilityState === 'visible') void waApi.markRead(m.jid, [m.id]).catch(() => {});
        }
        setChats(prev => {
          const existing = prev.find(c => c.jid === m.jid);
          if (!existing) { void loadChats(); return prev; }
          const updated: WaChat = {
            ...existing,
            name: existing.name || (!m.fromMe ? m.pushName : ''),
            lastMessage: m,
            updatedAt: m.timestamp * 1000,
            unread: isActive || m.fromMe ? existing.unread : existing.unread + 1,
          };
          return [updated, ...prev.filter(c => c.jid !== m.jid)];
        });
      }
    }, () => { void refreshStatus(); });
  }, [token, refreshStatus, loadChats]);

  // Finché non è collegato, controlla lo stato ogni 5 s (il webhook potrebbe non essere ancora configurato)
  useEffect(() => {
    if (!token || connState === 'open' || connState === 'loading') return;
    const id = setInterval(() => {
      void refreshStatus().then(state => { if (state === 'open') { setQr(null); void loadChats(); } });
    }, 5000);
    return () => clearInterval(id);
  }, [token, connState, refreshStatus, loadChats]);

  // Apertura chat: carica messaggi e segna come letti
  useEffect(() => {
    if (!activeJid || connState !== 'open') { setMessages([]); return; }
    let cancelled = false;
    setLoadingMessages(true);
    waApi.messages(activeJid)
      .then(list => {
        if (cancelled) return;
        setMessages(list);
        const unreadIds = list.filter(m => !m.fromMe).slice(-20).map(m => m.id);
        if (unreadIds.length) void waApi.markRead(activeJid, unreadIds).catch(() => {});
        setChats(prev => prev.map(c => c.jid === activeJid ? { ...c, unread: 0 } : c));
      })
      .catch(err => { if (!cancelled) handleError(err); })
      .finally(() => { if (!cancelled) setLoadingMessages(false); });
    return () => { cancelled = true; };
  }, [activeJid, connState, handleError]);

  // Ritorno dall'ordine asporto: prepara il messaggio di conferma (non lo invia da solo)
  useEffect(() => {
    const ora = searchParams.get('asporto');
    if (!ora) return;
    const nome = searchParams.get('nome') || '';
    const totale = searchParams.get('totale');
    setDraft(`Ciao${nome ? ` ${nome}` : ''}! ✅ Abbiamo registrato il tuo ordine d'asporto: ritiro alle ${ora.slice(0, 5)}${totale ? `, totale € ${totale.replace('.', ',')}` : ''}. A dopo!`);
    const next = new URLSearchParams(searchParams);
    ['asporto', 'nome', 'totale'].forEach(k => next.delete(k));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, activeJid]);

  function openChat(jid: string | null) {
    setDraft('');
    setSearchParams(jid ? { jid } : {}, { replace: !!activeJid === !!jid });
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await waApi.connect();
      setConnState(res.state);
      setConnError('');
      if (res.state === 'open') void loadChats();
      else setQr(res.qr);
    } catch (err) {
      handleError(err);
    } finally {
      setConnecting(false);
    }
  }

  async function handleLogout() {
    const ok = await confirm({
      title: 'Scollega WhatsApp',
      message: 'Il telefono verrà scollegato dal gestionale. Per ricollegarlo servirà scansionare di nuovo il QR.',
      confirmLabel: 'Scollega',
      destructive: true,
    });
    if (!ok) return;
    try {
      await waApi.logout();
      setConnState('close');
      setChats([]);
      openChat(null);
    } catch (err) {
      handleError(err);
    }
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || !activeJid || sending) return;
    setSending(true);
    try {
      const sent = await waApi.send(activeJid, text);
      setDraft('');
      setMessages(prev => upsertMessage(prev, sent));
      setChats(prev => {
        const existing = prev.find(c => c.jid === activeJid);
        if (!existing) { void loadChats(); return prev; }
        return [{ ...existing, lastMessage: sent, updatedAt: sent.timestamp * 1000 }, ...prev.filter(c => c.jid !== activeJid)];
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Messaggio non inviato', message: err instanceof Error ? err.message : '' });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function handleNewChat() {
    const value = await prompt({
      title: 'Nuova chat',
      message: 'Numero di telefono (con prefisso, es. 39 333 1234567)',
      placeholder: '39 333 1234567',
    });
    if (!value) return;
    let digits = value.replace(/\D/g, '').replace(/^00/, '');
    if (digits.length === 10 && digits.startsWith('3')) digits = `39${digits}`;   // cellulare italiano senza prefisso
    if (digits.length < 8) { addToast({ type: 'warning', title: 'Numero non valido' }); return; }
    openChat(`${digits}@s.whatsapp.net`);
  }

  async function loadMedia(id: string) {
    setMedia(prev => ({ ...prev, [id]: 'loading' }));
    try {
      const url = await waApi.media(id);
      setMedia(prev => ({ ...prev, [id]: url }));
    } catch {
      setMedia(prev => ({ ...prev, [id]: 'error' }));
    }
  }

  function insertText(text: string) {
    setDraft(prev => prev.trim() ? `${prev.trimEnd()}\n${text}` : text);
    inputRef.current?.focus();
  }

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chats;
    const qDigits = q.replace(/\D/g, '');
    return chats.filter(c => c.name.toLowerCase().includes(q) || (qDigits.length >= 3 && c.phone.includes(qDigits)));
  }, [chats, search]);

  if (!token) {
    return <TokenSetup onBack={() => navigate('/')} onSave={t => { setWaToken(t); setToken(t); setConnState('loading'); }} />;
  }

  return (
    <div className="h-dvh bg-charcoal text-white flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-surface-light shrink-0">
        <button
          onClick={() => navigate('/')}
          className="p-2 bg-surface border border-surface-light rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer"
          aria-label="Torna alla dashboard"
          title="Torna alla dashboard"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black tracking-tight">WhatsApp</h1>
          <ConnectionPill state={connState} />
        </div>
        {connState === 'open' && (
          <>
            <button
              onClick={() => setShowPanel(v => !v)}
              className="p-2 bg-surface border border-surface-light rounded-xl text-gray-400 hover:text-gold transition-colors cursor-pointer"
              aria-label={showPanel ? 'Nascondi azioni rapide' : 'Mostra azioni rapide'}
              title="Azioni rapide"
            >
              {showPanel ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
            </button>
            <button
              onClick={() => void handleLogout()}
              className="p-2 bg-surface border border-surface-light rounded-xl text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
              aria-label="Scollega WhatsApp"
              title="Scollega WhatsApp"
            >
              <LogOut size={20} />
            </button>
          </>
        )}
      </div>

      {connState !== 'open' ? (
        <ConnectPanel
          state={connState}
          error={connError}
          qr={qr}
          connecting={connecting}
          onConnect={() => void handleConnect()}
          onRetry={() => { setConnState('loading'); void refreshStatus(); }}
          onChangeToken={() => { setWaToken(''); setToken(''); }}
        />
      ) : (
        <div className="flex-1 min-h-0 flex relative">
          {/* Elenco chat */}
          <div className={`${activeJid ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 shrink-0 flex-col border-r border-surface-light min-h-0`}>
            <div className="p-3 flex gap-2 shrink-0">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cerca nome o numero"
                  aria-label="Cerca chat"
                  className="w-full bg-surface border border-surface-light rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gold placeholder:text-gray-400"
                />
              </div>
              <button
                onClick={() => void handleNewChat()}
                className="p-2.5 bg-surface border border-surface-light rounded-xl text-gray-400 hover:text-gold transition-colors cursor-pointer"
                aria-label="Nuova chat"
                title="Nuova chat"
              >
                <MessageSquarePlus size={18} />
              </button>
              <button
                onClick={() => void loadChats()}
                className="p-2.5 bg-surface border border-surface-light rounded-xl text-gray-400 hover:text-gold transition-colors cursor-pointer"
                aria-label="Aggiorna chat"
                title="Aggiorna"
              >
                <RefreshCw size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {filteredChats.map(c => (
                <ChatRow key={c.jid} chat={c} active={c.jid === activeJid} onClick={() => openChat(c.jid)} />
              ))}
              {filteredChats.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-10">{search ? 'Nessuna chat trovata' : 'Nessuna chat'}</p>
              )}
            </div>
          </div>

          {/* Conversazione */}
          <div className={`${activeJid ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 flex-col min-h-0`}>
            {activeChat ? (
              <>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-light shrink-0">
                  <button
                    onClick={() => openChat(null)}
                    className="md:hidden p-1.5 text-gray-400 hover:text-white cursor-pointer"
                    aria-label="Torna all'elenco chat"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <Avatar name={chatTitle(activeChat)} src={activeChat.avatar} group={activeChat.isGroup} />
                  <div className="min-w-0">
                    <p className="font-bold truncate">{chatTitle(activeChat)}</p>
                    {activeChat.phone && activeChat.name && (
                      <p className="text-xs text-gray-400">{formatPhone(activeChat.phone)}</p>
                    )}
                  </div>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-8 py-4 space-y-1.5 bg-black/20">
                  {loadingMessages && messages.length === 0 && (
                    <div className="flex justify-center py-10 text-gray-400"><Loader2 className="animate-spin" /></div>
                  )}
                  {!loadingMessages && messages.length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-10">Nessun messaggio. Scrivi per iniziare la conversazione.</p>
                  )}
                  {messages.map((m, i) => (
                    <div key={m.id}>
                      {(i === 0 || dayKey(messages[i - 1].timestamp) !== dayKey(m.timestamp)) && (
                        <div className="flex justify-center my-3">
                          <span className="text-[11px] font-semibold text-gray-400 bg-surface border border-surface-light rounded-lg px-3 py-1">
                            {dayLabel(m.timestamp)}
                          </span>
                        </div>
                      )}
                      <MessageBubble
                        message={m}
                        showSender={activeChat.isGroup && !m.fromMe}
                        media={media[m.id]}
                        onLoadMedia={() => void loadMedia(m.id)}
                      />
                    </div>
                  ))}
                </div>

                <div className="p-3 border-t border-surface-light flex items-end gap-2 shrink-0">
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
                    }}
                    rows={Math.min(5, Math.max(1, draft.split('\n').length))}
                    placeholder="Scrivi un messaggio"
                    aria-label="Messaggio"
                    className="flex-1 resize-none bg-surface border border-surface-light rounded-2xl py-3 px-4 text-sm outline-none focus:border-gold placeholder:text-gray-400 custom-scrollbar"
                  />
                  <button
                    onClick={() => void handleSend()}
                    disabled={!draft.trim() || sending}
                    className="w-12 h-12 shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 flex items-center justify-center transition cursor-pointer"
                    aria-label="Invia"
                  >
                    {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-gray-400 p-8">
                <MessageSquarePlus size={40} strokeWidth={1.2} />
                <p className="font-semibold">Seleziona una chat</p>
                <p className="text-sm">Le azioni rapide per prenotazioni e asporto sono nel pannello a destra.</p>
              </div>
            )}
          </div>

          {/* Azioni rapide */}
          {showPanel && (
            <>
              <div className="lg:hidden absolute inset-0 bg-black/60 z-10" onClick={() => setShowPanel(false)} aria-hidden />
              <QuickPanel
                chat={activeChat}
                onInsertText={insertText}
                onClose={() => setShowPanel(false)}
                onTakeaway={nome => navigate(
                  `/takeaway?nome=${encodeURIComponent(nome)}&returnTo=${encodeURIComponent(`/whatsapp?jid=${activeJid ?? ''}`)}`,
                )}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function upsertMessage(list: WaMessage[], m: WaMessage): WaMessage[] {
  const idx = list.findIndex(x => x.id === m.id);
  if (idx === -1) return [...list, m].sort((a, b) => a.timestamp - b.timestamp);
  const next = [...list];
  next[idx] = { ...next[idx], ...m, status: m.status || next[idx].status };
  return next;
}

function dayKey(ts: number): string {
  return toLocalISODate(new Date(ts * 1000));
}

function dayLabel(ts: number): string {
  const d = new Date(ts * 1000);
  const today = toLocalISODate();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (toLocalISODate(d) === today) return 'Oggi';
  if (toLocalISODate(d) === toLocalISODate(yesterday)) return 'Ieri';
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

function timeLabel(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function listTimeLabel(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  if (toLocalISODate(d) === toLocalISODate()) return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

function reservationDateLabel(iso: string): string {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === toLocalISODate()) return 'oggi';
  if (iso === toLocalISODate(tomorrow)) return 'domani';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ---------------------------------------------------------------------------
// Sotto-componenti
// ---------------------------------------------------------------------------

function TokenSetup({ onSave, onBack }: { onSave: (token: string) => void; onBack: () => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="h-dvh bg-charcoal text-white flex items-center justify-center p-6">
      <form
        onSubmit={e => { e.preventDefault(); if (value.trim()) onSave(value.trim()); }}
        className="w-full max-w-md bg-surface border border-surface-light rounded-3xl p-8 space-y-5"
      >
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
          <KeyRound size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black">Attiva WhatsApp</h1>
          <p className="text-sm text-gray-400 mt-2">
            Inserisci il token di accesso (<code className="text-gold">WA_ACCESS_TOKEN</code> in
            {' '}<code className="text-gold">wa-agent/.env</code> sul server). Viene salvato solo su questo dispositivo.
          </p>
        </div>
        <input
          type="password"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Token di accesso"
          aria-label="Token di accesso WhatsApp"
          autoFocus
          className="w-full bg-charcoal border border-surface-light rounded-xl py-3 px-4 text-sm outline-none focus:border-gold placeholder:text-gray-400"
        />
        <div className="flex gap-3">
          <button type="button" onClick={onBack} className="flex-1 py-3 rounded-xl border border-surface-light text-gray-400 hover:text-white transition cursor-pointer">
            Indietro
          </button>
          <button type="submit" disabled={!value.trim()} className="flex-1 py-3 rounded-xl bg-gold text-black font-semibold hover:bg-gold-hover disabled:opacity-40 transition cursor-pointer">
            Salva
          </button>
        </div>
      </form>
    </div>
  );
}

function ConnectionPill({ state }: { state: WaConnectionState | 'loading' | 'error' }) {
  const map = {
    open:       { label: 'Collegato',        dot: 'bg-emerald-400' },
    connecting: { label: 'In collegamento…', dot: 'bg-amber-400 animate-pulse' },
    close:      { label: 'Non collegato',    dot: 'bg-gray-500' },
    missing:    { label: 'Da configurare',   dot: 'bg-gray-500' },
    loading:    { label: 'Verifica…',        dot: 'bg-gray-500 animate-pulse' },
    error:      { label: 'Errore',           dot: 'bg-red-500' },
  }[state];
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-gray-400 font-semibold">
      <span className={`w-2 h-2 rounded-full ${map.dot}`} /> {map.label}
    </p>
  );
}

function ConnectPanel({ state, error, qr, connecting, onConnect, onRetry, onChangeToken }: {
  state: WaConnectionState | 'loading' | 'error';
  error: string;
  qr: string | null;
  connecting: boolean;
  onConnect: () => void;
  onRetry: () => void;
  onChangeToken: () => void;
}) {
  if (state === 'loading') {
    return <div className="flex-1 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" /></div>;
  }
  if (state === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <p className="text-lg font-bold text-red-400">WhatsApp non raggiungibile</p>
          <p className="text-sm text-gray-400 break-words">{error}</p>
          <p className="text-xs text-gray-400">Controlla sul server: <code className="text-gold">systemctl status risto-wa</code> e <code className="text-gold">docker ps</code> (container risto-evolution).</p>
          <div className="flex gap-3 justify-center">
            <button onClick={onRetry} className="px-5 py-2.5 rounded-xl bg-gold text-black font-semibold hover:bg-gold-hover transition cursor-pointer">Riprova</button>
            <button onClick={onChangeToken} className="px-5 py-2.5 rounded-xl border border-surface-light text-gray-400 hover:text-white transition cursor-pointer">Cambia token</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
      <div className="bg-surface border border-surface-light rounded-3xl p-8 max-w-3xl w-full flex flex-col md:flex-row gap-8 items-center">
        <div className="flex-1 space-y-4">
          <h2 className="text-2xl font-black">Collega il WhatsApp del locale</h2>
          <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
            <li>Apri WhatsApp (o WhatsApp Business) sul telefono del locale</li>
            <li>Vai su <b className="text-white">Impostazioni → Dispositivi collegati</b></li>
            <li>Tocca <b className="text-white">Collega un dispositivo</b> e inquadra il QR</li>
          </ol>
          <button
            onClick={onConnect}
            disabled={connecting}
            className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            {connecting ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            {qr ? 'Nuovo QR' : 'Genera QR'}
          </button>
        </div>
        <div className="w-64 h-64 bg-white rounded-2xl flex items-center justify-center shrink-0">
          {qr ? (
            <img src={qr} alt="QR code per collegare WhatsApp" className="w-full h-full object-contain p-2" />
          ) : (
            <p className="text-gray-500 text-sm text-center px-6">{state === 'connecting' ? 'In attesa del QR…' : 'Premi "Genera QR"'}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, src, group, size = 40 }: { name: string; src: string | null; group?: boolean; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initials = name.replace(/[^\p{L}\p{N} ]/gu, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  if (src && !broken) {
    return <img src={src} alt="" onError={() => setBroken(true)} style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />;
  }
  return (
    <div style={{ width: size, height: size }} className="rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 text-sm font-bold">
      {group ? <Users size={size * 0.45} /> : (initials || '#')}
    </div>
  );
}

function ChatRow({ chat, active, onClick }: { chat: WaChat; active: boolean; onClick: () => void }) {
  const title = chatTitle(chat);
  const last = chat.lastMessage;
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 text-left border-b border-surface-light/50 transition cursor-pointer ${active ? 'bg-surface' : 'hover:bg-surface/60'}`}
    >
      <Avatar name={title} src={chat.avatar} group={chat.isGroup} size={46} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold truncate">{title}</p>
          <span className={`text-[11px] shrink-0 ${chat.unread ? 'text-emerald-400 font-bold' : 'text-gray-400'}`}>{listTimeLabel(chat.updatedAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-[13px] text-gray-400 truncate flex items-center gap-1">
            {last?.fromMe && <StatusTicks status={last.status} />}
            {last ? messagePreview(last) : ''}
          </p>
          {chat.unread > 0 && (
            <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-emerald-500 text-black text-[11px] font-bold flex items-center justify-center shrink-0">
              {chat.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function StatusTicks({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s === 'READ' || s === 'PLAYED' || s === '4' || s === '5') return <CheckCheck size={15} className="text-sky-400 shrink-0" aria-label="Letto" />;
  if (s === 'DELIVERY_ACK' || s === '3') return <CheckCheck size={15} className="text-gray-400 shrink-0" aria-label="Consegnato" />;
  if (s === 'SERVER_ACK' || s === '2') return <Check size={15} className="text-gray-400 shrink-0" aria-label="Inviato" />;
  return <Clock size={13} className="text-gray-400 shrink-0" aria-label="In invio" />;
}

function MessageBubble({ message: m, showSender, media, onLoadMedia }: {
  message: WaMessage;
  showSender: boolean;
  media: string | 'loading' | 'error' | undefined;
  onLoadMedia: () => void;
}) {
  const hasImage = m.kind === 'image' || m.kind === 'sticker';
  return (
    <div className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] md:max-w-[65%] rounded-2xl px-3 py-2 border ${
        m.fromMe ? 'bg-emerald-900/60 border-emerald-700/40 rounded-br-md' : 'bg-surface border-surface-light rounded-bl-md'
      }`}>
        {showSender && m.pushName && <p className="text-[11px] font-bold text-gold mb-0.5">{m.pushName}</p>}
        {hasImage && (
          media && media !== 'loading' && media !== 'error' ? (
            <img src={media} alt={m.text || 'Foto'} className={`rounded-xl mb-1 ${m.kind === 'sticker' ? 'w-32' : 'max-h-80'} object-contain`} />
          ) : (
            <button
              onClick={onLoadMedia}
              disabled={media === 'loading'}
              className="flex items-center gap-2 text-sm text-gray-300 bg-black/20 rounded-xl px-3 py-2 mb-1 hover:bg-black/30 cursor-pointer"
            >
              {media === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
              {media === 'error' ? 'Non disponibile — riprova' : `Mostra ${m.kind === 'sticker' ? 'sticker' : 'foto'}`}
            </button>
          )
        )}
        {!hasImage && m.kind !== 'text' && (
          <p className="text-sm text-gray-400 italic">{kindLabel(m.kind)}{m.kind === 'reaction' ? ` ${m.text}` : ''}</p>
        )}
        {m.text && m.kind !== 'reaction' && <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>}
        <p className="flex items-center justify-end gap-1 text-[10px] text-gray-400 mt-0.5">
          {timeLabel(m.timestamp)}
          {m.fromMe && <StatusTicks status={m.status} />}
        </p>
      </div>
    </div>
  );
}

function QuickPanel({ chat, onInsertText, onClose, onTakeaway }: {
  chat: WaChat | null;
  onInsertText: (text: string) => void;
  onClose: () => void;
  onTakeaway: (nome: string) => void;
}) {
  const { addToast } = useToast();
  const [restaurantName] = useSetting(SETTINGS_KEYS.restaurantName, 'IL GIRASOLE');
  const [repliesRaw, setRepliesRaw] = useSetting(SETTINGS_KEYS.whatsappQuickReplies, DEFAULT_QUICK_REPLIES.join('\n'));
  const [editingReplies, setEditingReplies] = useState(false);
  const [repliesDraft, setRepliesDraft] = useState('');
  const [showResForm, setShowResForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [upcoming, setUpcoming] = useState<Reservation[]>([]);
  const [form, setForm] = useState({ nome: '', telefono: '', data: toLocalISODate(), ora: '20:00', persone: 2, note: '' });

  const replies = repliesRaw.split('\n').map(r => r.trim()).filter(Boolean);
  const name = chat ? (chat.name || '') : '';
  const phone = chat?.phone || '';

  // Prenotazioni future dello stesso numero
  const loadUpcoming = useCallback(async () => {
    if (!supabase || !phone) { setUpcoming([]); return; }
    const { data } = await supabase.from('prenotazioni')
      .select('*')
      .gte('data', toLocalISODate())
      .neq('status', 'ANNULLATA')
      .not('telefono', 'is', null)
      .order('data').order('ora');
    setUpcoming(((data || []) as Reservation[]).filter(r => phonesMatch(r.telefono, phone)));
  }, [phone]);

  useEffect(() => { void loadUpcoming(); }, [loadUpcoming]);

  useEffect(() => {
    setShowResForm(false);
    setForm(f => ({ ...f, nome: name, telefono: phone ? `+${phone}` : '', data: toLocalISODate(), note: '' }));
  }, [chat?.jid, name, phone]);

  async function saveReservation() {
    if (!supabase || !form.nome.trim() || !form.data || !form.ora) return;
    setSaving(true);
    const { error } = await supabase.from('prenotazioni').insert([{
      id: newUniqueId(),
      nome: form.nome.trim(),
      telefono: form.telefono.trim() || null,
      data: form.data,
      ora: form.ora,
      persone: form.persone,
      status: 'CONFERMATA',
      note: form.note.trim() || null,
    }]);
    setSaving(false);
    if (error) {
      addToast({ type: 'error', title: 'Errore', message: 'Salvataggio prenotazione fallito' });
      return;
    }
    addToast({ type: 'success', title: 'Prenotazione salvata' });
    setShowResForm(false);
    void loadUpcoming();
    if (chat) {
      onInsertText(`Ciao ${form.nome.trim()}! ✅ Prenotazione confermata per ${form.persone} ${form.persone === 1 ? 'persona' : 'persone'} ${reservationDateLabel(form.data)} alle ${form.ora}. A presto da ${restaurantName}!`);
    }
  }

  return (
    <aside className="absolute right-0 inset-y-0 z-20 w-[min(22rem,90vw)] lg:static lg:w-80 xl:w-96 shrink-0 bg-charcoal border-l border-surface-light flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-light shrink-0">
        <p className="font-bold flex items-center gap-2"><Zap size={16} className="text-gold" /> Azioni rapide</p>
        <button onClick={onClose} className="lg:hidden p-1 text-gray-400 hover:text-white cursor-pointer" aria-label="Chiudi azioni rapide">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
        {/* Bottoni principali */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowResForm(v => !v)}
            className={`rounded-2xl border p-4 flex flex-col items-center gap-2 text-center transition cursor-pointer ${showResForm ? 'border-gold bg-gold/10' : 'border-surface-light hover:border-gold/50'}`}
          >
            <CalendarPlus size={24} className="text-gold" />
            <span className="text-[13px] font-semibold">Prenotazione</span>
          </button>
          <button
            onClick={() => onTakeaway(name)}
            className="rounded-2xl border border-surface-light hover:border-orange-500/50 p-4 flex flex-col items-center gap-2 text-center transition cursor-pointer"
          >
            <ShoppingBag size={24} className="text-orange-400" />
            <span className="text-[13px] font-semibold">Ordine asporto</span>
          </button>
        </div>

        {showResForm && (
          <form
            onSubmit={e => { e.preventDefault(); void saveReservation(); }}
            className="bg-surface border border-surface-light rounded-2xl p-4 space-y-3"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-gold">Nuova prenotazione</p>
            <Field label="Nome">
              <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required className={inputCls} />
            </Field>
            <Field label="Telefono">
              <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Data">
                <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} required className={inputCls} />
              </Field>
              <Field label="Ora">
                <input type="time" value={form.ora} onChange={e => setForm({ ...form, ora: e.target.value.slice(0, 5) })} required className={inputCls} />
              </Field>
            </div>
            <Field label="Persone">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setForm({ ...form, persone: Math.max(1, form.persone - 1) })} className="w-10 h-10 rounded-xl border border-surface-light hover:border-gold cursor-pointer" aria-label="Meno persone">−</button>
                <span className="flex-1 text-center text-lg font-bold tabular-nums">{form.persone}</span>
                <button type="button" onClick={() => setForm({ ...form, persone: form.persone + 1 })} className="w-10 h-10 rounded-xl border border-surface-light hover:border-gold cursor-pointer" aria-label="Più persone">+</button>
              </div>
            </Field>
            <Field label="Note">
              <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Seggiolone, allergie…" className={inputCls} />
            </Field>
            <button type="submit" disabled={saving || !form.nome.trim()} className="w-full py-3 rounded-xl bg-gold text-black font-semibold hover:bg-gold-hover disabled:opacity-40 transition cursor-pointer flex items-center justify-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />} Salva e prepara conferma
            </button>
          </form>
        )}

        {/* Prenotazioni del cliente */}
        {chat && phone && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Prossime prenotazioni</p>
            {upcoming.length === 0 ? (
              <p className="text-xs text-gray-400">Nessuna prenotazione con questo numero</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map(r => (
                  <div key={r.id} className="bg-surface border border-surface-light rounded-xl px-3 py-2 text-sm">
                    <p className="font-semibold capitalize">{reservationDateLabel(r.data)} · {r.ora?.slice(0, 5)}</p>
                    <p className="text-xs text-gray-400">{r.persone} persone · {r.nome}{r.note ? ` · ${r.note}` : ''}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Risposte rapide */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Risposte rapide</p>
            <button
              onClick={() => { setRepliesDraft(replies.join('\n')); setEditingReplies(v => !v); }}
              className="p-1 text-gray-400 hover:text-gold cursor-pointer"
              aria-label="Modifica risposte rapide"
              title="Modifica"
            >
              <Pencil size={14} />
            </button>
          </div>
          {editingReplies ? (
            <div className="space-y-2">
              <textarea
                value={repliesDraft}
                onChange={e => setRepliesDraft(e.target.value)}
                rows={6}
                aria-label="Risposte rapide, una per riga"
                className={`${inputCls} resize-y`}
              />
              <p className="text-[11px] text-gray-400">Una risposta per riga.</p>
              <button
                onClick={() => { setRepliesRaw(repliesDraft); setEditingReplies(false); }}
                className="w-full py-2 rounded-xl bg-gold text-black text-sm font-semibold hover:bg-gold-hover transition cursor-pointer"
              >
                Salva risposte
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {replies.map((r, i) => (
                <button
                  key={i}
                  onClick={() => onInsertText(r)}
                  disabled={!chat}
                  className="w-full text-left text-[13px] bg-surface border border-surface-light rounded-xl px-3 py-2 hover:border-emerald-500/50 disabled:opacity-40 transition cursor-pointer"
                >
                  {r}
                </button>
              ))}
              <button
                onClick={() => onInsertText(`Ecco il nostro menu: ${window.location.origin}/menu`)}
                disabled={!chat}
                className="w-full text-left text-[13px] bg-surface border border-surface-light rounded-xl px-3 py-2 hover:border-emerald-500/50 disabled:opacity-40 transition cursor-pointer"
              >
                📋 Invia link al menu
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

const inputCls = 'w-full bg-charcoal border border-surface-light rounded-xl py-2 px-3 text-sm outline-none focus:border-gold placeholder:text-gray-400';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-gray-400 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
