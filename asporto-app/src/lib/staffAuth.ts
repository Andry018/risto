const PIN_STORAGE_KEY = 'risto_manager_pin';

export function getManagerPin(): string {
  return localStorage.getItem(PIN_STORAGE_KEY) || '2580';
}

export function setManagerPin(newPin: string): void {
  localStorage.setItem(PIN_STORAGE_KEY, newPin);
}

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
  pin: getManagerPin(),
  role: 'admin',
};

export function getDefaultStaffPin(): string {
  return getManagerPin();
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
  return pin.trim() === getManagerPin();
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

let _pinPromptHandler: ((label: string) => Promise<boolean>) | null = null;

export function setPinPromptHandler(handler: (label: string) => Promise<boolean>): void {
  _pinPromptHandler = handler;
}

export async function requireManagerPin(actionLabel = 'questa azione'): Promise<boolean> {
  if (_pinPromptHandler) {
    return _pinPromptHandler(actionLabel);
  }
  const pin = window.prompt(`PIN responsabile richiesto per ${actionLabel}`);
  if (pin === null) return false;
  if (pin.trim() === getManagerPin()) return true;
  window.alert('PIN non valido');
  return false;
}
