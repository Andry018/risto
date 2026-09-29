import { env } from './config.js';
import { TOOLS } from './tools/index.js';
import { WRITE_TOOLS, prepareAction, executeReadTool, type PreparedAction } from './tools/implementations.js';

// Prompt corto: su CPU ogni token di prompt costa tempo.
// Gli esempi fanno da "mini training" per il modello piccolo.
const SYSTEM_PROMPT = `Sei GirasoleBot, assistente del ristorante "Il Girasole". Rispondi sempre in italiano, breve.
Usa SEMPRE un tool per le richieste operative. Non inventare dati.
Tavoli: passa solo il numero/nome (es. "5", "2B"). Piatti: passa il nome come detto dall'utente, il sistema lo abbina al menu.
Portate: 1=antipasto 2=primo 3=secondo 4=contorno 5=dolce/caffè.

Esempi:
"due margherite al 5" → add_item_to_table {"table_id":"5","items":[{"name":"margherita","quantity":2}]}
"al 3 una coca e un tiramisù" → add_item_to_table {"table_id":"3","items":[{"name":"coca","quantity":1},{"name":"tiramisù","quantity":1}]}
"chiudi il 5" / "il 5 ha pagato" → close_table {"table_id":"5"}
"stampa cucina 5" → print_order {"table_id":"5","type":"kitchen"}
"finita la margherita" → set_availability {"name":"margherita","available":false}
"torna la margherita" → set_availability {"name":"margherita","available":true}
"come sta il 2?" → get_table_status {"table_id":"2"}
"incasso oggi" / "quanto abbiamo fatto?" → get_daily_report {}`;

// Ollama restituisce `arguments` come oggetto (non stringa JSON come OpenAI) e spesso senza `id`
type ToolCall = {
  id?: string;
  function: { name: string; arguments: Record<string, unknown> | string };
};

type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: ToolCall[] }
  | { role: 'tool'; content: string; tool_call_id?: string };

const MAX_TOOL_ROUNDS = 3;

export type LLMResult =
  | { kind: 'text'; text: string }
  | { kind: 'confirm'; action: PreparedAction };

async function callOllama(messages: ChatMessage[]) {
  const res = await fetch(`${env.OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.OLLAMA_MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      tools: TOOLS,
      stream: false,
      keep_alive: '24h',
      options: {
        temperature: 0,
        num_ctx: 2048,
        num_thread: 4,
        num_batch: 512,
      }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error: ${res.status} ${err}`);
  }
  return res.json() as Promise<{
    message: { role: string; content: string; tool_calls?: ToolCall[] };
    done: boolean;
  }>;
}

const parseArgs = (raw: ToolCall['function']['arguments']) =>
  typeof raw === 'string' ? JSON.parse(raw) : raw;

export async function processWithLLM(userText: string): Promise<LLMResult> {
  const messages: ChatMessage[] = [{ role: 'user', content: userText }];

  let response = await callOllama(messages);

  for (let round = 0; response.message.tool_calls?.length; round++) {
    if (round >= MAX_TOOL_ROUNDS) return { kind: 'text', text: '⚠️ Non ho capito, riprova in modo più semplice.' };

    const calls = response.message.tool_calls;

    // Azione di scrittura: ci fermiamo e chiediamo conferma (una sola azione per messaggio)
    const write = calls.find(c => WRITE_TOOLS.has(c.function.name));
    if (write) {
      try {
        return { kind: 'confirm', action: await prepareAction(write.function.name, parseArgs(write.function.arguments)) };
      } catch (e) {
        return { kind: 'text', text: `❌ ${e instanceof Error ? e.message : 'Richiesta non valida'}` };
      }
    }

    // Solo lettura: eseguiamo e lasciamo che il modello formuli la risposta
    messages.push({ role: 'assistant', content: response.message.content, tool_calls: calls });
    for (const call of calls) {
      let content: string;
      try {
        content = JSON.stringify(await executeReadTool(call.function.name, parseArgs(call.function.arguments)));
      } catch (e) {
        content = JSON.stringify({ error: e instanceof Error ? e.message : 'Tool failed' });
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content });
    }
    response = await callOllama(messages);
  }

  return { kind: 'text', text: response.message.content || 'Non ho capito, puoi riformulare?' };
}
