import { io } from 'socket.io-client';
import { toast } from 'react-toastify';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect(token) {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(SOCKET_URL, {
      auth: {
        token
      }
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
      toast.success('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      toast.warn('Disconnected from server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      toast.error('Connection error');
    });

    // Set up event listeners
    this.setupEventListeners();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  setupEventListeners() {
    // Job events
    this.socket.on('job_created', (job) => {
      toast.info(`New job created: ${job.title}`);
      this.emit('job_created', job);
    });

    this.socket.on('job_updated', (job) => {
      toast.info(`Job updated: ${job.title}`);
      this.emit('job_updated', job);
    });

    this.socket.on('job_deleted', (data) => {
      toast.info('Job deleted');
      this.emit('job_deleted', data);
    });

    // Note events
    this.socket.on('note_added', (note) => {
      toast.info('New note added');
      this.emit('note_added', note);
    });

    // Location events
    this.socket.on('location_update', (location) => {
      this.emit('location_update', location);
    });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in socket event listener:', error);
        }
      });
    }
  }

  joinRoom(room) {
    if (this.socket) {
      this.socket.emit('join_room', room);
    }
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }
}

export const socketService = new SocketService();