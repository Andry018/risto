import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import WaiterMobileView from './components/WaiterMobileView';
import StaffDashboard from './components/StaffDashboard';
import CustomerView from './components/CustomerView';
import TableMapView from './components/TableMapView';
import POSView from './components/POSView';
import TakeawayTabletView from './components/TakeawayTabletView';
import PublicMenuView from './components/PublicMenuView';
import MenuQRView from './components/MenuQRView';
import MenuQRPrint from './components/MenuQRPrint';
import ReservationsView from './components/ReservationsView';
import EtichettaPage from './components/EtichettaPage';
import ExitGuard from './components/ExitGuard';
import StaffPinGuard from './components/StaffPinGuard';
import { isTablet } from './lib/DeviceUtils';
import { initTheme } from './lib/theme';
import DatabaseStatusGuard from './components/DatabaseStatusGuard';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmModal';
import { PinProvider } from './components/PinModal';
import { PromptProvider } from './components/PromptModal';
import { WakeLockManager } from './components/WakeLockManager';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';

// Lazy load heavy admin/feature routes
const AdminView = lazy(() => import('./components/AdminView'));
const ReportsView = lazy(() => import('./components/ReportsView'));
const FattureView = lazy(() => import('./components/FattureView'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const MagazzinoView = lazy(() => import('./components/MagazzinoView'));
const HaccpView = lazy(() => import('./components/HaccpView'));
const CassaFiscalePage = lazy(() => import('./components/CassaFiscalePage'));
const SystemPanelView = lazy(() => import('./components/SystemPanelView'));

initTheme();

function RootRoute() {
  return isTablet() ? <StaffDashboard /> : <StaffPinGuard><WaiterMobileView /></StaffPinGuard>;
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center">
      <div className="relative">
        <div className="w-12 h-12 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-gold rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <DatabaseStatusGuard>
        <ToastProvider>
        <ConfirmProvider>
        <PinProvider>
        <PromptProvider>
        <ExitGuard>
        <WakeLockManager />
        <PwaUpdatePrompt />
        <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/asporto" element={<CustomerView />} />
          <Route path="/menu" element={<PublicMenuView />} />
          <Route path="/qr-menu" element={<MenuQRView />} />
          <Route path="/qr-print" element={<MenuQRPrint />} />
          <Route path="/" element={<RootRoute />} />
          <Route path="/takeaway" element={<TakeawayTabletView />} />
          <Route path="/waiter" element={<StaffPinGuard><WaiterMobileView /></StaffPinGuard>} />
          <Route path="/map" element={<TableMapView />} />
          <Route path="/kitchen" element={<StaffPinGuard requiredRoles={['admin', 'kitchen']}><AdminView /></StaffPinGuard>} />
          <Route path="/pos" element={<POSView />} />
          <Route path="/reports" element={<StaffPinGuard requiredRoles={['admin']}><ReportsView /></StaffPinGuard>} />
          <Route path="/fatture" element={<StaffPinGuard requiredRoles={['admin']}><FattureView /></StaffPinGuard>} />
          <Route path="/reservations" element={<ReservationsView />} />
          <Route path="/settings" element={<StaffPinGuard requiredRoles={['admin']}><SettingsView /></StaffPinGuard>} />
          <Route path="/magazzino" element={<StaffPinGuard requiredRoles={['admin', 'kitchen']}><MagazzinoView /></StaffPinGuard>} />
          <Route path="/haccp" element={<StaffPinGuard requiredRoles={['admin', 'kitchen']}><HaccpView isEmbedded={false} /></StaffPinGuard>} />
          <Route path="/cassa" element={<StaffPinGuard requiredRoles={['admin']}><CassaFiscalePage /></StaffPinGuard>} />
          <Route path="/servizi" element={<StaffPinGuard requiredRoles={['admin']}><SystemPanelView /></StaffPinGuard>} />
          <Route path="/etichetta/:lotto" element={<EtichettaPage />} />
        </Routes>
        </Suspense>
        </ExitGuard>
        </PromptProvider>
        </PinProvider>
        </ConfirmProvider>
        </ToastProvider>
      </DatabaseStatusGuard>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
