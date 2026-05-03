import { NavLink } from 'react-router-dom';

const links = [
  { to: '/',          label: 'Dashboard',    icon: '📊' },
  { to: '/tickets',   label: 'Tickets',      icon: '🎫' },
  { to: '/similar',   label: 'Similar',      icon: '🔍' },
  { to: '/clusters',  label: 'Clusters',     icon: '🧩' },
  { to: '/knowledge', label: 'Knowledge',    icon: '📚' },
  { to: '/chat',      label: 'Chat',         icon: '💬' },
];

export default function Sidebar() {
  return (
    <aside className="fixed top-0 left-0 h-screen w-56 bg-gray-900 text-white flex flex-col">
      <div className="px-5 py-6 border-b border-gray-700">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Platform</p>
        <h1 className="text-base font-semibold leading-tight">
          Incident Knowledge<br />Management
        </h1>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ` +
              (isActive
                ? 'bg-blue-600 text-white font-medium'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white')
            }
          >
            <span>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">EDI Project · Sem 4</p>
      </div>
    </aside>
  );
}