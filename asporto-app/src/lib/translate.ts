const CACHE_PREFIX = 'trans_';
const MYMEMORY_API = 'https://api.mymemory.translated.net/get';

type CacheEntry = { text: string; expiry: number };

function getCacheKey(text: string, lang: string): string {
  return `${CACHE_PREFIX}${lang}_${text.toLowerCase().trim()}`;
}

function getCached(text: string, lang: string): string | null {
  try {
    const raw = localStorage.getItem(getCacheKey(text, lang));
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() > entry.expiry) {
      localStorage.removeItem(getCacheKey(text, lang));
      return null;
    }
    return entry.text;
  } catch {
    return null;
  }
}

function setCache(text: string, lang: string, translated: string): void {
  try {
    const entry: CacheEntry = { text: translated, expiry: Date.now() + 7 * 24 * 60 * 60 * 1000 };
    localStorage.setItem(getCacheKey(text, lang), JSON.stringify(entry));
  } catch {
    /* localStorage full, ignore */
  }
}

export async function translate(text: string, targetLang: string): Promise<string> {
  if (targetLang === 'it') return text;

  const cached = getCached(text, targetLang);
  if (cached) return cached;

  const langMap: Record<string, string> = { en: 'en', fr: 'fr', de: 'de' };
  const langPair = `it|${langMap[targetLang] || targetLang}`;

  try {
    const url = `${MYMEMORY_API}?q=${encodeURIComponent(text)}&langpair=${langPair}`;
    const res = await fetch(url);
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    if (translated && translated !== text) {
      setCache(text, targetLang, translated);
      return translated;
    }
  } catch {
    /* fallback to original text */
  }

  return text;
}

export async function translateBatch(
  items: { id: string; text: string }[],
  targetLang: string
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  const uncached = items.filter(item => {
    const cached = getCached(item.text, targetLang);
    if (cached) {
      result[item.id] = cached;
      return false;
    }
    return true;
  });

  await Promise.all(
    uncached.map(async item => {
      result[item.id] = await translate(item.text, targetLang);
    })
  );

  return result;
}
