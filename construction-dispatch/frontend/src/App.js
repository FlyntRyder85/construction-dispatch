import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

// Components
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import JobList from './components/JobList';
import JobForm from './components/JobForm';
import UserManagement from './components/UserManagement';
import LocationTracker from './components/LocationTracker';
import Calendar from './components/Calendar';
import Navigation from './components/Navigation';

// Services
import { authService } from './services/authService';
import { socketService } from './services/socketService';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check if user is logged in
        const token = localStorage.getItem('token');
        if (token) {
          const userData = await authService.validateToken(token);
          setUser(userData);
          
          // Initialize socket connection
          socketService.connect(token);
        }
      } catch (error) {
        console.error('App initialization error:', error);
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    initializeApp();

    // Cleanup on unmount
    return () => {
      socketService.disconnect();
    };
  }, []);

  const handleLogin = async (credentials) => {
    try {
      const { token, user: userData } = await authService.login(credentials);
      localStorage.setItem('token', token);
      setUser(userData);
      
      // Initialize socket connection
      socketService.connect(token);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    socketService.disconnect();
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app">
        <Login onLogin={handleLogin} />
        <ToastContainer position="top-right" autoClose={3000} />
      </div>
    );
  }

  return (
    <div className="app">
      <Router>
        <Navigation user={user} onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/jobs" element={<JobList user={user} />} />
            <Route path="/jobs/new" element={<JobForm user={user} />} />
            <Route path="/jobs/edit/:id" element={<JobForm user={user} />} />
            <Route path="/calendar" element={<Calendar user={user} />} />
            {user.role === 'admin' && (
              <Route path="/users" element={<UserManagement user={user} />} />
            )}
            {user.role === 'driver' && (
              <Route path="/location" element={<LocationTracker user={user} />} />
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        
        {/* Location tracker for drivers */}
        {user.role === 'driver' && <LocationTracker user={user} background />}
        
        <ToastContainer position="top-right" autoClose={3000} />
      </Router>
    </div>
  );
}

export default App;