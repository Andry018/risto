import { createClient } from '@supabase/supabase-js';

/**
 * Riceve lo snapshot corrente del menu dall'app locale e sostituisce interamente
 * il contenuto di prodotti_pubblico. Usa la service_role key (solo lato server,
 * mai esposta al browser) per scrivere nonostante le policy RLS di sola lettura.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secret = req.headers['x-publish-secret'];
  if (!process.env.PUBLISH_SECRET || secret !== process.env.PUBLISH_SECRET) {
    res.status(401).json({ error: 'Non autorizzato' });
    return;
  }

  const { prodotti } = req.body || {};
  if (!Array.isArray(prodotti)) {
    res.status(400).json({ error: '"prodotti" deve essere un array' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: 'Configurazione server mancante (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const payload = prodotti
    .filter(p => p && p.disponibile && p.nome && typeof p.prezzo === 'number')
    .map(p => ({
      nome: String(p.nome),
      prezzo: p.prezzo,
      categoria: String(p.categoria || 'Altro'),
      sottocategoria: p.sottocategoria ? String(p.sottocategoria) : null,
      ingredienti: Array.isArray(p.ingredienti) ? p.ingredienti : [],
      allergeni: Array.isArray(p.allergeni) ? p.allergeni : [],
      disponibile: true,
    }));

  // Sostituzione atomica: cancella tutto e reinserisce lo snapshot corrente.
  const { error: delError } = await supabase
    .from('prodotti_pubblico')
    .delete()
    .not('id', 'is', null);
  if (delError) {
    res.status(500).json({ error: delError.message });
    return;
  }

  if (payload.length > 0) {
    const { error: insError } = await supabase.from('prodotti_pubblico').insert(payload);
    if (insError) {
      res.status(500).json({ error: insError.message });
      return;
    }
  }

  res.status(200).json({ success: true, count: payload.length });
}
