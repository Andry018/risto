import { createClient } from '@supabase/supabase-js';
import { env } from './config.js';
import { TOOLS } from './tools/index.js';
import { executeTool } from './tools/implementations.js';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const SYSTEM_PROMPT = `Sei "GirasoleBot", assistente del ristorante "Il Girasole".

TOOL DISPONIBILI: add_item_to_table, close_table, print_order, set_availability, get_table_status, get_daily_report.

REGOLE:
- Tavoli: ID numerico stringa (es. "5" per Tavolo 5)
- Piatti: nomi ESATTI dal menu (Antipasto, Pizza Margherita, Birra Media, Caffè, ecc.)
- Portate: "1"=antipasto, "2"=primo, "3"=secondo, "4"=contorno, "5"=dolce/caffè
- Se utente dice "due pizze al tavolo 5" → add_item_to_table({table_id:"5", items:[{name:"Pizza Margherita",quantity:2}]})
- Se "chiudi il 5" → close_table({table_id:"5"})
- Se "stampa cucina 5" → print_order({table_id:"5", type:"kitchen"})
- Se "non c'è più la pizza" → set_availability({name:"Pizza Margherita", available:false})
- Se "come sta il tavolo 3?" → get_table_status({table_id:"3"})
- Se "incasso oggi" → get_daily_report({})
- Chiedi conferma SOLO per azioni distruttive (chiudi conto, cancella piatto)
- Rispondi SEMPRE in italiano, tono professionale ma amichevole
- Non inventare dati: usa i tool per informazioni reali

ESEMPI:
User: "Aggiungi due antipasti al tavolo 4" → tool: add_item_to_table
User: "Il tavolo 2 ha finito, chiudi" → tool: close_table
User: "Quanto abbiamo fatto oggi?" → tool: get_daily_report
User: "Metti la birra non disponibile" → tool: set_availability`;

interface OllamaResponse {
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      id: string;
      function: { name: string; arguments: string };
    }>;
  };
  done: boolean;
}

type ChatMessage = 
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: Array<{id: string; function: {name: string; arguments: string}}> }
  | { role: 'tool'; content: string; tool_call_id: string };

async function callOllama(messages: ChatMessage[]) {
  const res = await fetch(`${env.OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.OLLAMA_MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      tools: TOOLS,
      tool_choice: 'auto',
      stream: false,
      options: {
        temperature: 0.1,
        num_ctx: 2048,
        num_thread: 4,
        num_batch: 512,
        repeat_penalty: 1.1
      }
    })
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error: ${res.status} ${err}`);
  }
  return res.json() as Promise<{
    message: {
      role: string;
      content: string;
      tool_calls?: Array<{
        id: string;
        function: { name: string; arguments: string };
      }>;
    };
    done: boolean;
  }>;
}

export async function processWithLLM(userText: string): Promise<string> {
  const messages: ChatMessage[] = [{ role: 'user' as const, content: userText }];
  
  let response = await callOllama(messages);
  
  // Loop function calling
  while (response.message.tool_calls?.length) {
    for (const call of response.message.tool_calls) {
      try {
        const args = JSON.parse(call.function.arguments);
        const result = await executeTool(call.function.name, args);
        // Cast response.message to proper ChatMessage (role will be 'assistant')
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: response.message.content,
          tool_calls: response.message.tool_calls
        };
        messages.push(assistantMsg);
        messages.push({ 
          role: 'tool' as const, 
          tool_call_id: call.id, 
          content: JSON.stringify(result) 
        });
      } catch (e) {
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: response.message.content,
          tool_calls: response.message.tool_calls
        };
        messages.push(assistantMsg);
        messages.push({ 
          role: 'tool' as const, 
          tool_call_id: call.id, 
          content: JSON.stringify({ error: e instanceof Error ? e.message : 'Tool failed' }) 
        });
      }
    }
    response = await callOllama(messages);
  }
  
  return response.message.content || 'Nessuna risposta generata';
}