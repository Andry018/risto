export const SALE = ['Principale', 'Verde', 'Rotonda', 'Terrazza'] as const;
export type Sala = typeof SALE[number];
