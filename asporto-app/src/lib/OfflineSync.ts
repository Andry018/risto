import { supabase, type Order } from './supabase';

const QUEUE_KEY = 'risto_pending_sync';

export interface PendingOrder {
  id: string; // Temporary ID
  data: Partial<Order>;
  type: 'INSERT' | 'UPDATE' | 'TABLE_UPDATE';
  tableId?: string;
  tableUpdates?: any;
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
        this.queue = JSON.parse(saved);
      } catch (e) {
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
      type: 'INSERT'
    };
    this.queue.push(pending);
    this.saveQueue();
    this.sync();
  }

  public async pushTableUpdate(tableId: string, updates: any) {
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
          const { error } = await supabase.from('ordini').upsert([item.data]);
          if (!error) success = true;
          else {
            console.error('Supabase Sync Error:', error);
            if (error.code === '23505' || error.code === '409') {
              // Conflict but handled by upsert usually, if it still fails, might be a different issue
              success = true; // Mark as success to clear the queue if it's a permanent conflict
            }
          }
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
