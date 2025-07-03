import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Briefcase, 
  Calendar, 
  Users, 
  MapPin, 
  LogOut, 
  Menu, 
  X,
  Plus
} from 'lucide-react';

const Navigation = ({ user, onLogout }) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) => {
    return location.pathname === path;
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      onLogout();
    }
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const navigationItems = [
    {
      path: '/',
      icon: Home,
      label: 'Dashboard',
      roles: ['admin', 'dispatcher', 'driver']
    },
    {
      path: '/jobs',
      icon: Briefcase,
      label: 'Jobs',
      roles: ['admin', 'dispatcher', 'driver']
    },
    {
      path: '/jobs/new',
      icon: Plus,
      label: 'New Job',
      roles: ['admin', 'dispatcher']
    },
    {
      path: '/calendar',
      icon: Calendar,
      label: 'Calendar',
      roles: ['admin', 'dispatcher', 'driver']
    },
    {
      path: '/users',
      icon: Users,
      label: 'Users',
      roles: ['admin']
    },
    {
      path: '/location',
      icon: MapPin,
      label: 'Location',
      roles: ['driver']
    }
  ];

  const visibleItems = navigationItems.filter(item => 
    item.roles.includes(user.role)
  );

  return (
    <>
      <nav className="navigation">
        <div className="nav-container">
          <div className="nav-brand">
            <h2>Dispatch</h2>
            <span className="user-role">{user.role}</span>
          </div>

          {/* Desktop Navigation */}
          <div className="nav-links desktop-nav">
            {visibleItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
                >
                  <IconComponent size={20} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="nav-user">
            <span className="user-name">{user.name}</span>
            <button onClick={handleLogout} className="logout-button">
              <LogOut size={20} />
              <span className="logout-text">Logout</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="mobile-menu-button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-nav-overlay" onClick={closeMobileMenu}>
          <div className="mobile-nav" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-nav-header">
              <h3>{user.name}</h3>
              <span className="mobile-user-role">{user.role}</span>
            </div>

            <div className="mobile-nav-links">
              {visibleItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`mobile-nav-link ${isActive(item.path) ? 'active' : ''}`}
                    onClick={closeMobileMenu}
                  >
                    <IconComponent size={20} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="mobile-nav-footer">
              <button onClick={handleLogout} className="mobile-logout-button">
                <LogOut size={20} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navigation;