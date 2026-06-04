import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';

const COLLAPSED_KEY = 'studybuddy.sidebar-collapsed';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) === '1',
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  // Auto-close the mobile drawer when the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock background scroll while the mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  // Close drawer on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => e.key === 'Escape' && setMobileOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const shellClass = [
    'app-shell',
    collapsed && 'is-collapsed',
    mobileOpen && 'is-mobile-open',
  ].filter(Boolean).join(' ');

  return (
    <div className={shellClass}>
      <header className="mobile-topbar">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          ☰
        </button>
        <div className="topbar-brand">
          <div className="brand-mark">SB</div>
          <span>StudyBuddy</span>
        </div>
      </header>

      <div
        className="sidebar-backdrop"
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />

      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
