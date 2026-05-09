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
  private isSyncing = false;

  constructor() {
    this.loadQueue();
    // Listen for online events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.sync());
      // Initial sync check
      if (navigator.onLine) this.sync();
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

  public async pushOrder(orderData: Partial<Order>) {
    const pending: PendingOrder = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      data: orderData,
      type: orderData.id ? 'UPDATE_ORDER' : 'INSERT',
    };
    this.queue.push(pending);
    this.saveQueue();
    this.sync();
  }

  public async pushTableUpdate(tableId: string, updates: Partial<Tavolo>) {
    const pending: PendingOrder = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      data: {},
      type: 'TABLE_UPDATE',
      tableId,
      tableUpdates: updates
    };
    this.queue.push(pending);
    this.saveQueue();
    this.sync();
  }

  public getPendingCount() {
    return this.queue.length;
  }

  public getIsSyncing() {
    return this.isSyncing;
  }

  public async sync() {
    if (this.isSyncing || !navigator.onLine || this.queue.length === 0 || !supabase) return;
    this.isSyncing = true;

    const itemsToSync = [...this.queue];
    for (const item of itemsToSync) {
      try {
        let success = false;
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
          const { error } = await supabase.from('tavoli').update(item.tableUpdates).eq('id', item.tableId);
          if (!error) success = true;
        }

        if (success) {
          this.queue = this.queue.filter(q => q.id !== item.id);
          this.saveQueue();
        }
      } catch (e) {
        console.error('OfflineSync: Sync failed for item', item.id, e);
        break; // Stop and retry later
      }
    }

    this.isSyncing = false;
    // Trigger a custom event for UI updates
    window.dispatchEvent(new CustomEvent('sync-status-changed'));
  }
}

export const syncManager = new OfflineSync();
