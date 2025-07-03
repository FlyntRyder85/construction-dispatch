import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Briefcase, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Users,
  MapPin,
  Plus,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { apiService } from '../services/apiService';
import { socketService } from '../services/socketService';
import { toast } from 'react-toastify';

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState({
    totalJobs: 0,
    pendingJobs: 0,
    inProgressJobs: 0,
    completedJobs: 0,
    todaysJobs: 0
  });
  const [recentJobs, setRecentJobs] = useState([]);
  const [driverLocations, setDriverLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    
    // Set up socket listeners for real-time updates
    socketService.on('job_created', handleJobUpdate);
    socketService.on('job_updated', handleJobUpdate);
    socketService.on('job_deleted', handleJobUpdate);
    socketService.on('location_update', handleLocationUpdate);

    return () => {
      socketService.off('job_created', handleJobUpdate);
      socketService.off('job_updated', handleJobUpdate);
      socketService.off('job_deleted', handleJobUpdate);
      socketService.off('location_update', handleLocationUpdate);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load jobs
      const jobs = await apiService.getJobs();
      
      // Calculate stats
      const today = format(new Date(), 'yyyy-MM-dd');
      const newStats = {
        totalJobs: jobs.length,
        pendingJobs: jobs.filter(job => job.status === 'pending').length,
        inProgressJobs: jobs.filter(job => job.status === 'in_progress').length,
        completedJobs: jobs.filter(job => job.status === 'completed').length,
        todaysJobs: jobs.filter(job => job.due_date === today).length
      };
      
      setStats(newStats);
      
      // Get recent jobs (last 10)
      const sortedJobs = jobs
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10);
      setRecentJobs(sortedJobs);
      
      // Load driver locations for admin/dispatcher
      if (user.role !== 'driver') {
        try {
          const locations = await apiService.getDriverLocations();
          setDriverLocations(locations);
        } catch (error) {
          console.error('Error loading driver locations:', error);
        }
      }
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Error loading dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleJobUpdate = () => {
    loadDashboardData();
  };

  const handleLocationUpdate = (location) => {
    setDriverLocations(prev => {
      const updated = prev.filter(loc => loc.driver_id !== location.driver_id);
      return [...updated, location];
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'assigned': return 'status-assigned';
      case 'in_progress': return 'status-in-progress';
      case 'completed': return 'status-completed';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-pending';
    }
  };

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    try {
      const [hours, minutes] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return format(date, 'h:mm a');
    } catch {
      return timeString;
    }
  };

  if (loading) {
    return (
      <div className="dashboard loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {user.name}</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <Briefcase size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.totalJobs}</h3>
            <p>Total Jobs</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pending">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.pendingJobs}</h3>
            <p>Pending</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon in-progress">
            <AlertCircle size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.inProgressJobs}</h3>
            <p>In Progress</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon completed">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.completedJobs}</h3>
            <p>Completed</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon today">
            <Calendar size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.todaysJobs}</h3>
            <p>Due Today</p>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Recent Jobs */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Recent Jobs</h2>
            <div className="section-actions">
              {(user.role === 'admin' || user.role === 'dispatcher') && (
                <Link to="/jobs/new" className="btn btn-primary">
                  <Plus size={16} />
                  New Job
                </Link>
              )}
              <Link to="/jobs" className="btn btn-secondary">
                View All
              </Link>
            </div>
          </div>

          <div className="jobs-list">
            {recentJobs.length === 0 ? (
              <div className="empty-state">
                <Briefcase size={48} />
                <h3>No jobs yet</h3>
                <p>Get started by creating your first job</p>
                {(user.role === 'admin' || user.role === 'dispatcher') && (
                  <Link to="/jobs/new" className="btn btn-primary">
                    <Plus size={16} />
                    Create Job
                  </Link>
                )}
              </div>
            ) : (
              recentJobs.map(job => (
                <div key={job.id} className="job-card">
                  <div className="job-header">
                    <h3>{job.title}</h3>
                    <span className={`job-status ${getStatusColor(job.status)}`}>
                      {job.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="job-details">
                    <p className="job-address">
                      <MapPin size={16} />
                      {job.address}
                    </p>
                    <p className="job-due">
                      <Clock size={16} />
                      Due: {formatDate(job.due_date)} {job.due_time && formatTime(job.due_time)}
                    </p>
                    {job.driver_name && (
                      <p className="job-driver">
                        <Users size={16} />
                        Driver: {job.driver_name}
                      </p>
                    )}
                  </div>
                  <div className="job-actions">
                    <Link to={`/jobs/edit/${job.id}`} className="btn btn-sm btn-secondary">
                      View Details
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Driver Locations (for admin/dispatcher) */}
        {user.role !== 'driver' && driverLocations.length > 0 && (
          <div className="dashboard-section">
            <div className="section-header">
              <h2>Driver Locations</h2>
              <p className="section-subtitle">Last updated within the hour</p>
            </div>

            <div className="driver-locations">
              {driverLocations.map(location => (
                <div key={location.driver_id} className="location-card">
                  <div className="location-header">
                    <h4>{location.driver_name}</h4>
                    <span className="location-time">
                      {format(new Date(location.updated_at), 'h:mm a')}
                    </span>
                  </div>
                  <div className="location-coords">
                    <MapPin size={16} />
                    <span>{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</span>
                  </div>
                  <button 
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      const url = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
                      window.open(url, '_blank');
                    }}
                  >
                    View on Map
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Quick Actions</h2>
          </div>

          <div className="quick-actions">
            <Link to="/jobs" className="action-card">
              <Briefcase size={32} />
              <h3>View Jobs</h3>
              <p>See all current jobs and their status</p>
            </Link>

            <Link to="/calendar" className="action-card">
              <Calendar size={32} />
              <h3>Calendar</h3>
              <p>View jobs by date and schedule</p>
            </Link>

            {(user.role === 'admin' || user.role === 'dispatcher') && (
              <Link to="/jobs/new" className="action-card">
                <Plus size={32} />
                <h3>New Job</h3>
                <p>Create a new dispatch job</p>
              </Link>
            )}

            {user.role === 'admin' && (
              <Link to="/users" className="action-card">
                <Users size={32} />
                <h3>Manage Users</h3>
                <p>Add and manage system users</p>
              </Link>
            )}

            {user.role === 'driver' && (
              <Link to="/location" className="action-card">
                <MapPin size={32} />
                <h3>Location</h3>
                <p>View and update your location</p>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;