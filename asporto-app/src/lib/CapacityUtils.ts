import type { Order, OrderCarrelloItem } from '../types/entities';

export const CAPACITY_CONFIG = {
  MAX_PIZZAS_PER_SLOT: 10,
  SLOT_INTERVAL_MINS: 15,
  START_HOUR: 18,
  END_HOUR: 23
};

export const capacityUtils = {
  // Round a date or time string to the nearest 15-min slot
  getSlotKey(timeStr: string): string {
    if (!timeStr || timeStr === 'ASAP' || timeStr.includes('Tavolo')) {
      const now = new Date();
      const mins = now.getMinutes();
      const roundedMins = Math.floor(mins / CAPACITY_CONFIG.SLOT_INTERVAL_MINS) * CAPACITY_CONFIG.SLOT_INTERVAL_MINS;
      now.setMinutes(roundedMins);
      now.setSeconds(0);
      now.setMilliseconds(0);
      return now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    }
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    const roundedMins = Math.floor(minutes / CAPACITY_CONFIG.SLOT_INTERVAL_MINS) * CAPACITY_CONFIG.SLOT_INTERVAL_MINS;
    return `${hours.toString().padStart(2, '0')}:${roundedMins.toString().padStart(2, '0')}`;
  },

  // Count pizzas in a carrello array
  countPizzas(carrello: OrderCarrelloItem[] | null | undefined): number {
    if (!carrello) return 0;
    return carrello.reduce((sum, item) => {
      const isPizza = item.nome?.toLowerCase().includes('pizza') || 
                      item.categoria?.toLowerCase().includes('pizze');
      return isPizza ? sum + (item.quantity || 1) : sum;
    }, 0);
  },

  // Generate all possible slots for the day
  generateSlots(): string[] {
    const slots = [];
    for (let h = CAPACITY_CONFIG.START_HOUR; h < CAPACITY_CONFIG.END_HOUR; h++) {
      for (let m = 0; m < 60; m += CAPACITY_CONFIG.SLOT_INTERVAL_MINS) {
        slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      }
    }
    slots.push(`${CAPACITY_CONFIG.END_HOUR}:00`);
    return slots;
  },

  // Calculate the load map { "19:00": 4, "19:15": 10 }
  calculateLoadMap(orders: Order[]): Record<string, number> {
    const loadMap: Record<string, number> = {};
    
    orders.forEach(order => {
      if (order.status === 'COMPLETATO' && !this.isLive(order)) return; // Skip completed old orders
      
      const slot = this.getSlotKey(order.orario_ritiro);
      const pizzaCount = this.countPizzas(order.carrello);
      
      loadMap[slot] = (loadMap[slot] || 0) + pizzaCount;
    });
    
    return loadMap;
  },

  isLive(order: Order): boolean {
    const orderTime = new Date(order.created_at).getTime();
    const now = new Date().getTime();
    return (now - orderTime) < (4 * 60 * 60 * 1000); // Consider "live" if within last 4 hours
  }
};
