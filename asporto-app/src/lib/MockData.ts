import type { Product, Ingredient, Tavolo, Order } from './supabase';

export const MOCK_PRODUCTS: Product[] = [
  // Pizze Rosse
  { id: 'p1', nome: 'MARGHERITA', prezzo: 6.5, categoria: 'Pizze Rosse', disponibile: true, ingredienti: ['Pomodoro', 'Mozzarella'] },
  { id: 'p2', nome: 'DIAVOLA', prezzo: 8.0, categoria: 'Pizze Rosse', disponibile: true, ingredienti: ['Pomodoro', 'Mozzarella', 'Salame Piccante'] },
  { id: 'p3', nome: 'NAPOLI', prezzo: 7.5, categoria: 'Pizze Rosse', disponibile: true, ingredienti: ['Pomodoro', 'Mozzarella', 'Acciughe', 'Capperi'] },
  { id: 'p4', nome: 'CRUDITA', prezzo: 10.5, categoria: 'Pizze Rosse', disponibile: true, ingredienti: ['Pomodoro', 'Mozzarella', 'Crudo di Parma', 'Burrata'] },
  
  // Pizze Bianche
  { id: 'p5', nome: 'QUATTRO FORMAGGI', prezzo: 9.0, categoria: 'Pizze Bianche', disponibile: true, ingredienti: ['Mozzarella', 'Gorgonzola', 'Fontina', 'Emmental'] },
  { id: 'p6', nome: 'TARTUFATA', prezzo: 12.0, categoria: 'Pizze Bianche', disponibile: true, ingredienti: ['Mozzarella', 'Crema di Tartufo', 'Funghi Porcini'] },
  
  // Fritti
  { id: 'p7', nome: 'SUPPLÌ CLASSICO', prezzo: 2.5, categoria: 'Fritti', disponibile: true, ingredienti: ['Riso', 'Pomodoro', 'Mozzarella'] },
  { id: 'p8', nome: 'OLIVE ASCOLANE', prezzo: 5.0, categoria: 'Fritti', disponibile: true, ingredienti: ['Olive', 'Carne'] },
  
  // Acqua
  { id: 'p9', nome: 'ACQUA NATURALE 50CL', prezzo: 1.5, categoria: 'Bevande', sottocategoria: 'Acqua', disponibile: true, ingredienti: [] },
  { id: 'p10', nome: 'ACQUA FRIZZANTE 50CL', prezzo: 1.5, categoria: 'Bevande', sottocategoria: 'Acqua', disponibile: true, ingredienti: [] },
  { id: 'p10b', nome: 'ACQUA NATURALE 1LT', prezzo: 2.5, categoria: 'Bevande', sottocategoria: 'Acqua', disponibile: true, ingredienti: [] },
  // Bibite
  { id: 'p11', nome: 'COCA COLA VETRO', prezzo: 3.0, categoria: 'Bevande', sottocategoria: 'Bibite', disponibile: true, ingredienti: [] },
  { id: 'p12', nome: 'COCA ZERO VETRO', prezzo: 3.0, categoria: 'Bevande', sottocategoria: 'Bibite', disponibile: true, ingredienti: [] },
  { id: 'p13', nome: 'COCA LATTINA', prezzo: 2.5, categoria: 'Bevande', sottocategoria: 'Bibite', disponibile: true, ingredienti: [] },
  { id: 'p13b', nome: 'FANTA VETRO', prezzo: 3.0, categoria: 'Bevande', sottocategoria: 'Bibite', disponibile: true, ingredienti: [] },
  { id: 'p13c', nome: 'SPRITE VETRO', prezzo: 3.0, categoria: 'Bevande', sottocategoria: 'Bibite', disponibile: true, ingredienti: [] },
  // Vini della Casa
  { id: 'p15', nome: 'VINO ROSSO QUARTINO', prezzo: 4.0, categoria: 'Bevande', sottocategoria: 'Vini della Casa', disponibile: true, ingredienti: [] },
  { id: 'p16', nome: 'VINO ROSSO 1/2 LT', prezzo: 7.0, categoria: 'Bevande', sottocategoria: 'Vini della Casa', disponibile: true, ingredienti: [] },
  { id: 'p17', nome: 'VINO BIANCO QUARTINO', prezzo: 4.0, categoria: 'Bevande', sottocategoria: 'Vini della Casa', disponibile: true, ingredienti: [] },
  { id: 'p18', nome: 'VINO BIANCO 1/2 LT', prezzo: 7.0, categoria: 'Bevande', sottocategoria: 'Vini della Casa', disponibile: true, ingredienti: [] },
  // Vini Bottiglia
  { id: 'p18a', nome: 'VINO ROSSO BOTTIGLIA', prezzo: 18.0, categoria: 'Bevande', sottocategoria: 'Vini Bottiglia', disponibile: true, ingredienti: [] },
  { id: 'p18b', nome: 'VINO BIANCO BOTTIGLIA', prezzo: 16.0, categoria: 'Bevande', sottocategoria: 'Vini Bottiglia', disponibile: true, ingredienti: [] },
  // Vino Bottiglia — Rossi
  { id: 'p18c', nome: 'PRIMITIVO (SALENTO)', prezzo: 16.0, categoria: 'Bevande', sottocategoria: 'Vini Bottiglia', disponibile: true, ingredienti: [] },
  { id: 'p18d', nome: 'AGLIANICO TRE DANIELE', prezzo: 20.0, categoria: 'Bevande', sottocategoria: 'Vini Bottiglia', disponibile: true, ingredienti: [] },
  { id: 'p18e', nome: 'FUTOS AGLIANICO', prezzo: 18.0, categoria: 'Bevande', sottocategoria: 'Vini Bottiglia', disponibile: true, ingredienti: [] },
  { id: 'p18f', nome: 'VESÙ PIEDIROSSO', prezzo: 20.0, categoria: 'Bevande', sottocategoria: 'Vini Bottiglia', disponibile: true, ingredienti: [] },
  // Vino Bottiglia — Bianco
  { id: 'p18g', nome: 'TRE DANIELE FIANO', prezzo: 20.0, categoria: 'Bevande', sottocategoria: 'Vini Bottiglia', disponibile: true, ingredienti: [] },
  { id: 'p18h', nome: 'FALANGHINA SAN SALVATORE', prezzo: 14.0, categoria: 'Bevande', sottocategoria: 'Vini Bottiglia', disponibile: true, ingredienti: [] },
  // Vino Bottiglia — Rosé
  { id: 'p18i', nome: 'ANNA TRE DANIELE', prezzo: 25.0, categoria: 'Bevande', sottocategoria: 'Vini Bottiglia', disponibile: true, ingredienti: [] },
  // Birra alla Spina
  { id: 'p14a', nome: 'BIRRA MORETTI ALLA SPINA', prezzo: 4.5, categoria: 'Bevande', sottocategoria: 'Birra alla Spina', disponibile: true, ingredienti: [] },
  { id: 'p14b', nome: 'BIRRA ICHNUSA ALLA SPINA', prezzo: 5.0, categoria: 'Bevande', sottocategoria: 'Birra alla Spina', disponibile: true, ingredienti: [] },
  // Birra in Vetro
  { id: 'p14', nome: 'BIRRA MORETTI 33CL', prezzo: 4.0, categoria: 'Bevande', sottocategoria: 'Birra in Vetro', disponibile: true, ingredienti: [] },
  { id: 'p14c', nome: 'BIRRA ICHNUSA 33CL', prezzo: 4.5, categoria: 'Bevande', sottocategoria: 'Birra in Vetro', disponibile: true, ingredienti: [] },
  { id: 'p14d', nome: 'BIRRA TENENTE 33CL', prezzo: 5.0, categoria: 'Bevande', sottocategoria: 'Birra in Vetro', disponibile: true, ingredienti: [] },
  // Senza Glutine
  { id: 'p14e', nome: 'BIRRA MORETTI SENZA GLUTINE 33CL', prezzo: 4.5, categoria: 'Bevande', sottocategoria: 'Senza Glutine', disponibile: true, ingredienti: [] },
  // Analcolica
  { id: 'p13d', nome: 'CHINOTTO VETRO', prezzo: 3.0, categoria: 'Bevande', sottocategoria: 'Analcolica', disponibile: true, ingredienti: [] },
  { id: 'p13e', nome: 'SAN PELLEGRINO LATTINA', prezzo: 2.5, categoria: 'Bevande', sottocategoria: 'Analcolica', disponibile: true, ingredienti: [] },
  { id: 'p19', nome: 'COPERTO', prezzo: 1.5, categoria: 'Servizio', disponibile: true, ingredienti: [] },
  // Dolci
  { id: 'p20', nome: 'TIRAMISÙ', prezzo: 5.0, categoria: 'Dolci', disponibile: true, ingredienti: [] },
  { id: 'p21', nome: 'PASTIERA NAPOLETANA', prezzo: 5.0, categoria: 'Dolci', disponibile: true, ingredienti: [] },
  { id: 'p22', nome: 'TORTA AL CIOCCOLATO', prezzo: 5.5, categoria: 'Dolci', disponibile: true, ingredienti: [] },
  { id: 'p23', nome: 'PANNA COTTA AI FRUTTI DI BOSCO', prezzo: 4.5, categoria: 'Dolci', disponibile: true, ingredienti: [] },
  { id: 'p24', nome: 'GELATO ARTIGIANALE (2 PALLINE)', prezzo: 4.0, categoria: 'Dolci', disponibile: true, ingredienti: [] },
  { id: 'p25', nome: 'SORBETTO AL LIMONE', prezzo: 3.5, categoria: 'Dolci', disponibile: true, ingredienti: [] },
  // Caffè
  { id: 'p26', nome: 'CAFFÈ ESPRESSO', prezzo: 1.2, categoria: 'Caffè e Liquori', sottocategoria: 'Caffè', disponibile: true, ingredienti: [] },
  { id: 'p27', nome: 'CAFFÈ AMERICANO', prezzo: 1.5, categoria: 'Caffè e Liquori', sottocategoria: 'Caffè', disponibile: true, ingredienti: [] },
  { id: 'p28', nome: 'CAPPUCCINO', prezzo: 1.5, categoria: 'Caffè e Liquori', sottocategoria: 'Caffè', disponibile: true, ingredienti: [] },
  { id: 'p29', nome: 'CAFFÈ CORRETTO', prezzo: 2.0, categoria: 'Caffè e Liquori', sottocategoria: 'Caffè', disponibile: true, ingredienti: [] },
  { id: 'p30', nome: 'CAFFÈ DECAFFEINATO', prezzo: 1.2, categoria: 'Caffè e Liquori', sottocategoria: 'Caffè', disponibile: true, ingredienti: [] },
  // Amari e Liquori
  { id: 'p31', nome: 'LIMONCELLO', prezzo: 4.0, categoria: 'Caffè e Liquori', sottocategoria: 'Amari e Liquori', disponibile: true, ingredienti: [] },
  { id: 'p32', nome: 'AMARO DEL CAPO', prezzo: 4.0, categoria: 'Caffè e Liquori', sottocategoria: 'Amari e Liquori', disponibile: true, ingredienti: [] },
  { id: 'p33', nome: 'AMARO MONTENEGRO', prezzo: 4.0, categoria: 'Caffè e Liquori', sottocategoria: 'Amari e Liquori', disponibile: true, ingredienti: [] },
  { id: 'p34', nome: 'GRAPPA BIANCA', prezzo: 4.5, categoria: 'Caffè e Liquori', sottocategoria: 'Amari e Liquori', disponibile: true, ingredienti: [] },
  { id: 'p35', nome: 'GRAPPA DI BAROLO', prezzo: 5.0, categoria: 'Caffè e Liquori', sottocategoria: 'Amari e Liquori', disponibile: true, ingredienti: [] },
  { id: 'p36', nome: 'BRANDY STOCK 84', prezzo: 5.0, categoria: 'Caffè e Liquori', sottocategoria: 'Amari e Liquori', disponibile: true, ingredienti: [] },
  { id: 'p37', nome: 'SASSOLLO', prezzo: 5.0, categoria: 'Caffè e Liquori', sottocategoria: 'Amari e Liquori', disponibile: true, ingredienti: [] },
];

export const MOCK_INGREDIENTS: Ingredient[] = [
  { id: 'i1', nome: 'Mozzarella di Bufala', prezzo: 2.5, prezzo_rimozione: 1.0, disponibile: true },
  { id: 'i2', nome: 'Crudo di Parma', prezzo: 3.0, prezzo_rimozione: 1.5, disponibile: true },
  { id: 'i3', nome: 'Salame Piccante', prezzo: 1.5, prezzo_rimozione: 0.5, disponibile: true },
  { id: 'i4', nome: 'Nduja', prezzo: 2.0, prezzo_rimozione: 1.0, disponibile: true },
  { id: 'i5', nome: 'Fiori di Zucca', prezzo: 2.0, prezzo_rimozione: 1.0, disponibile: true },
  { id: 'i6', nome: 'Bordo Ripieno', prezzo: 3.0, prezzo_rimozione: 1.5, disponibile: true },
  { id: 'i7', nome: 'Funghi Porcini', prezzo: 2.5, prezzo_rimozione: 1.0, disponibile: true },
  { id: 'i8', nome: 'Senza Glutine', prezzo: 2.0, prezzo_rimozione: 0.5, disponibile: true },
  { id: 'i9', nome: 'Senza Lattosio', prezzo: 1.5, prezzo_rimozione: 0.5, disponibile: true },
];

export const MOCK_TABLES: Tavolo[] = [
  { id: 't1', nome: '1', x: 100, y: 100, clienti: 4, status: 'LIBERO', shape: 'SQUARE', sala: 'Principale' },
  { id: 't2', nome: '2', x: 250, y: 100, clienti: 2, status: 'OCCUPATO', shape: 'SQUARE', sala: 'Principale' },
  { id: 't3', nome: '3', x: 400, y: 100, clienti: 0, status: 'LIBERO', shape: 'ROUND', sala: 'Principale' },
  { id: 't4', nome: '4', x: 100, y: 300, clienti: 6, status: 'OCCUPATO', shape: 'RECTANGLE', sala: 'Principale' },
  { id: 't5', nome: '5', x: 350, y: 300, clienti: 0, status: 'LIBERO', shape: 'SQUARE', sala: 'Principale' },
];

export const MOCK_ORDERS: Order[] = [
  { 
    id: 'o_demo_1', 
    created_at: new Date().toISOString(), 
    nome_cliente: 'MARIO ROSSI', 
    orario_ritiro: '20:30', 
    totale: 18.5, 
    status: 'IN_ATTESA',
    carrello: [
      { nome: 'MARGHERITA', quantity: 2, prezzo_unitario: 6.5, modifiche: { aggiunte: [], rimozioni: [], note: '' } },
      { nome: 'COCA COLA 33CL', quantity: 2, prezzo_unitario: 3.0, modifiche: { aggiunte: [], rimozioni: [], note: '' } }
    ]
  },
  { 
    id: 'o_demo_2', 
    created_at: new Date().toISOString(), 
    nome_cliente: 'LUCA BIANCHI', 
    orario_ritiro: '21:00', 
    totale: 25.0, 
    status: 'IN_ATTESA',
    carrello: [
      { nome: 'DIAVOLA', quantity: 1, prezzo_unitario: 8.0, modifiche: { aggiunte: ['Mozzarella di Bufala'], rimozioni: [], note: 'Ben cotta' } },
      { nome: 'CRUDITA', quantity: 1, prezzo_unitario: 10.5, modifiche: { aggiunte: [], rimozioni: [], note: '' } }
    ]
  }
];
