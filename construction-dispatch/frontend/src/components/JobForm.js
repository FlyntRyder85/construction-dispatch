import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Save, 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Clock, 
  User,
  FileText,
  MessageSquare,
  Send,
  Navigation
} from 'lucide-react';
import { format } from 'date-fns';
import { apiService } from '../services/apiService';
import { socketService } from '../services/socketService';
import { toast } from 'react-toastify';

const JobForm = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    address: '',
    due_date: '',
    due_time: '',
    driver_id: '',
    status: 'pending'
  });

  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  useEffect(() => {
    loadDrivers();
    
    if (isEditing) {
      loadJob();
      loadNotes();
    }

    // Set up socket listeners for real-time note updates
    socketService.on('note_added', handleNoteAdded);

    return () => {
      socketService.off('note_added', handleNoteAdded);
    };
  }, [id]);

  const loadJob = async () => {
    try {
      setLoading(true);
      const jobs = await apiService.getJobs();
      const job = jobs.find(j => j.id === parseInt(id));
      
      if (!job) {
        toast.error('Job not found');
        navigate('/jobs');
        return;
      }

      setFormData({
        title: job.title || '',
        description: job.description || '',
        address: job.address || '',
        due_date: job.due_date || '',
        due_time: job.due_time || '',
        driver_id: job.driver_id || '',
        status: job.status || 'pending'
      });
    } catch (error) {
      console.error('Error loading job:', error);
      toast.error('Error loading job');
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

  const loadNotes = async () => {
    try {
      setLoadingNotes(true);
      const notesData = await apiService.getJobNotes(id);
      setNotes(notesData);
    } catch (error) {
      console.error('Error loading notes:', error);
      toast.error('Error loading notes');
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleNoteAdded = (note) => {
    if (note.job_id === parseInt(id)) {
      setNotes(prev => [...prev, note]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.address || !formData.due_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);

    try {
      if (isEditing) {
        await apiService.updateJob(id, formData);
        toast.success('Job updated successfully');
      } else {
        await apiService.createJob(formData);
        toast.success('Job created successfully');
        navigate('/jobs');
      }
    } catch (error) {
      console.error('Error saving job:', error);
      toast.error('Error saving job');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    
    if (!newNote.trim()) {
      return;
    }

    try {
      await apiService.addJobNote(id, newNote.trim());
      setNewNote('');
      toast.success('Note added');
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Error adding note');
    }
  };

  const openGoogleMaps = () => {
    if (formData.address) {
      const encodedAddress = encodeURIComponent(formData.address);
      const url = `https://maps.google.com/?q=${encodedAddress}`;
      window.open(url, '_blank');
    }
  };

  const canEdit = user.role === 'admin' || user.role === 'dispatcher';
  const canEditStatus = user.role === 'driver' && isEditing;

  if (loading) {
    return (
      <div className="job-form loading">
        <div className="loading-spinner"></div>
        <p>Loading job...</p>
      </div>
    );
  }

  return (
    <div className="job-form">
      <div className="job-form-header">
        <button 
          onClick={() => navigate('/jobs')}
          className="btn btn-secondary"
        >
          <ArrowLeft size={16} />
          Back to Jobs
        </button>
        
        <h1>{isEditing ? 'Edit Job' : 'Create New Job'}</h1>
      </div>

      <div className="job-form-content">
        <div className="job-form-main">
          <form onSubmit={handleSubmit} className="job-details-form">
            <div className="form-section">
              <h2>Job Details</h2>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="title">
                    <FileText size={16} />
                    Job Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Enter job title"
                    required
                    disabled={!canEdit && !canEditStatus}
                  />
                </div>

                {isEditing && (
                  <div className="form-group">
                    <label htmlFor="status">
                      Status
                    </label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      disabled={!canEdit && !canEditStatus}
                    >
                      <option value="pending">Pending</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter job description (optional)"
                  rows={3}
                  disabled={!canEdit}
                />
              </div>

              <div className="form-group">
                <label htmlFor="address">
                  <MapPin size={16} />
                  Job Address *
                </label>
                <div className="address-input-group">
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Enter complete job site address"
                    required
                    disabled={!canEdit}
                  />
                  {formData.address && (
                    <button
                      type="button"
                      onClick={openGoogleMaps}
                      className="btn btn-sm btn-primary"
                      title="Open in Google Maps"
                    >
                      <Navigation size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="due_date">
                    <Calendar size={16} />
                    Due Date *
                  </label>
                  <input
                    type="date"
                    id="due_date"
                    name="due_date"
                    value={formData.due_date}
                    onChange={handleInputChange}
                    required
                    disabled={!canEdit}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="due_time">
                    <Clock size={16} />
                    Due Time (Optional)
                  </label>
                  <input
                    type="time"
                    id="due_time"
                    name="due_time"
                    value={formData.due_time}
                    onChange={handleInputChange}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              {canEdit && drivers.length > 0 && (
                <div className="form-group">
                  <label htmlFor="driver_id">
                    <User size={16} />
                    Assign Driver
                  </label>
                  <select
                    id="driver_id"
                    name="driver_id"
                    value={formData.driver_id}
                    onChange={handleInputChange}
                  >
                    <option value="">Select a driver (optional)</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {(canEdit || canEditStatus) && (
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <div className="spinner"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {isEditing ? 'Update Job' : 'Create Job'}
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Notes Section */}
        {isEditing && (
          <div className="job-notes-section">
            <div className="notes-header">
              <h2>
                <MessageSquare size={20} />
                Job Notes
              </h2>
            </div>

            <div className="notes-content">
              {loadingNotes ? (
                <div className="notes-loading">
                  <div className="spinner"></div>
                  <p>Loading notes...</p>
                </div>
              ) : (
                <>
                  <div className="notes-list">
                    {notes.length === 0 ? (
                      <div className="no-notes">
                        <MessageSquare size={32} />
                        <p>No notes yet</p>
                        <p className="no-notes-subtitle">Add the first note below</p>
                      </div>
                    ) : (
                      notes.map(note => (
                        <div key={note.id} className="note-item">
                          <div className="note-header">
                            <span className="note-author">{note.author_name}</span>
                            <span className="note-date">
                              {format(new Date(note.created_at), 'MMM dd, yyyy h:mm a')}
                            </span>
                          </div>
                          <div className="note-content">
                            {note.note}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleAddNote} className="add-note-form">
                    <div className="note-input-group">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Add a note about this job..."
                        rows={3}
                        className="note-input"
                      />
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={!newNote.trim()}
                      >
                        <Send size={16} />
                        Add Note
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobForm;