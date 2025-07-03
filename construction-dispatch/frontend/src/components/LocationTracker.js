import React, { useState, useEffect } from 'react';
import { MapPin, Wifi, WifiOff, Navigation, Eye, EyeOff } from 'lucide-react';
import { apiService } from '../services/apiService';
import { toast } from 'react-toastify';

const LocationTracker = ({ user, background = false }) => {
  const [location, setLocation] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingUpdates, setPendingUpdates] = useState([]);

  useEffect(() => {
    // Online/offline detection
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline && pendingUpdates.length > 0) {
      processPendingUpdates();
    }
  }, [isOnline]);

  useEffect(() => {
    if (user.role === 'driver') {
      startTracking();
    }

    return () => {
      stopTracking();
    };
  }, [user]);

  const processPendingUpdates = async () => {
    if (pendingUpdates.length === 0) return;

    try {
      // Send the most recent location update
      const latestUpdate = pendingUpdates[pendingUpdates.length - 1];
      await apiService.updateLocation(latestUpdate.latitude, latestUpdate.longitude);
      
      setPendingUpdates([]);
      setLastUpdate(new Date());
      
      if (!background) {
        toast.success('Location synced');
      }
    } catch (error) {
      console.error('Error processing pending updates:', error);
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setTracking(true);
    setError(null);

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000 // Cache for 30 seconds
    };

    const watchId = navigator.geolocation.watchPosition(
      handleLocationSuccess,
      handleLocationError,
      options
    );

    // Store watch ID for cleanup
    window.locationWatchId = watchId;

    // Initial location request
    navigator.geolocation.getCurrentPosition(
      handleLocationSuccess,
      handleLocationError,
      options
    );
  };

  const stopTracking = () => {
    setTracking(false);
    if (window.locationWatchId) {
      navigator.geolocation.clearWatch(window.locationWatchId);
      window.locationWatchId = null;
    }
  };

  const handleLocationSuccess = async (position) => {
    const { latitude, longitude } = position.coords;
    
    setLocation({
      latitude,
      longitude,
      accuracy: position.coords.accuracy,
      timestamp: new Date(position.timestamp)
    });

    // Try to update location on server
    try {
      if (isOnline) {
        await apiService.updateLocation(latitude, longitude);
        setLastUpdate(new Date());
        
        if (!background) {
          toast.success('Location updated');
        }
      } else {
        // Store for later when online
        setPendingUpdates(prev => [...prev, { latitude, longitude, timestamp: new Date() }]);
        
        if (!background) {
          toast.info('Location cached (offline)');
        }
      }
    } catch (error) {
      console.error('Error updating location:', error);
      
      // Store for retry
      setPendingUpdates(prev => [...prev, { latitude, longitude, timestamp: new Date() }]);
      
      if (!background) {
        toast.error('Failed to update location');
      }
    }
  };

  const handleLocationError = (error) => {
    let errorMessage;
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location access denied by user';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out';
        break;
      default:
        errorMessage = 'Unknown location error';
        break;
    }
    
    setError(errorMessage);
    setTracking(false);
    
    if (!background) {
      toast.error(errorMessage);
    }
  };

  const toggleTracking = () => {
    if (tracking) {
      stopTracking();
      toast.info('Location tracking stopped');
    } else {
      startTracking();
      toast.info('Location tracking started');
    }
  };

  const openInMaps = () => {
    if (location) {
      const url = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
      window.open(url, '_blank');
    }
  };

  const formatCoordinate = (coord) => {
    return coord ? coord.toFixed(6) : 'Unknown';
  };

  const formatAccuracy = (accuracy) => {
    if (!accuracy) return 'Unknown';
    
    if (accuracy < 10) return 'High';
    if (accuracy < 50) return 'Medium';
    return 'Low';
  };

  // Background component - minimal UI
  if (background) {
    return null; // All tracking happens in background
  }

  // Full UI component for driver location page
  return (
    <div className="location-tracker">
      <div className="location-header">
        <h1>
          <MapPin size={24} />
          Location Tracking
        </h1>
        <p>Your current location and tracking status</p>
      </div>

      <div className="location-content">
        {/* Connection Status */}
        <div className="status-card">
          <div className="status-header">
            <h2>Connection Status</h2>
            <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
              {isOnline ? <Wifi size={20} /> : <WifiOff size={20} />}
              {isOnline ? 'Online' : 'Offline'}
            </div>
          </div>
          
          {pendingUpdates.length > 0 && (
            <div className="pending-updates">
              <p>{pendingUpdates.length} location update(s) pending sync</p>
            </div>
          )}
        </div>

        {/* Tracking Controls */}
        <div className="tracking-controls">
          <div className="control-header">
            <h2>Location Tracking</h2>
            <div className="tracking-status">
              {tracking ? (
                <span className="status-active">
                  <Eye size={16} />
                  Active
                </span>
              ) : (
                <span className="status-inactive">
                  <EyeOff size={16} />
                  Inactive
                </span>
              )}
            </div>
          </div>

          <div className="control-actions">
            <button
              onClick={toggleTracking}
              className={`btn ${tracking ? 'btn-danger' : 'btn-success'}`}
            >
              {tracking ? 'Stop Tracking' : 'Start Tracking'}
            </button>

            {location && (
              <button
                onClick={openInMaps}
                className="btn btn-primary"
              >
                <Navigation size={16} />
                View on Map
              </button>
            )}
          </div>

          {error && (
            <div className="error-message">
              <p>{error}</p>
              <button onClick={startTracking} className="btn btn-sm btn-secondary">
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Current Location */}
        {location && (
          <div className="current-location">
            <h2>Current Location</h2>
            
            <div className="location-details">
              <div className="location-row">
                <label>Latitude:</label>
                <span>{formatCoordinate(location.latitude)}</span>
              </div>
              
              <div className="location-row">
                <label>Longitude:</label>
                <span>{formatCoordinate(location.longitude)}</span>
              </div>
              
              <div className="location-row">
                <label>Accuracy:</label>
                <span>
                  {formatAccuracy(location.accuracy)}
                  {location.accuracy && ` (±${Math.round(location.accuracy)}m)`}
                </span>
              </div>
              
              <div className="location-row">
                <label>Last Updated:</label>
                <span>
                  {location.timestamp ? location.timestamp.toLocaleString() : 'Unknown'}
                </span>
              </div>
              
              {lastUpdate && (
                <div className="location-row">
                  <label>Last Synced:</label>
                  <span>{lastUpdate.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Usage Instructions */}
        <div className="usage-instructions">
          <h2>Instructions</h2>
          <div className="instruction-list">
            <div className="instruction-item">
              <strong>Automatic Tracking:</strong> When you log in as a driver, location tracking starts automatically to help dispatchers know your current position.
            </div>
            <div className="instruction-item">
              <strong>Offline Support:</strong> Your location is cached when offline and synced when you reconnect to the internet.
            </div>
            <div className="instruction-item">
              <strong>Privacy:</strong> Your location is only shared with dispatchers and administrators for job coordination purposes.
            </div>
            <div className="instruction-item">
              <strong>Battery Impact:</strong> Location tracking may affect battery life. Consider stopping tracking when not on duty.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationTracker;