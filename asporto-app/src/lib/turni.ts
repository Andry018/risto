import { supabase } from './supabase';

const TURNI_STORAGE_KEY = 'risto_turni';

export type TurnoTipo = 'pranzo' | 'sera';

export interface TurnoEntry {
  userId: string;
  data: string; // YYYY-MM-DD
  turno: TurnoTipo;
}

// ── localStorage (lettura sincrona per il render) ──────────────────────────

export function readTurni(): TurnoEntry[] {
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

// ── Query sincrone (usate nel render) ─────────────────────────────────────

export function hasTurno(userId: string, data: string, turno: TurnoTipo): boolean {
  return readTurni().some(t => t.userId === userId && t.data === data && t.turno === turno);
}

export function getTurni(): TurnoEntry[] {
  return readTurni();
}

export function getTurniForDate(data: string): TurnoEntry[] {
  return readTurni().filter(t => t.data === data);
}

// ── Toggle con sync Supabase ───────────────────────────────────────────────

export async function toggleTurno(userId: string, data: string, turno: TurnoTipo): Promise<boolean> {
  const turni = readTurni();
  const idx = turni.findIndex(t => t.userId === userId && t.data === data && t.turno === turno);
  const removing = idx > -1;

  if (removing) {
    turni.splice(idx, 1);
  } else {
    turni.push({ userId, data, turno });
  }
  writeTurni(turni);

  // Supabase sync con error handling
  if (supabase) {
    try {
      if (removing) {
        const { error } = await supabase.from('turni').delete()
          .eq('user_id', userId)
          .eq('data', data)
          .eq('turno', turno);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('turni').upsert({ user_id: userId, data, turno });
        if (error) throw error;
      }
      return true;
    } catch (error) {
      console.error('Turno sync failed:', error);
      // Rollback localStorage on DB failure
      const rollback = readTurni();
      if (removing) {
        rollback.push({ userId, data, turno });
      } else {
        const rollbackIdx = rollback.findIndex(t => t.userId === userId && t.data === data && t.turno === turno);
        if (rollbackIdx > -1) rollback.splice(rollbackIdx, 1);
      }
      writeTurni(rollback);
      return false;
    }
  }
  return true;
}

// ── Caricamento iniziale da DB ─────────────────────────────────────────────

/** Scarica tutti i turni da Supabase e sovrascrive localStorage. */
export async function loadTurniFromDb(): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase.from('turni').select('user_id, data, turno');
  if (error || !data) return;

  const entries: TurnoEntry[] = (data as { user_id: string; data: string; turno: TurnoTipo }[]).map(r => ({
    userId: r.user_id,
    data: r.data.slice(0, 10),
    turno: r.turno,
  }));
  writeTurni(entries);
}

/** Forza ricarica turni da DB (utile per risolvere conflitti). */
export async function reloadTurniFromDb(): Promise<{ success: boolean; count: number }> {
  if (!supabase) return { success: false, count: 0 };
  try {
    const { data, error } = await supabase.from('turni').select('user_id, data, turno');
    if (error) throw error;
    const entries: TurnoEntry[] = (data as { user_id: string; data: string; turno: TurnoTipo }[]).map(r => ({
      userId: r.user_id,
      data: r.data.slice(0, 10),
      turno: r.turno,
    }));
    writeTurni(entries);
    return { success: true, count: entries.length };
  } catch (error) {
    console.error('Reload turni failed:', error);
    return { success: false, count: 0 };
  }
}