import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links    = NAV[user?.role] || [];
  const badge    = ROLE_BADGE[user?.role] || {};
  const isAdmin  = user?.role === 'admin';
  const groups   = isAdmin ? [...new Set(links.map(l => l.group))] : null;
  const initials = user?.username?.[0]?.toUpperCase() ?? '?';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="fixed top-0 left-0 h-screen w-60 flex flex-col z-20 select-none bg-[var(--brand-900)] border-r border-white/10">
      
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shadow-inner">
            <span className="text-white font-bold text-sm font-mono tracking-wider">IK</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight tracking-tight">Incident</p>
            <p className="text-[var(--brand-50)] text-[11px] leading-tight mt-0.5 opacity-80 font-medium">Knowledge Platform</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 overflow-y-auto scrollbar-none">
        {isAdmin ? (
          groups.map(group => (
            <div key={group} className="mb-6">
              <p className="text-[10px] font-bold tracking-[0.12em] uppercase px-3 mb-2 text-[var(--brand-300)] opacity-70">
                {GROUPS[group]}
              </p>
              <div className="flex flex-col gap-0.5">
                {links.filter(l => l.group === group).map(({ to, label, icon: Icon }) => (
                  <NavItem key={to} to={to} label={label} Icon={Icon} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col gap-0.5">
            {links.map(({ to, label, icon: Icon }) => (
              <NavItem key={to} to={to} label={label} Icon={Icon} />
            ))}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="px-4 pb-5 pt-4 border-t border-white/10 bg-black/10">
        <div className="flex items-center gap-3 mb-4 px-1">
          <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[var(--brand-50)] text-sm font-semibold truncate">
              {user?.username}
            </p>
            <span 
              className="text-[10px] font-bold mt-0.5 block" 
              style={{ color: badge.color }}
            >
              {badge.label}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--brand-300)] hover:text-white hover:bg-white/10 transition-colors duration-150"
        >
          <SignOutIcon size={14} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

function NavItem({ to, label, Icon }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => `
        flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150
        ${isActive 
          ? 'bg-white/15 text-white font-semibold shadow-sm' 
          : 'text-[var(--brand-300)] font-medium hover:bg-white/5 hover:text-white'
        }
      `}
    >
      {({ isActive }) => (
        <>
          <span className={`flex items-center shrink-0 ${isActive ? 'text-white' : 'text-[var(--brand-300)] opacity-70'}`}>
            <Icon size={16} />
          </span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

/* ── Minimal SVG icons ──────────────────── */
const ic = (d, opts = {}) => function Icon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth={opts.sw ?? 1.8} strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
};

const PlusIcon    = ic(<><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/></>);
const TicketIcon  = ic(<><rect x="1.5" y="4" width="13" height="8" rx="1.5"/><line x1="5.5" y1="4" x2="5.5" y2="12" strokeDasharray="1.5 1.5"/></>);
const SearchIcon  = ic(<><circle cx="6.5" cy="6.5" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/></>);
const ChatIcon    = ic(<><path d="M2 2h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 3V3a1 1 0 0 1 1-1z"/></>);
const QueueIcon   = ic(<><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="9" y2="12"/></>);
const BookIcon    = ic(<><path d="M3 2h8a1 1 0 0 1 1 1v11l-4-2-4 2V3a1 1 0 0 1 1-1z"/></>);
const GridIcon    = ic(<><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></>);
const ClusterIcon = ic(<><circle cx="8" cy="8" r="2.5"/><circle cx="3" cy="4" r="1.5"/><circle cx="13" cy="4" r="1.5"/><circle cx="3" cy="12" r="1.5"/><circle cx="13" cy="12" r="1.5"/><line x1="5.5" y1="6.5" x2="5.5" y2="5.5"/></>);
const CogIcon     = ic(<><circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M11.2 4.8l-1.4 1.4M4.6 11.2l-1.4 1.4"/></>, { sw: 1.5 });
const UsersIcon   = ic(<><circle cx="6" cy="5.5" r="2.5"/><path d="M1 13c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5"/><circle cx="12" cy="5.5" r="2"/><path d="M11.5 9c1.6.3 3 1.5 3 4"/></>);
const SignOutIcon = ic(<><path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/><polyline points="11 11 14 8 11 5"/><line x1="14" y1="8" x2="6" y2="8"/></>);

/* ── Nav config ─────────────────────────── */
const NAV = {
  reporter: [
    { to: '/submit',     label: 'Submit Ticket',  icon: PlusIcon },
    { to: '/my-tickets', label: 'My Tickets',     icon: TicketIcon },
    { to: '/search',     label: 'Search',         icon: SearchIcon },
    { to: '/chat',       label: 'Chat Assistant', icon: ChatIcon },
  ],
  engineer: [
    { to: '/queue',     label: 'Ticket Queue',   icon: QueueIcon },
    { to: '/search',    label: 'Search',         icon: SearchIcon },
    { to: '/chat',      label: 'Chat Assistant', icon: ChatIcon },
    { to: '/knowledge', label: 'Knowledge Base', icon: BookIcon },
  ],
  admin: [
    { to: '/dashboard',       label: 'Dashboard',   icon: GridIcon,    group: 'overview' },
    { to: '/tickets',         label: 'All Tickets', icon: TicketIcon,  group: 'overview' },
    { to: '/queue',           label: 'Queue',       icon: QueueIcon,   group: 'overview' },
    { to: '/search',          label: 'Search',      icon: SearchIcon,  group: 'tools' },
    { to: '/chat',            label: 'Chat',        icon: ChatIcon,    group: 'tools' },
    { to: '/clusters',        label: 'Clusters',    icon: ClusterIcon, group: 'ai' },
    { to: '/knowledge-admin', label: 'Knowledge',   icon: BookIcon,    group: 'ai' },
    { to: '/model-admin',     label: 'Model Admin', icon: CogIcon,     group: 'system' },
    { to: '/users',           label: 'Users',       icon: UsersIcon,   group: 'system' },
  ],
};

const GROUPS = {
  overview: 'Overview',
  tools:    'Tools',
  ai:       'AI & Knowledge',
  system:   'System',
};

const ROLE_BADGE = {
  reporter: { label: 'Reporter', color: '#86efac' },
  engineer: { label: 'Engineer', color: '#93c5fd' },
  admin:    { label: 'Admin',    color: '#c4b5fd' },
};