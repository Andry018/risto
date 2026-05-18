export interface ProductVariant {
  id: string;
  label: string;
  price: number;
  categories: string;
  section: string;
  style: 'gold' | 'emerald' | 'rose';
  stackable: boolean;
  order: number;
}

const STORAGE_KEY = 'risto_product_variants';

const DEFAULT_VARIANTS: ProductVariant[] = [
  // Pizze - Varianti Rapide
  { id: 'v_p_1', label: 'Rosè', price: 0, categories: 'Pizze Rosse,Pizze Bianche', section: 'VARIANTI RAPIDE', style: 'gold', stackable: false, order: 1 },
  { id: 'v_p_2', label: 'Bianca', price: 0, categories: 'Pizze Rosse,Pizze Bianche', section: 'VARIANTI RAPIDE', style: 'gold', stackable: false, order: 2 },
  { id: 'v_p_3', label: 'Rossa', price: 0, categories: 'Pizze Rosse,Pizze Bianche', section: 'VARIANTI RAPIDE', style: 'gold', stackable: false, order: 3 },
  { id: 'v_p_4', label: 'Cottura ++', price: 0, categories: 'Pizze Rosse,Pizze Bianche', section: 'VARIANTI RAPIDE', style: 'gold', stackable: false, order: 4 },
  { id: 'v_p_5', label: 'Patatine', price: 1.0, categories: 'Pizze Rosse,Pizze Bianche', section: 'VARIANTI RAPIDE', style: 'gold', stackable: false, order: 5 },
  { id: 'v_p_6', label: 'Senza Glutine', price: 5.0, categories: 'Pizze Rosse,Pizze Bianche', section: 'VARIANTI RAPIDE', style: 'gold', stackable: false, order: 6 },
  { id: 'v_p_7', label: 'Senza Lattosio', price: 1.5, categories: 'Pizze Rosse,Pizze Bianche', section: 'VARIANTI RAPIDE', style: 'gold', stackable: false, order: 7 },

  // Primi - Modifiche
  { id: 'v_pr_1', label: 'Diviso in Due Piatti', price: 0, categories: 'Primo,Primi', section: 'MODIFICHE', style: 'gold', stackable: false, order: 1 },
  { id: 'v_pr_2', label: 'Con Formaggio', price: 0, categories: 'Primo,Primi', section: 'MODIFICHE', style: 'gold', stackable: false, order: 2 },
  { id: 'v_pr_3', label: 'Con Piccante', price: 0, categories: 'Primo,Primi', section: 'MODIFICHE', style: 'gold', stackable: false, order: 3 },
  { id: 'v_pr_4', label: 'Senza Glutine', price: 2.0, categories: 'Primo,Primi', section: 'MODIFICHE', style: 'gold', stackable: false, order: 4 },
  { id: 'v_pr_5', label: 'Senza Lattosio', price: 1.5, categories: 'Primo,Primi', section: 'MODIFICHE', style: 'gold', stackable: false, order: 5 },

  // Secondi - Cottura
  { id: 'v_s_1', label: 'Al sangue', price: 0, categories: 'Secondo,Secondi', section: 'COTTURA', style: 'rose', stackable: false, order: 1 },
  { id: 'v_s_2', label: 'Media', price: 0, categories: 'Secondo,Secondi', section: 'COTTURA', style: 'rose', stackable: false, order: 2 },
  { id: 'v_s_3', label: 'Ben cotta', price: 0, categories: 'Secondo,Secondi', section: 'COTTURA', style: 'rose', stackable: false, order: 3 },

  // Secondi - Glassatura
  { id: 'v_s_4', label: 'Con glassa', price: 0, categories: 'Secondo,Secondi', section: 'GLASSA / CONDIMENTI', style: 'emerald', stackable: false, order: 4 },
  { id: 'v_s_5', label: 'Senza glassa', price: 0, categories: 'Secondo,Secondi', section: 'GLASSA / CONDIMENTI', style: 'emerald', stackable: false, order: 5 },

  // Antipasti - Preparazione
  { id: 'v_a_1', label: 'Grigliato', price: 0, categories: 'Antipasto,Antipasti', section: 'PREPARAZIONE', style: 'gold', stackable: false, order: 1 },
  { id: 'v_a_2', label: 'Saltato in Padella', price: 0, categories: 'Antipasto,Antipasti', section: 'PREPARAZIONE', style: 'gold', stackable: false, order: 2 },
  { id: 'v_a_3', label: 'Fritto', price: 0, categories: 'Antipasto,Antipasti', section: 'PREPARAZIONE', style: 'gold', stackable: false, order: 3 },
  { id: 'v_a_4', label: 'Al Forno', price: 0, categories: 'Antipasto,Antipasti', section: 'PREPARAZIONE', style: 'gold', stackable: false, order: 4 },

  // Antipasti - Extra
  { id: 'v_a_5', label: 'Con Rucola', price: 0, categories: 'Antipasto,Antipasti', section: 'EXTRA', style: 'emerald', stackable: false, order: 5 },
  { id: 'v_a_6', label: 'Con Aceto Balsamico', price: 0, categories: 'Antipasto,Antipasti', section: 'EXTRA', style: 'emerald', stackable: false, order: 6 },
  { id: 'v_a_7', label: 'Con Riduzione', price: 0, categories: 'Antipasto,Antipasti', section: 'EXTRA', style: 'emerald', stackable: false, order: 7 },
  { id: 'v_a_8', label: 'Con Scaglie di Grana', price: 1.5, categories: 'Antipasto,Antipasti', section: 'EXTRA', style: 'emerald', stackable: false, order: 8 },
  { id: 'v_a_9', label: 'Con Tartufo', price: 3.0, categories: 'Antipasto,Antipasti', section: 'EXTRA', style: 'emerald', stackable: false, order: 9 },

  // Contorni - Condimenti
  { id: 'v_c_1', label: 'Limone', price: 0, categories: 'Contorni', section: 'CONDIMENTI', style: 'emerald', stackable: false, order: 1 },
  { id: 'v_c_2', label: 'Sale e Olio', price: 0, categories: 'Contorni', section: 'CONDIMENTI', style: 'emerald', stackable: false, order: 2 },
  { id: 'v_c_3', label: 'Balsamico', price: 0, categories: 'Contorni', section: 'CONDIMENTI', style: 'emerald', stackable: false, order: 3 },
  { id: 'v_c_4', label: 'Glassa', price: 0, categories: 'Contorni', section: 'CONDIMENTI', style: 'emerald', stackable: false, order: 4 },
];

export function getDefaultVariants(): ProductVariant[] {
  return DEFAULT_VARIANTS;
}

export function getProductVariants(): ProductVariant[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProductVariant[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_VARIANTS;
}

export function saveProductVariants(variants: ProductVariant[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(variants));
}

export function resetProductVariants(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getVariantsForCategory(category: string, variants?: ProductVariant[]): Record<string, ProductVariant[]> {
  const all = variants || getProductVariants();
  const grouped: Record<string, ProductVariant[]> = {};
  for (const v of all) {
    const cats = v.categories.split(',').map(c => c.trim());
    if (cats.includes(category)) {
      if (!grouped[v.section]) grouped[v.section] = [];
      grouped[v.section].push(v);
    }
  }
  // Sort by order within each section
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => a.order - b.order);
  }
  return grouped;
}

export function variantMatchesCategoria(categoria: string, variant: ProductVariant): boolean {
  const cats = variant.categories.split(',').map(c => c.trim());
  return cats.some(c => categoria.startsWith(c) || c.startsWith(categoria));
}
