export const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'add_item_to_table',
      description: 'Aggiunge piatti a un tavolo',
      parameters: {
        type: 'object',
        properties: {
          table_id: { type: 'string', description: 'ID tavolo (es. "5")' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Nome esatto dal menu (es. "Pizza Margherita")' },
                quantity: { type: 'number', minimum: 1, description: 'Quantità' },
                course: { type: 'string', enum: ['1','2','3','4','5'], description: 'Portata: 1=antipasto, 2=primo, 3=secondo, 4=contorno, 5=dolce/caffè' }
              },
              required: ['name', 'quantity']
            }
          }
        },
        required: ['table_id', 'items']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'close_table',
      description: 'Chiude il conto e libera il tavolo',
      parameters: {
        type: 'object',
        properties: { table_id: { type: 'string', description: 'ID tavolo' } },
        required: ['table_id']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'print_order',
      description: 'Stampa comanda cucina o sala',
      parameters: {
        type: 'object',
        properties: {
          table_id: { type: 'string' },
          type: { type: 'string', enum: ['kitchen', 'sala'], description: 'Dove stampare' }
        },
        required: ['table_id', 'type']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_availability',
      description: 'Cambia disponibilità di un piatto',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome esatto del piatto' },
          available: { type: 'boolean' }
        },
        required: ['name', 'available']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_table_status',
      description: 'Stato tavolo e conto aperto',
      parameters: {
        type: 'object',
        properties: { table_id: { type: 'string' } },
        required: ['table_id']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_daily_report',
      description: 'Incassi e ordini di oggi',
      parameters: { type: 'object', properties: {} }
    }
  }
] as const;