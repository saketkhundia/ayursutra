import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LogOut, UserCircle } from 'lucide-react';
import './Navbar.css';

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

interface NavbarProps {
  navItems: NavItem[];
  unreadCount: number;
  onLogout: () => void;
}

export default function AyurNavbar({ navItems, unreadCount, onLogout }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <>
      <nav className="navbar" aria-label="Main navigation">
        <div className="navbar-inner">
          {/* Logo */}
          <NavLink to="/dashboard" className="navbar-logo" aria-label="AyurSutra home">
            Ayur<span className="accent">Sutra</span>
          </NavLink>

          {/* Desktop nav links */}
          <ul className="navbar-links">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/dashboard' || item.to === '/find-doctors'}
                  className={({ isActive }) =>
                    `navbar-link${isActive ? ' active' : ''}`
                  }
                  aria-current={location.pathname === item.to ? 'page' : undefined}
                >
                  <item.icon />
                  <span>{item.label}</span>
                  {item.to === '/notifications' && unreadCount > 0 && (
                    <span className="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Right Section: Sign Out & Profile */}
          <div className="navbar-right">
            <button className="navbar-signout" onClick={onLogout} type="button">
              <LogOut />
              <span>Sign Out</span>
            </button>

            <NavLink to="/doctor-profile" className="navbar-avatar" aria-label="My Profile">
              <UserCircle />
            </NavLink>
          </div>

          {/* Hamburger (mobile) */}
          <button
            className="navbar-hamburger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            type="button"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      <div
        className={`navbar-overlay${menuOpen ? ' open' : ''}`}
        onClick={() => setMenuOpen(false)}
      />

      {/* Mobile dropdown */}
      <div
        ref={menuRef}
        className={`navbar-mobile-dropdown${menuOpen ? ' open' : ''}`}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard' || item.to === '/find-doctors'}
            className={({ isActive }) =>
              `navbar-link${isActive ? ' active' : ''}`
            }
            aria-current={location.pathname === item.to ? 'page' : undefined}
          >
            <item.icon />
            <span>{item.label}</span>
            {item.to === '/notifications' && unreadCount > 0 && (
              <span className="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </NavLink>
        ))}
        
        <NavLink to="/doctor-profile" className="navbar-link" aria-label="My Profile">
          <UserCircle />
          <span>My Profile</span>
        </NavLink>

        <button className="navbar-signout" onClick={onLogout} type="button">
          <LogOut />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );
}
