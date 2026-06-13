export const MANAGER_PIN = '2580';

export type StaffRole = 'admin' | 'waiter' | 'kitchen';

export interface StaffUser {
  id: string;
  name: string;
  pin: string;
  role: StaffRole;
}

const LOCAL_OPERATOR: StaffUser = {
  id: 'local-operator',
  name: 'Locale',
  pin: MANAGER_PIN,
  role: 'admin',
};

export function getDefaultStaffPin(): string {
  return MANAGER_PIN;
}

export function getStaffUsers(): StaffUser[] {
  return [LOCAL_OPERATOR];
}

export function saveStaffUsers(_users: StaffUser[]): void {
  // Installazione locale/kiosk: gli operatori non vengono piu salvati nel browser.
}

export function addStaffUser(_name: string, _pin: string, _role: StaffRole): StaffUser {
  return LOCAL_OPERATOR;
}

export function removeStaffUser(_id: string): void {
  // No-op in modalita locale.
}

export function updateStaffUser(_id: string, _updates: Partial<StaffUser>): void {
  // No-op in modalita locale.
}

export function verifyStaffPin(_userId: string, pin: string): boolean {
  return pin.trim() === MANAGER_PIN;
}

export function getCurrentUser(): StaffUser {
  return LOCAL_OPERATOR;
}

export function isStaffSessionValid(): boolean {
  return true;
}

export function setStaffSessionValid(_user: StaffUser): void {
  // Accesso sempre valido sulla rete locale del ristorante.
}

export function clearStaffSession(): void {
  // No-op in modalita locale.
}

export function staffLogout(): void {
  window.location.href = '/';
}

export function hasPermission(_requiredRole: StaffRole): boolean {
  return true;
}

export function getDefaultRouteForRole(_role: StaffRole): string {
  return '/';
}

export function canAccessRoute(_path: string): boolean {
  return true;
}

export function requireManagerPin(actionLabel = 'questa azione'): boolean {
  const pin = window.prompt(`PIN responsabile richiesto per ${actionLabel}`);
  if (pin === null) return false;
  if (pin.trim() === MANAGER_PIN) return true;
  window.alert('PIN non valido');
  return false;
}
