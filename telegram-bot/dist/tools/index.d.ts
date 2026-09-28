export declare const TOOLS: readonly [{
    readonly type: "function";
    readonly function: {
        readonly name: "add_item_to_table";
        readonly description: "Aggiunge piatti a un tavolo";
        readonly parameters: {
            readonly type: "object";
            readonly properties: {
                readonly table_id: {
                    readonly type: "string";
                    readonly description: "ID tavolo (es. \"5\")";
                };
                readonly items: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "object";
                        readonly properties: {
                            readonly name: {
                                readonly type: "string";
                                readonly description: "Nome esatto dal menu (es. \"Pizza Margherita\")";
                            };
                            readonly quantity: {
                                readonly type: "number";
                                readonly minimum: 1;
                                readonly description: "Quantità";
                            };
                            readonly course: {
                                readonly type: "string";
                                readonly enum: readonly ["1", "2", "3", "4", "5"];
                                readonly description: "Portata: 1=antipasto, 2=primo, 3=secondo, 4=contorno, 5=dolce/caffè";
                            };
                        };
                        readonly required: readonly ["name", "quantity"];
                    };
                };
            };
            readonly required: readonly ["table_id", "items"];
        };
    };
}, {
    readonly type: "function";
    readonly function: {
        readonly name: "close_table";
        readonly description: "Chiude il conto e libera il tavolo";
        readonly parameters: {
            readonly type: "object";
            readonly properties: {
                readonly table_id: {
                    readonly type: "string";
                    readonly description: "ID tavolo";
                };
            };
            readonly required: readonly ["table_id"];
        };
    };
}, {
    readonly type: "function";
    readonly function: {
        readonly name: "print_order";
        readonly description: "Stampa comanda cucina o sala";
        readonly parameters: {
            readonly type: "object";
            readonly properties: {
                readonly table_id: {
                    readonly type: "string";
                };
                readonly type: {
                    readonly type: "string";
                    readonly enum: readonly ["kitchen", "sala"];
                    readonly description: "Dove stampare";
                };
            };
            readonly required: readonly ["table_id", "type"];
        };
    };
}, {
    readonly type: "function";
    readonly function: {
        readonly name: "set_availability";
        readonly description: "Cambia disponibilità di un piatto";
        readonly parameters: {
            readonly type: "object";
            readonly properties: {
                readonly name: {
                    readonly type: "string";
                    readonly description: "Nome esatto del piatto";
                };
                readonly available: {
                    readonly type: "boolean";
                };
            };
            readonly required: readonly ["name", "available"];
        };
    };
}, {
    readonly type: "function";
    readonly function: {
        readonly name: "get_table_status";
        readonly description: "Stato tavolo e conto aperto";
        readonly parameters: {
            readonly type: "object";
            readonly properties: {
                readonly table_id: {
                    readonly type: "string";
                };
            };
            readonly required: readonly ["table_id"];
        };
    };
}, {
    readonly type: "function";
    readonly function: {
        readonly name: "get_daily_report";
        readonly description: "Incassi e ordini di oggi";
        readonly parameters: {
            readonly type: "object";
            readonly properties: {};
        };
    };
}];
//# sourceMappingURL=index.d.ts.map