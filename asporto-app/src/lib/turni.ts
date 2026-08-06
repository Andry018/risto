const TURNI_STORAGE_KEY = 'risto_turni';

export type TurnoTipo = 'pranzo' | 'sera';

export interface TurnoEntry {
  userId: string;
  data: string; // YYYY-MM-DD
  turno: TurnoTipo;
}

function readTurni(): TurnoEntry[] {
  try {
    const raw = localStorage.getItem(TURNI_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TurnoEntry[]) : [];
  } catch {
    return [];
  }
}

function writeTurni(turni: TurnoEntry[]): void {
  localStorage.setItem(TURNI_STORAGE_KEY, JSON.stringify(turni));
}

export function getTurni(): TurnoEntry[] {
  return readTurni();
}

export function getTurniForDate(data: string): TurnoEntry[] {
  return readTurni().filter(t => t.data === data);
}

export function hasTurno(userId: string, data: string, turno: TurnoTipo): boolean {
  return readTurni().some(t => t.userId === userId && t.data === data && t.turno === turno);
}

/** Attiva/disattiva un turno (pranzo o sera) per un operatore in un giorno. */
export function toggleTurno(userId: string, data: string, turno: TurnoTipo): void {
  const turni = readTurni();
  const idx = turni.findIndex(t => t.userId === userId && t.data === data && t.turno === turno);
  if (idx > -1) {
    turni.splice(idx, 1);
  } else {
    turni.push({ userId, data, turno });
  }
  writeTurni(turni);
}
