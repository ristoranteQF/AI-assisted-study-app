import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '◇' },
  { to: '/notes', label: 'Notes', icon: '✎' },
  { to: '/decks', label: 'Decks', icon: '▤' },
  { to: '/quizzes', label: 'Quizzes', icon: '?' },
  { to: '/analytics', label: 'Analytics', icon: '↗' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export default function Sidebar({ collapsed, onToggleCollapse, onCloseMobile }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const initials = (user?.full_name || user?.email || '?')
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');

  return (
    <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="sidebar-head">
        <div className="brand">
          <div className="brand-mark">SB</div>
          {!collapsed && <span>StudyBuddy</span>}
        </div>
        <button
          type="button"
          className="sidebar-toggle desktop-only"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '›' : '‹'}
        </button>
        <button
          type="button"
          className="sidebar-toggle mobile-only"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          title="Close"
        >
          ×
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <span className="icon">{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="footer">
        {collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div
              className="avatar"
              title={`${user?.full_name || user?.email || ''}\nSign out`}
            >
              {initials}
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              style={{ width: 32, height: 32 }}
            >
              ⎋
            </button>
          </div>
        ) : (
          <>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div className="name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.full_name || 'Student'}
                </div>
                <div className="text-xs text-faint" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email}
                </div>
              </div>
              <div className="avatar">{initials}</div>
            </div>
            <button className="btn btn-ghost btn-sm btn-block" onClick={handleLogout}>
              Sign out
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
