import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WaiterMobileView from './components/WaiterMobileView';
import StaffDashboard from './components/StaffDashboard';
import CustomerView from './components/CustomerView';
import TableMapView from './components/TableMapView';
import AdminView from './components/AdminView';
import POSView from './components/POSView';
import TakeawayTabletView from './components/TakeawayTabletView';
import PublicMenuView from './components/PublicMenuView';
import MenuQRView from './components/MenuQRView';
import MenuQRPrint from './components/MenuQRPrint';
import ReportsView from './components/ReportsView';
import FattureView from './components/FattureView';
import ReservationsView from './components/ReservationsView';
import SettingsView from './components/SettingsView';
import EtichettaPage from './components/EtichettaPage';
import MagazzinoView from './components/MagazzinoView';
import HaccpView from './components/HaccpView';
import CassaFiscalePage from './components/CassaFiscalePage';
import SystemPanelView from './components/SystemPanelView';
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

initTheme();

function RootRoute() {
  return isTablet() ? <StaffDashboard /> : <StaffPinGuard><WaiterMobileView /></StaffPinGuard>;
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
