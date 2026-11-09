export type CatalogItem = {id: number; name: string; category: string; description: string; hint: string; sample: string; style: string; sort: number; active: boolean};
export type AdminUser = {id: string; username: string; name: string; phone: string; role: string; active: boolean; hasLogin: boolean; created: string; lastLogin: string};
export type AdminOverview = {users: AdminUser[]; catalog: CatalogItem[]; methods: {name: string; active: boolean}[]; channels: {name: string; active: boolean}[]; counts: {orders: number; files: number}};
export function activeCatalog(): Promise<CatalogItem[]>;
export function activeLists(): Promise<{methods: string[]; channels: string[]}>;
export function adminOverview(): Promise<AdminOverview>;
export function adminAct(actor: {id: string}, action: string, body?: Record<string, unknown>): Promise<void>;
