export interface PaninoItem {
  nome: string;
  prezzo: number;
  hasCottura?: boolean;
  isContorniDelGiorno?: boolean;
}

export interface PaninoCategory {
  label: string;
  items: PaninoItem[];
}

export const PANINO_CATEGORIES: PaninoCategory[] = [
  {
    label: 'Carni e Salumi',
    items: [
      { nome: 'Hamburger vitello 200gr', prezzo: 4, hasCottura: true },
      { nome: 'Salsiccia', prezzo: 2.5 },
      { nome: 'Porchetta', prezzo: 2 },
      { nome: 'Prosciutto Crudo', prezzo: 2 },
    ],
  },
  {
    label: 'Formaggi',
    items: [
      { nome: 'Provola affumicata fusa', prezzo: 2 },
      { nome: 'Fior di latte fuso', prezzo: 1.5 },
      { nome: 'Mozzarella senza lattosio fusa', prezzo: 1.5 },
      { nome: 'Bocconcino', prezzo: 1.5 },
      { nome: 'Scaglie di Grana Padano', prezzo: 1 },
    ],
  },
  {
    label: 'Contorni',
    items: [
      { nome: 'Iceberg', prezzo: 1 },
      { nome: 'Pomodori', prezzo: 1 },
      { nome: 'Cipolla Cruda', prezzo: 1 },
      { nome: 'Cipolla in Padella', prezzo: 1.5 },
      { nome: 'Parmigiana di Melanzane', prezzo: 3 },
      { nome: 'Funghi Porcini', prezzo: 2 },
      { nome: 'Rucola', prezzo: 1 },
      { nome: 'Pomodori Secchi', prezzo: 1 },
      { nome: 'Contorni del giorno', prezzo: 2.5, isContorniDelGiorno: true },
    ],
  },
  {
    label: 'Salse',
    items: [
      { nome: 'Ketchup', prezzo: 0.5 },
      { nome: 'Maionese', prezzo: 0.5 },
      { nome: 'Salsa Tartufata', prezzo: 1 },
      { nome: 'Maionese al Pepe Nero', prezzo: 0.5 },
    ],
  },
];

export const PANINO_BASE_PRICE = 1;

export const COTTURE = ['Sangue', 'Medio', 'Ben Cotta'];
