export interface BarcodeProductInfo {
  nome: string;
  categoria: string;
  unita_misura: string;
  immagine?: string;
}

/**
 * Cerca un prodotto per codice a barre su Open Food Facts (gratuito, senza chiave API).
 * Ritorna null se non trovato o in caso di errore di rete — l'utente potrà comunque
 * inserire l'articolo a mano.
 */
export async function lookupBarcodeProduct(barcode: string): Promise<BarcodeProductInfo | null> {
  const code = barcode.trim();
  if (!code) return null;

  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.status !== 1 || !data.product) return null;

    const p = data.product;
    const nome: string = p.product_name_it || p.product_name || p.generic_name_it || p.generic_name || '';
    if (!nome) return null;

    const categoria: string = (p.categories_tags?.[0] || p.categories || '')
      .toString()
      .split(',')[0]
      .replace(/^[a-z]{2}:/, '')
      .replace(/-/g, ' ')
      .trim();

    const unita_misura = guessUnitaMisura(p.quantity);

    return {
      nome: capitalize(nome.trim()),
      categoria: categoria ? capitalize(categoria) : '',
      unita_misura,
      immagine: p.image_front_small_url || p.image_small_url || undefined,
    };
  } catch {
    return null;
  }
}

function guessUnitaMisura(quantity?: string): string {
  if (!quantity) return 'pz';
  const q = quantity.toLowerCase();
  if (q.includes('kg')) return 'kg';
  if (q.includes('g') && !q.includes('kg')) return 'g';
  if (q.includes('l') && !q.includes('ml')) return 'L';
  if (q.includes('ml')) return 'ml';
  return 'pz';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
