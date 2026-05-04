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
  
  // Bibite
  { id: 'p9', nome: 'COCA COLA 33CL', prezzo: 3.0, categoria: 'Bibite', disponibile: true, ingredienti: [] },
  { id: 'p10', nome: 'ACQUA NATURALE 50CL', prezzo: 1.5, categoria: 'Bibite', disponibile: true, ingredienti: [] },
  { id: 'p11', nome: 'BIRRA MORETTI 33CL', prezzo: 4.0, categoria: 'Bibite', disponibile: true, ingredienti: [] },
  { id: 'p12', nome: 'COPERTO', prezzo: 2.0, categoria: 'Servizio', disponibile: true, ingredienti: [] },
];

export const MOCK_INGREDIENTS: Ingredient[] = [
  { id: 'i1', nome: 'Mozzarella di Bufala', prezzo: 2.5, disponibile: true },
  { id: 'i2', nome: 'Crudo di Parma', prezzo: 3.0, disponibile: true },
  { id: 'i3', nome: 'Salame Piccante', prezzo: 1.5, disponibile: true },
  { id: 'i4', nome: 'Nduja', prezzo: 2.0, disponibile: true },
  { id: 'i5', nome: 'Fiori di Zucca', prezzo: 2.0, disponibile: true },
  { id: 'i6', nome: 'Bordo Ripieno', prezzo: 3.0, disponibile: true },
  { id: 'i7', nome: 'Funghi Porcini', prezzo: 2.5, disponibile: true },
  { id: 'i8', nome: 'Senza Glutine', prezzo: 2.0, disponibile: true },
  { id: 'i9', nome: 'Senza Lattosio', prezzo: 1.5, disponibile: true },
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
