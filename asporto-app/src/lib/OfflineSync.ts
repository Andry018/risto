import { supabase, type Order, type Tavolo } from './supabase';

const QUEUE_KEY = 'risto_pending_sync';

export interface PendingOrder {
  id: string;
  data: Partial<Order>;
  type: 'INSERT' | 'UPDATE_ORDER' | 'TABLE_UPDATE';
  tableId?: string;
  tableUpdates?: Partial<Tavolo>;
}

class OfflineSync {
  private queue: PendingOrder[] = [];
  /** Serializza le drain così un secondo push aspetta il primo (evita UPDATE perso mentre isSyncing era true). */
  private drainTail: Promise<void> = Promise.resolve();
  private queueBusy = false;

  constructor() {
    this.loadQueue();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.sync());
      if (navigator.onLine) void this.sync();
    }
  }

  private loadQueue() {
    const saved = localStorage.getItem(QUEUE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as PendingOrder[];
        this.queue = parsed.map((item) =>
          (item as { type?: string }).type === 'UPDATE' && item.data?.id
            ? { ...item, type: 'UPDATE_ORDER' as const }
            : item
        );
      } catch {
        this.queue = [];
      }
    }
  }

  private saveQueue() {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
  }

  private async drainQueue(): Promise<void> {
    if (!navigator.onLine || !supabase || this.queue.length === 0) {
      window.dispatchEvent(new CustomEvent('sync-status-changed'));
      return;
    }

    this.queueBusy = true;
    try {
      while (this.queue.length > 0) {
        const item = this.queue[0];
        let success = false;
        let isTableUpdate = false;
        try {
          if (item.type === 'INSERT') {
            const payload = { ...item.data };
            delete payload.id;
            const { error } = await supabase.from('ordini').insert([payload]);
            if (!error) success = true;
            else console.error('Supabase Sync Error (insert ordine):', error);
          } else if (item.type === 'UPDATE_ORDER' && item.data.id) {
            const { id, ...updates } = item.data as Partial<Order> & { id: string };
            const { error } = await supabase.from('ordini').update(updates).eq('id', id);
            if (!error) success = true;
            else console.error('Supabase Sync Error (update ordine):', error);
          } else if (item.type === 'TABLE_UPDATE' && item.tableId) {
            isTableUpdate = true;
            const { error } = await supabase.from('tavoli').update(item.tableUpdates!).eq('id', item.tableId);
            if (!error) success = true;
            else console.error('Supabase Sync Error (update tavolo):', error);
          }
        } catch (e) {
          console.error('OfflineSync: Sync failed for item', item.id, e);
        }

        if (success || isTableUpdate) {
          this.queue = this.queue.filter((q) => q.id !== item.id);
          this.saveQueue();
        } else {
          break;
        }
      }
    } finally {
      this.queueBusy = false;
      window.dispatchEvent(new CustomEvent('sync-status-changed'));
    }
  }

  public async pushOrder(orderData: Partial<Order>) {
    const pending: PendingOrder = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      data: orderData,
      type: orderData.id ? 'UPDATE_ORDER' : 'INSERT',
    };
    this.queue.push(pending);
    this.saveQueue();
    this.drainTail = this.drainTail.then(() => this.drainQueue());
    await this.drainTail;
  }

  public async pushTableUpdate(tableId: string, updates: Partial<Tavolo>) {
    const pending: PendingOrder = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      data: {},
      type: 'TABLE_UPDATE',
      tableId,
      tableUpdates: updates,
    };
    this.queue.push(pending);
    this.saveQueue();
    this.drainTail = this.drainTail.then(() => this.drainQueue());
    await this.drainTail;
  }

  public getPendingCount() {
    return this.queue.length;
  }

  public getIsSyncing() {
    return this.queueBusy || this.queue.length > 0;
  }

  public async sync() {
    this.drainTail = this.drainTail.then(() => this.drainQueue());
    await this.drainTail;
  }
}

export const syncManager = new OfflineSync();
