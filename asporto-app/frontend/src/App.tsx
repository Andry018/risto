import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WaiterMobileView from './components/WaiterMobileView';
import TabletDashboardView from './components/TabletDashboardView';
import CustomerView from './components/CustomerView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WaiterMobileView />} />
        <Route path="/asporto" element={<CustomerView />} />
        <Route path="/admin" element={<TabletDashboardView />} />
      </Routes>
    </BrowserRouter>
  );
}
