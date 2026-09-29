// Parsing di date/orari in italiano fatto nel codice: il modello piccolo sbaglia i calcoli sulle date,
// quindi gli facciamo passare le parole dell'utente ("domani", "sabato", "15/10") e le risolviamo qui.

export const toLocalISODate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const WEEKDAYS = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const clean = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** "oggi" | "domani" | "sabato" | "15/10" | "15 ottobre" | "2026-10-15" → Date locale (mezzanotte) */
export function parseDay(input: string | undefined, now = new Date()): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const s = clean(input ?? '');
  const plus = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);

  if (!s || /^(oggi|stasera|stamattina|a pranzo|a cena|pranzo|cena)$/.test(s)) return today;
  if (/^(domani|domani sera|domani a pranzo|domani a cena)$/.test(s)) return plus(1);
  if (s === 'dopodomani') return plus(2);
  if (/^(ieri|ieri sera|ieri a pranzo)$/.test(s)) return plus(-1);
  if (/^(l'altro ieri|laltro ieri|altro ieri)$/.test(s)) return plus(-2);

  const wd = WEEKDAYS.findIndex(w => s.replace(/^(questo |questa |prossimo |prossima )/, '').startsWith(w));
  if (wd >= 0) return plus((wd - today.getDay() + 7) % 7); // stesso giorno = oggi

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

  // "15/10", "15-10", "15.10", "15/10/2026"
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  let day: number | undefined, month: number | undefined, year: number | undefined;
  if (m) { day = +m[1]; month = +m[2] - 1; year = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : undefined; }

  // "15 ottobre", "il 15 ottobre"
  m = s.match(/(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/);
  if (m && day === undefined) {
    const mi = MONTHS.findIndex(x => x.startsWith(m![2].slice(0, 3)));
    if (mi >= 0) { day = +m[1]; month = mi; year = m[3] ? +m[3] : undefined; }
  }

  if (day !== undefined && month !== undefined && month >= 0 && month < 12 && day >= 1 && day <= 31) {
    let d = new Date(year ?? today.getFullYear(), month, day);
    if (year === undefined && d < today) d = new Date(today.getFullYear() + 1, month, day); // "15/01" a dicembre = anno prossimo
    if (d.getMonth() !== month) throw new Error(`Data non valida: "${input}"`);
    return d;
  }
  throw new Error(`Non capisco la data "${input}". Usa ad es. "domani", "sabato" o "15/10"`);
}

/** "20:30" | "20.30" | "20" | "8 e mezza" | "alle 21" → "HH:MM". Orari 1–10 intesi di sera (8 → 20:00). */
export function parseTime(input: string | number | undefined): string {
  const s = clean(String(input ?? '')).replace(/^(alle|ore|per le)\s+/, '');
  const m = s.match(/^(\d{1,2})(?:[:.,h ](\d{2}))?(\s*e\s*(mezza|mezzo|un quarto|quarto))?$/);
  if (!m) throw new Error(`Non capisco l'orario "${input}". Usa ad es. "20:30"`);
  let h = +m[1];
  let min = m[2] ? +m[2] : 0;
  if (m[4]) min = m[4].startsWith('mezz') ? 30 : 15;
  if (h >= 1 && h <= 10) h += 12; // ristorante: "alle 8" = 20:00
  if (h > 23 || min > 59) throw new Error(`Orario non valido: "${input}"`);
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function formatDay(d: Date, now = new Date()): string {
  const iso = toLocalISODate(d);
  if (iso === toLocalISODate(now)) return 'oggi';
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (iso === toLocalISODate(tomorrow)) return 'domani';
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}
