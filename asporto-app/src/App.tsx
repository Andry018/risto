import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WaiterMobileView from './components/WaiterMobileView';
import TabletDashboardView from './components/TabletDashboardView';
import CustomerView from './components/CustomerView';
import StaffDashboard from './components/StaffDashboard';
import TableMapView from './components/TableMapView';
import AdminView from './components/AdminView';
import POSView from './components/POSView';
import TakeawayTabletView from './components/TakeawayTabletView';
import StaffPinGuard from './components/StaffPinGuard';
import { isTablet } from './lib/DeviceUtils';
import DatabaseStatusGuard from './components/DatabaseStatusGuard';

function RootRoute() {
  return isTablet() ? <StaffDashboard /> : <WaiterMobileView />;
}

export default function App() {
  return (
    <BrowserRouter>
      <DatabaseStatusGuard>
        <Routes>
          <Route path="/asporto" element={<CustomerView />} />
          <Route element={<StaffPinGuard />}>
            <Route path="/" element={<RootRoute />} />
            <Route path="/takeaway" element={<TakeawayTabletView />} />
            <Route path="/waiter" element={<WaiterMobileView />} />
            <Route path="/map" element={<TableMapView />} />
            <Route path="/kitchen" element={<AdminView />} />
            <Route path="/pos" element={<POSView />} />
            <Route path="/admin" element={<TabletDashboardView />} />
          </Route>
        </Routes>
      </DatabaseStatusGuard>
    </BrowserRouter>
  );
}
