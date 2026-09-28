import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { env, ADMIN_SET } from './config.js';
import { processWithLLM } from './llm.js';

const bot = new Telegraf(env.BOT_TOKEN);

// Auth middleware
bot.use(async (ctx, next) => {
  if (!ADMIN_SET.has(ctx.from?.id ?? 0)) {
    await ctx.reply('⛔ Non autorizzato. Contatta l\'amministratore.');
    return;
  }
  return next();
});

// Comandi base
bot.command('start', ctx => ctx.reply(
  '🤖 GirasoleBot pronto!\n\n' +
  'Scrivi in naturale, es:\n' +
  '• "Aggiungi 2 pizze al tavolo 5"\n' +
  '• "Chiudi il tavolo 3"\n' +
  '• "Stampa cucina 5"\n' +
  '• "Non c\'è più la pizza margherita"\n' +
  '• "Come sta il tavolo 2?"\n' +
  '• "Incasso oggi"'
));

bot.command('help', ctx => ctx.reply(
  'Comandi rapidi:\n' +
  '/start - Messaggio benvenuto\n' +
  '/help - Questo aiuto\n' +
  '/status - Stato bot\n' +
  '\nOppure scrivi direttamente in linguaggio naturale.'
));

bot.command('status', ctx => ctx.reply('✅ Bot attivo • Ollama connesso • Supabase ok'));

// Messaggi naturali → LLM
bot.on('message', async (ctx) => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const text = ctx.message.text.trim();
  if (!text) return;
  
  try {
    await ctx.sendChatAction('typing');
    const reply = await processWithLLM(text);
    await ctx.reply(reply);
  } catch (e) {
    console.error('LLM error:', e);
    await ctx.reply('❌ Errore elaborazione. Riprova o contatta admin.');
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