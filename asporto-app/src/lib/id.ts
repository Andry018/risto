/** ID univoci fuori dal render React (evita Math.random / Date in purità hook). */
export function newUniqueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 11)}`;
}

/** Minuti placeholder stabili per UI demo (da id tavolo/ordine). */
export function stablePseudoMinutes(seed: string, min = 15, span = 45): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return min + (h % span);
}
