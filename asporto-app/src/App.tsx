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
import ReservationsView from './components/ReservationsView';
import ExitGuard from './components/ExitGuard';
import { isTablet } from './lib/DeviceUtils';
import DatabaseStatusGuard from './components/DatabaseStatusGuard';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmModal';

function RootRoute() {
  return isTablet() ? <StaffDashboard /> : <WaiterMobileView />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <DatabaseStatusGuard>
        <ToastProvider>
        <ConfirmProvider>
        <ExitGuard>
        <Routes>
          <Route path="/asporto" element={<CustomerView />} />
          <Route path="/menu" element={<PublicMenuView />} />
          <Route path="/qr-menu" element={<MenuQRView />} />
          <Route path="/qr-print" element={<MenuQRPrint />} />
          <Route path="/" element={<RootRoute />} />
          <Route path="/takeaway" element={<TakeawayTabletView />} />
          <Route path="/waiter" element={<WaiterMobileView />} />
          <Route path="/map" element={<TableMapView />} />
          <Route path="/kitchen" element={<AdminView />} />
          <Route path="/pos" element={<POSView />} />
          <Route path="/reports" element={<ReportsView />} />
          <Route path="/reservations" element={<ReservationsView />} />
        </Routes>
        </ExitGuard>
        </ConfirmProvider>
        </ToastProvider>
      </DatabaseStatusGuard>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
