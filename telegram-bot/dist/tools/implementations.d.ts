export declare function executeTool(name: string, args: any): Promise<any>;
declare function addItem({ table_id, items }: {
    table_id: string;
    items: Array<{
        name: string;
        quantity: number;
        course?: string;
    }>;
}): Promise<{
    ok: boolean;
    orderId: any;
    items: number;
    message: string;
}>;
declare function closeTable({ table_id }: {
    table_id: string;
}): Promise<{
    ok: boolean;
    message: string;
}>;
declare function printOrder({ table_id, type }: {
    table_id: string;
    type: 'kitchen' | 'sala';
}): Promise<{
    ok: boolean;
    message: string;
}>;
declare function setAvailability({ name, available }: {
    name: string;
    available: boolean;
}): Promise<{
    ok: boolean;
    message: string;
}>;
declare function getTableStatus({ table_id }: {
    table_id: string;
}): Promise<{
    table: {
        id: any;
        nome: any;
        status: any;
        clienti: any;
        sala: any;
    };
    order: {
        items: any;
        totale: any;
        since: any;
    } | null;
}>;
declare function dailyReport(_args: Record<string, never>): Promise<{
    date: string;
    totalRevenue: number;
    totalOrders: number;
    totalItems: number;
    message: string;
}>;
export { addItem, closeTable, printOrder, setAvailability, getTableStatus, dailyReport };
//# sourceMappingURL=implementations.d.ts.map