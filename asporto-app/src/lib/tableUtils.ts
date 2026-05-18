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

export function getDisplayNote(note: string | null | undefined): string {
  if (!note) return '';
  try {
    const parsed = JSON.parse(note);
    if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') {
      return parsed.text;
    }
  } catch { /* not JSON */ }
  return note;
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

export function setNoteText(note: string | null | undefined, newText: string): string {
  let apertura: string | null = null;
  if (note) {
    try {
      const parsed = JSON.parse(note);
      if (parsed && typeof parsed === 'object') {
        apertura = typeof parsed.apertura === 'string' ? parsed.apertura : null;
      }
    } catch { /* not JSON - ignore */ }
  }
  if (newText === '' && !apertura) return '';
  const obj: Record<string, string> = {};
  if (apertura) obj.apertura = apertura;
  if (newText) obj.text = newText;
  return JSON.stringify(obj);
}
