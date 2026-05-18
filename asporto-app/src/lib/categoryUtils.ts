const ORDER_KEY = 'risto_category_order';

const DEFAULT_ORDER = [
  'Antipasti', 'Primi', 'Secondi', 'Contorni',
  'Pizze Rosse', 'Pizze Bianche', 'Pizze Speciali', 'Fritti',
  'Bevande', 'Caffè e Liquori', 'Dolci', 'Servizio'
];

export function getCategoryOrder(): string[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [...DEFAULT_ORDER];
}

export function saveCategoryOrder(order: string[]): void {
  localStorage.setItem(ORDER_KEY, JSON.stringify(order));
}

export function resetCategoryOrder(): void {
  localStorage.removeItem(ORDER_KEY);
}

export function sortCategories(categories: string[]): string[] {
  const order = getCategoryOrder();
  const known = categories.filter(c => order.includes(c));
  const unknown = categories.filter(c => !order.includes(c));
  known.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  // Append "EXTRA" at the end if present among unknown
  const extraIdx = unknown.indexOf('EXTRA');
  if (extraIdx > -1) {
    unknown.splice(extraIdx, 1);
    unknown.push('EXTRA');
  }
  return [...known, ...unknown.sort()];
}
