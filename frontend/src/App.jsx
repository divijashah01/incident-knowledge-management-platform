import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/common/Sidebar';
import Dashboard  from './pages/Dashboard';
import Tickets    from './pages/Tickets';
import Similar    from './pages/Similar';
import Knowledge  from './pages/Knowledge';
import Chat       from './pages/Chat';
import Clusters   from './pages/Clusters';

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-gray-50 text-gray-900">
        <Sidebar />
        <main className="flex-1 ml-56 p-8">
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/tickets"   element={<Tickets />} />
            <Route path="/similar"   element={<Similar />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/chat"      element={<Chat />} />
            <Route path="/clusters"  element={<Clusters />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}