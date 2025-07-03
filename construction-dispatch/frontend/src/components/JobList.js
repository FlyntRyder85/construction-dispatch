import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  MapPin, 
  Clock, 
  User, 
  Edit,
  Trash2,
  Navigation,
  MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { apiService } from '../services/apiService';
import { socketService } from '../services/socketService';
import { toast } from 'react-toastify';

const JobList = ({ user }) => {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    loadJobs();
    loadDrivers();
    
    // Set up socket listeners
    socketService.on('job_created', handleJobUpdate);
    socketService.on('job_updated', handleJobUpdate);
    socketService.on('job_deleted', handleJobDeleted);

    return () => {
      socketService.off('job_created', handleJobUpdate);
      socketService.off('job_updated', handleJobUpdate);
      socketService.off('job_deleted', handleJobDeleted);
    };
  }, []);

  useEffect(() => {
    filterJobs();
  }, [jobs, searchTerm, statusFilter, driverFilter]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const jobsData = await apiService.getJobs();
      setJobs(jobsData);
    } catch (error) {
      console.error('Error loading jobs:', error);
      toast.error('Error loading jobs');
    } finally {
      setLoading(false);
    }
  };

  const loadDrivers = async () => {
    try {
      if (user.role !== 'driver') {
        const users = await apiService.getUsers();
        const driverUsers = users.filter(u => u.role === 'driver' && u.active);
        setDrivers(driverUsers);
      }
    } catch (error) {
      console.error('Error loading drivers:', error);
    }
  };

  const handleJobUpdate = (updatedJob) => {
    setJobs(prev => {
      const index = prev.findIndex(job => job.id === updatedJob.id);
      if (index >= 0) {
        const newJobs = [...prev];
        newJobs[index] = updatedJob;
        return newJobs;
      } else {
        return [updatedJob, ...prev];
      }
    });
  };

  const handleJobDeleted = (deletedJob) => {
    setJobs(prev => prev.filter(job => job.id !== deletedJob.id));
  };

  const filterJobs = () => {
    let filtered = [...jobs];

    // Text search
    if (searchTerm) {
      filtered = filtered.filter(job =>
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.driver_name && job.driver_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(job => job.status === statusFilter);
    }

    // Driver filter
    if (driverFilter !== 'all') {
      if (driverFilter === 'unassigned') {
        filtered = filtered.filter(job => !job.driver_id);
      } else {
        filtered = filtered.filter(job => job.driver_id === parseInt(driverFilter));
      }
    }

    // Sort by due date and creation time
    filtered.sort((a, b) => {
      const dateA = new Date(a.due_date);
      const dateB = new Date(b.due_date);
      
      if (dateA.getTime() === dateB.getTime()) {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      
      return dateA - dateB;
    });

    setFilteredJobs(filtered);
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job?')) {
      return;
    }

    try {
      await apiService.deleteJob(jobId);
      toast.success('Job deleted successfully');
    } catch (error) {
      console.error('Error deleting job:', error);
      toast.error('Error deleting job');
    }
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

  const openGoogleMaps = (address) => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.google.com/?q=${encodedAddress}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="job-list loading">
        <div className="loading-spinner"></div>
        <p>Loading jobs...</p>
      </div>
    );
  }

  return (
    <div className="job-list">
      <div className="job-list-header">
        <div className="header-content">
          <h1>Jobs</h1>
          <p>Manage dispatch jobs and assignments</p>
        </div>
        {(user.role === 'admin' || user.role === 'dispatcher') && (
          <Link to="/jobs/new" className="btn btn-primary">
            <Plus size={16} />
            New Job
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="job-filters">
        <div className="search-bar">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>
            <Filter size={16} />
            Status:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {user.role !== 'driver' && (
          <div className="filter-group">
            <label>
              <User size={16} />
              Driver:
            </label>
            <select
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
            >
              <option value="all">All Drivers</option>
              <option value="unassigned">Unassigned</option>
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Jobs Grid */}
      <div className="jobs-grid">
        {filteredJobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              {searchTerm || statusFilter !== 'all' || driverFilter !== 'all' ? (
                <Search size={48} />
              ) : (
                <Plus size={48} />
              )}
            </div>
            <h3>
              {searchTerm || statusFilter !== 'all' || driverFilter !== 'all' 
                ? 'No jobs found'
                : 'No jobs yet'
              }
            </h3>
            <p>
              {searchTerm || statusFilter !== 'all' || driverFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first job'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && driverFilter === 'all' && 
             (user.role === 'admin' || user.role === 'dispatcher') && (
              <Link to="/jobs/new" className="btn btn-primary">
                <Plus size={16} />
                Create Job
              </Link>
            )}
          </div>
        ) : (
          filteredJobs.map(job => (
            <div key={job.id} className="job-card">
              <div className="job-card-header">
                <div className="job-title-section">
                  <h3>{job.title}</h3>
                  <span className={`job-status ${getStatusColor(job.status)}`}>
                    {job.status.replace('_', ' ')}
                  </span>
                </div>
                {(user.role === 'admin' || user.role === 'dispatcher') && (
                  <div className="job-actions">
                    <Link 
                      to={`/jobs/edit/${job.id}`}
                      className="btn btn-sm btn-secondary"
                      title="Edit Job"
                    >
                      <Edit size={16} />
                    </Link>
                    <button
                      onClick={() => handleDeleteJob(job.id)}
                      className="btn btn-sm btn-danger"
                      title="Delete Job"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              <div className="job-card-content">
                <div className="job-info">
                  <div className="job-detail">
                    <MapPin size={16} />
                    <span>{job.address}</span>
                    <button
                      onClick={() => openGoogleMaps(job.address)}
                      className="btn btn-xs btn-primary"
                      title="Open in Google Maps"
                    >
                      <Navigation size={12} />
                    </button>
                  </div>

                  <div className="job-detail">
                    <Clock size={16} />
                    <span>
                      Due: {formatDate(job.due_date)}
                      {job.due_time && ` at ${formatTime(job.due_time)}`}
                    </span>
                  </div>

                  {job.driver_name && (
                    <div className="job-detail">
                      <User size={16} />
                      <span>Driver: {job.driver_name}</span>
                    </div>
                  )}

                  {job.description && (
                    <div className="job-description">
                      <p>{job.description}</p>
                    </div>
                  )}
                </div>

                <div className="job-card-footer">
                  <Link 
                    to={`/jobs/edit/${job.id}`}
                    className="btn btn-secondary"
                  >
                    <MessageSquare size={16} />
                    View Details
                  </Link>
                  
                  <span className="job-created">
                    Created {format(new Date(job.created_at), 'MMM dd')}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Results summary */}
      {filteredJobs.length > 0 && (
        <div className="results-summary">
          Showing {filteredJobs.length} of {jobs.length} jobs
        </div>
      )}
    </div>
  );
};

export default JobList;