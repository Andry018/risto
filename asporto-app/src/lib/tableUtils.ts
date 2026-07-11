export function parseAperturaFromNote(note: string | null | undefined): string | null {
  if (!note) return null;
  try {
    const parsed = JSON.parse(note);
    if (parsed && typeof parsed === 'object' && typeof parsed.apertura === 'string') {
      return parsed.apertura;
    }
  } catch { /* not JSON */ }
  return null;
}

export function setAperturaInNote(note: string | null | undefined, apertura: string): string {
  let text = '';
  if (note) {
    try {
      const parsed = JSON.parse(note);
      if (parsed && typeof parsed === 'object') {
        text = typeof parsed.text === 'string' ? parsed.text : '';
      } else {
        text = note;
      }
    } catch {
      text = note;
    }
  }
  return JSON.stringify({ apertura, text });
}
