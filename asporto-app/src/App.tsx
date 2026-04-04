import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WaiterMobileView from './components/WaiterMobileView';
import TabletDashboardView from './components/TabletDashboardView';
import CustomerView from './components/CustomerView';
import StaffDashboard from './components/StaffDashboard';
import TableMapView from './components/TableMapView';
import AdminView from './components/AdminView';
import POSView from './components/POSView';
import TakeawayTabletView from './components/TakeawayTabletView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StaffDashboard />} />
        <Route path="/takeaway" element={<TakeawayTabletView />} />
        <Route path="/waiter" element={<WaiterMobileView />} />
        <Route path="/map" element={<TableMapView />} />
        <Route path="/kitchen" element={<AdminView />} />
        <Route path="/pos" element={<POSView />} />
        <Route path="/asporto" element={<CustomerView />} />
        <Route path="/admin" element={<TabletDashboardView />} />
      </Routes>
    </BrowserRouter>
  );
}
