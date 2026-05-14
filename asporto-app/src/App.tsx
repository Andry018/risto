import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WaiterMobileView from './components/WaiterMobileView';
import TabletDashboardView from './components/TabletDashboardView';
import CustomerView from './components/CustomerView';
import StaffDashboard from './components/StaffDashboard';
import TableMapView from './components/TableMapView';
import AdminView from './components/AdminView';
import POSView from './components/POSView';
import TakeawayTabletView from './components/TakeawayTabletView';
import PublicMenuView from './components/PublicMenuView';
import ReportsView from './components/ReportsView';
import StaffPinGuard from './components/StaffPinGuard';
import { isTablet } from './lib/DeviceUtils';
import DatabaseStatusGuard from './components/DatabaseStatusGuard';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';

function RootRoute() {
  return isTablet() ? <StaffDashboard /> : <WaiterMobileView />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <DatabaseStatusGuard>
        <ToastProvider>
        <Routes>
          <Route path="/asporto" element={<CustomerView />} />
          <Route path="/menu" element={<PublicMenuView />} />
          <Route element={<StaffPinGuard />}>
            <Route path="/" element={<RootRoute />} />
            <Route path="/takeaway" element={<TakeawayTabletView />} />
            <Route path="/waiter" element={<WaiterMobileView />} />
            <Route path="/map" element={<TableMapView />} />
            <Route path="/kitchen" element={<AdminView />} />
            <Route path="/pos" element={<POSView />} />
            <Route path="/admin" element={<TabletDashboardView />} />
            <Route path="/reports" element={<ReportsView />} />
          </Route>
        </Routes>
        </ToastProvider>
      </DatabaseStatusGuard>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
