import { env } from './config.js';
import { TOOLS } from './tools/index.js';
import { WRITE_TOOLS, prepareAction, executeReadTool, type PreparedAction } from './tools/implementations.js';

// Prompt corto: su CPU ogni token di prompt costa tempo.
// Gli esempi fanno da "mini training" per il modello piccolo.
const SYSTEM_PROMPT = `Sei GirasoleBot, assistente del ristorante "Il Girasole". Rispondi sempre in italiano, breve.
Usa SEMPRE un tool per le richieste operative. Non inventare dati. Se manca un dato obbligatorio (es. nome o persone di una prenotazione), chiedilo.
Passa nomi, tavoli e date come li dice l'utente ("5", "margherita", "domani", "sabato"): il sistema li abbina da solo.
Portate: 1=antipasto 2=primo 3=secondo 4=contorno 5=dolce/caffè.
Modifiche: "con X" → add:["X"]; "senza X" → remove:["X"]; cottura/preparazione ("ben cotta", "tagliata") → note.
Piatti uguali con modifiche diverse = voci separate.

Esempi:
"due margherite al 5" → add_item_to_table {"table_id":"5","items":[{"name":"margherita","quantity":2}]}
"al 3 una coca e un tiramisù" → add_item_to_table {"table_id":"3","items":[{"name":"coca","quantity":1},{"name":"tiramisù","quantity":1}]}
"al 2 una diavola con funghi ben cotta" → add_item_to_table {"table_id":"2","items":[{"name":"diavola","quantity":1,"add":["funghi"],"note":"ben cotta"}]}
"tre capricciose al 7, una senza carciofi" → add_item_to_table {"table_id":"7","items":[{"name":"capricciosa","quantity":2},{"name":"capricciosa","quantity":1,"remove":["carciofi"]}]}
"chiudi il 5" / "il 5 ha pagato" → close_table {"table_id":"5"}
"stampa cucina 5" → print_order {"table_id":"5","type":"kitchen"}
"come sta il 2?" → get_table_status {"table_id":"2"}
"quali tavoli sono occupati?" → get_table_status {}
"finita la mozzarella" → set_availability {"name":"mozzarella","available":false}
"la diavola costa 6 euro" → set_price {"name":"diavola","price":6}
"incasso oggi" → get_daily_report {} ; "quanto abbiamo fatto ieri?" → get_daily_report {"date":"ieri"}
"quante prenotazioni stasera?" → get_reservations {} ; "chi viene sabato?" → get_reservations {"date":"sabato"}
"prenota Rossi 4 persone domani alle 20:30" → add_reservation {"name":"Rossi","people":4,"date":"domani","time":"20:30"}
"annulla la prenotazione di Rossi" → cancel_reservation {"name":"Rossi"}
"quanta farina abbiamo?" → get_stock {"name":"farina"} ; "cosa sta finendo?" → get_stock {}
"arrivati 10 kg di farina" → stock_movement {"name":"farina","type":"carico","quantity":10}
"chi lavora stasera?" → get_shifts {}
"metti Marco di turno sabato sera" → set_shift {"name":"Marco","date":"sabato","shift":"sera","on":true}`;

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
        num_ctx: 4096, // 14 tool + esempi non stanno in 2048 token
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
