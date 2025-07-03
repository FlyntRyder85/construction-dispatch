import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class ApiService {
  // User methods
  async getUsers() {
    const response = await axios.get(`${API_URL}/users`);
    return response.data;
  }

  async createUser(userData) {
    const response = await axios.post(`${API_URL}/users`, userData);
    return response.data;
  }

  async updateUser(id, userData) {
    const response = await axios.put(`${API_URL}/users/${id}`, userData);
    return response.data;
  }

  // Job methods
  async getJobs(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    
    const response = await axios.get(`${API_URL}/jobs?${params}`);
    return response.data;
  }

  async getJob(id) {
    const response = await axios.get(`${API_URL}/jobs/${id}`);
    return response.data;
  }

  async createJob(jobData) {
    const response = await axios.post(`${API_URL}/jobs`, jobData);
    return response.data;
  }

  async updateJob(id, jobData) {
    const response = await axios.put(`${API_URL}/jobs/${id}`, jobData);
    return response.data;
  }

  async deleteJob(id) {
    const response = await axios.delete(`${API_URL}/jobs/${id}`);
    return response.data;
  }

  // Notes methods
  async getJobNotes(jobId) {
    const response = await axios.get(`${API_URL}/jobs/${jobId}/notes`);
    return response.data;
  }

  async addJobNote(jobId, note) {
    const response = await axios.post(`${API_URL}/jobs/${jobId}/notes`, { note });
    return response.data;
  }

  // Location methods
  async updateLocation(latitude, longitude) {
    const response = await axios.post(`${API_URL}/location`, {
      latitude,
      longitude
    });
    return response.data;
  }

  async getDriverLocations() {
    const response = await axios.get(`${API_URL}/locations`);
    return response.data;
  }

  // Health check
  async healthCheck() {
    const response = await axios.get(`${API_URL}/health`);
    return response.data;
  }
}

export const apiService = new ApiService();