import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import { randomUUID } from 'node:crypto';
import { env, ADMIN_SET } from './config.js';
import { processWithLLM } from './llm.js';
import { executeConfirmed, type PreparedAction } from './tools/implementations.js';

const bot = new Telegraf(env.BOT_TOKEN);

// Azioni in attesa di conferma (in memoria: si perdono al riavvio, va bene così)
const PENDING_TTL_MS = 10 * 60_000;
const pending = new Map<string, { action: PreparedAction; userId: number; at: number }>();

// Auth middleware
bot.use(async (ctx, next) => {
  if (!ADMIN_SET.has(ctx.from?.id ?? 0)) {
    console.warn(`Accesso negato: utente ${ctx.from?.id} (@${ctx.from?.username ?? '-'})`);
    await ctx.reply('⛔ Non autorizzato. Contatta l\'amministratore.');
    return;
  }
  return next();
});

// Comandi base
bot.command('start', ctx => ctx.reply(
  '🤖 GirasoleBot pronto!\n\n' +
  'Scrivi in naturale, es:\n\n' +
  '🍕 Tavoli\n' +
  '• "Due margherite al 5, una senza mozzarella"\n' +
  '• "Chiudi il 3" • "Stampa cucina 5"\n' +
  '• "Come sta il 2?" • "Quali tavoli sono occupati?"\n\n' +
  '📋 Menu\n' +
  '• "Finita la mozzarella" • "La diavola costa 6 euro"\n\n' +
  '📅 Prenotazioni\n' +
  '• "Quante prenotazioni stasera?" • "Chi viene sabato?"\n' +
  '• "Prenota Rossi 4 persone domani alle 20:30"\n' +
  '• "Annulla la prenotazione di Rossi"\n\n' +
  '💶 Incassi\n' +
  '• "Incasso oggi" • "Quanto abbiamo fatto ieri?"\n\n' +
  '📦 Magazzino\n' +
  '• "Quanta farina abbiamo?" • "Cosa sta finendo?"\n' +
  '• "Arrivati 10 kg di farina"\n\n' +
  '👤 Turni\n' +
  '• "Chi lavora stasera?" • "Metti Marco di turno sabato sera"\n\n' +
  'Ogni modifica chiede conferma ✅ prima di essere eseguita.'
));

bot.command('help', ctx => ctx.reply(
  'Comandi rapidi:\n' +
  '/start - Messaggio benvenuto\n' +
  '/help - Questo aiuto\n' +
  '/status - Stato bot\n' +
  '\nOppure scrivi direttamente in linguaggio naturale.'
));

bot.command('status', ctx => ctx.reply(`✅ Bot attivo • modello ${env.OLLAMA_MODEL}`));

// Conferma / annulla azioni proposte dall'LLM
bot.action(/^(ok|no):(.+)$/, async (ctx) => {
  const [, choice, id] = ctx.match;
  const entry = pending.get(id);
  pending.delete(id);
  await ctx.answerCbQuery();

  if (!entry || Date.now() - entry.at > PENDING_TTL_MS) {
    await ctx.editMessageText('⌛ Richiesta scaduta, riscrivila.');
    return;
  }
  if (entry.userId !== ctx.from.id) return;
  if (choice === 'no') {
    await ctx.editMessageText(`${entry.action.summary}\n\n❌ Annullato`);
    return;
  }
  try {
    const result = await executeConfirmed(entry.action);
    await ctx.editMessageText(`${entry.action.summary}\n\n${result}`);
  } catch (e) {
    console.error('Tool error:', e);
    await ctx.editMessageText(`${entry.action.summary}\n\n❌ ${e instanceof Error ? e.message : 'Errore'}`);
  }
});

// Messaggi naturali → LLM
bot.on('message', async (ctx) => {
  if (!ctx.message || !('text' in ctx.message)) return;

  const text = ctx.message.text.trim();
  if (!text) return;

  // Su CPU la risposta può richiedere vari secondi: rinnova "sta scrivendo…"
  const typing = setInterval(() => ctx.sendChatAction('typing').catch(() => {}), 4000);
  try {
    await ctx.sendChatAction('typing');
    const result = await processWithLLM(text);
    if (result.kind === 'text') {
      await ctx.reply(result.text);
      return;
    }
    const id = randomUUID().slice(0, 8);
    for (const [k, v] of pending) if (Date.now() - v.at > PENDING_TTL_MS) pending.delete(k);
    pending.set(id, { action: result.action, userId: ctx.from.id, at: Date.now() });
    await ctx.reply(result.action.summary, Markup.inlineKeyboard([
      Markup.button.callback('✅ Conferma', `ok:${id}`),
      Markup.button.callback('❌ Annulla', `no:${id}`),
    ]));
  } catch (e) {
    console.error('LLM error:', e);
    await ctx.reply('❌ Errore elaborazione. Riprova o contatta admin.');
  } finally {
    clearInterval(typing);
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('❌ Errore interno').catch(() => {});
});

// Avvio
bot.launch()
  .then(() => console.log('🤖 Telegram bot avviato'))
  .catch(console.error);

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));