const SESSION_KEY = 'risto_staff_session_ok';
const USER_KEY = 'risto_current_user';
const USERS_STORAGE_KEY = 'risto_staff_users';

export type StaffRole = 'admin' | 'waiter' | 'kitchen';

export interface StaffUser {
  id: string;
  name: string;
  pin: string;
  role: StaffRole;
}

function generateId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
}

export function getDefaultStaffPin(): string | null {
  const raw = import.meta.env.VITE_STAFF_PIN;
  if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
  if (import.meta.env.DEV) return '1234';
  return null;
}

export function getStaffUsers(): StaffUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const users = JSON.parse(raw) as StaffUser[];
      // Migrate cashier → admin
      let migrated = false;
      const migratedUsers = users.map(u => {
        if (u.role === ('cashier' as StaffRole)) {
          migrated = true;
          return { ...u, role: 'admin' as const };
        }
        return u;
      });
      if (migrated) {
        saveStaffUsers(migratedUsers);
      }
      return migratedUsers;
    }
  } catch { /* ignore */ }
  return [];
}

export function saveStaffUsers(users: StaffUser[]): void {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

export function addStaffUser(name: string, pin: string, role: StaffRole): StaffUser {
  const users = getStaffUsers();
  const user: StaffUser = { id: generateId(), name, pin, role };
  users.push(user);
  saveStaffUsers(users);
  return user;
}

export function removeStaffUser(id: string): void {
  saveStaffUsers(getStaffUsers().filter(u => u.id !== id));
}

export function updateStaffUser(id: string, updates: Partial<StaffUser>): void {
  saveStaffUsers(getStaffUsers().map(u => u.id === id ? { ...u, ...updates } : u));
}

export function verifyStaffPin(userId: string, pin: string): boolean {
  const users = getStaffUsers();
  const user = users.find(u => u.id === userId);
  if (user) return user.pin === pin.trim();
  // Fallback to env PIN
  const expected = getDefaultStaffPin();
  return expected ? pin.trim() === expected : false;
}

export function getCurrentUser(): StaffUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) return JSON.parse(raw) as StaffUser;
  } catch { /* ignore */ }
  return null;
}

export function isStaffSessionValid(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(SESSION_KEY) === '1';
}

export function setStaffSessionValid(user: StaffUser): void {
  localStorage.setItem(SESSION_KEY, '1');
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStaffSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_KEY);
}

export function staffLogout(): void {
  clearStaffSession();
  window.location.href = '/';
}

export function hasPermission(requiredRole: StaffRole): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.role === requiredRole;
}

const roleRoutes: Record<StaffRole, string> = {
  waiter: '/waiter',
  kitchen: '/kitchen',
  admin: '/',
};

export function getDefaultRouteForRole(role: StaffRole): string {
  return roleRoutes[role] || '/';
}

const rolePermissions: Record<string, StaffRole[]> = {
  '/waiter': ['waiter', 'admin'],
  '/kitchen': ['kitchen', 'admin'],
  '/pos': ['admin'],
  '/reports': ['admin'],
  '/takeaway': ['admin'],
  '/map': ['waiter', 'admin'],
};

export function canAccessRoute(path: string): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.role === 'admin') return true;
  const allowed = rolePermissions[path];
  if (!allowed) return false;
  return allowed.includes(user.role);
}
