// Definizioni tool per Ollama. Descrizioni volutamente brevi: su CPU ogni token di prompt costa tempo.
// Nomi (piatti, ingredienti, tavoli, persone, date) vanno passati come li dice l'utente: li risolve il codice.

const str = (description: string) => ({ type: 'string', description });
const num = (description: string) => ({ type: 'number', description });
const DAY = str('Giorno come detto: "oggi", "domani", "ieri", "sabato", "15/10". Vuoto = oggi');

const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) => ({
  type: 'function' as const,
  function: { name, description, parameters: { type: 'object', properties, required } },
});

export const TOOLS = [
  // --- Tavoli e ordini ---
  fn('add_item_to_table', 'Aggiunge piatti a un tavolo. Piatti uguali con modifiche diverse = voci separate.', {
    table_id: str('Tavolo, es. "5", "2B"'),
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: str('Piatto'),
          quantity: num('Quantità'),
          add: { type: 'array', items: { type: 'string' }, description: '"con X" → ["X"]' },
          remove: { type: 'array', items: { type: 'string' }, description: '"senza X" → ["X"]' },
          note: str('Richieste per la cucina: "ben cotta", "tagliata"'),
          course: { type: 'string', enum: ['1', '2', '3', '4', '5'], description: '1=antipasto 2=primo 3=secondo 4=contorno 5=dolce' },
        },
        required: ['name', 'quantity'],
      },
    },
  }, ['table_id', 'items']),
  fn('close_table', 'Chiude il conto e libera il tavolo', { table_id: str('Tavolo') }, ['table_id']),
  fn('print_order', 'Stampa comanda cucina o sala', {
    table_id: str('Tavolo'),
    type: { type: 'string', enum: ['kitchen', 'sala'] },
  }, ['table_id', 'type']),
  fn('get_table_status', 'Stato di un tavolo, o panoramica di tutti i tavoli se table_id vuoto', { table_id: str('Tavolo, vuoto = tutti') }),

  // --- Menu ---
  fn('set_availability', 'Rende un piatto o un ingrediente disponibile / non disponibile ("finita la X")', {
    name: str('Piatto o ingrediente'),
    available: { type: 'boolean' },
  }, ['name', 'available']),
  fn('set_price', 'Cambia il prezzo di un piatto', { name: str('Piatto'), price: num('Nuovo prezzo in euro') }, ['name', 'price']),

  // --- Incassi ---
  fn('get_daily_report', 'Incasso, numero conti e piatti più venduti di un giorno', { date: DAY }),

  // --- Prenotazioni ---
  fn('get_reservations', 'Prenotazioni di un giorno: quante, coperti, chi', { date: DAY }),
  fn('add_reservation', 'Crea una prenotazione', {
    name: str('Nome cliente'),
    people: num('Persone'),
    date: DAY,
    time: str('Orario, es. "20:30"'),
    phone: str('Telefono, se detto'),
    table_id: str('Tavolo, se detto'),
    note: str('Note: "seggiolone", "compleanno"'),
  }, ['name', 'people', 'time']),
  fn('cancel_reservation', 'Annulla una prenotazione', { name: str('Nome cliente'), date: str('Giorno, se detto') }, ['name']),

  // --- Magazzino ---
  fn('get_stock', 'Giacenza di un articolo di magazzino, o elenco articoli sotto scorta se name vuoto', { name: str('Articolo, vuoto = sotto scorta') }),
  fn('stock_movement', 'Registra carico (arrivato/comprato) o scarico (usato/buttato) di magazzino', {
    name: str('Articolo'),
    type: { type: 'string', enum: ['carico', 'scarico'] },
    quantity: num('Quantità'),
    note: str('Nota'),
  }, ['name', 'type', 'quantity']),

  // --- Turni ---
  fn('get_shifts', 'Chi lavora in un giorno (pranzo e sera)', { date: DAY }),
  fn('set_shift', 'Mette o toglie una persona dal turno', {
    name: str('Nome del dipendente'),
    date: DAY,
    shift: { type: 'string', enum: ['pranzo', 'sera'] },
    on: { type: 'boolean', description: 'true = mettere in turno, false = togliere' },
  }, ['name', 'shift', 'on']),
];
