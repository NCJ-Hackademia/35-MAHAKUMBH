import React, { useState, useEffect, useRef } from 'react';
import { 
  Drone, 
  Battery, 
  Signal, 
  Camera, 
  Thermometer, 
  Mic, 
  Play,
  Pause,
  ArrowLeft,
  ArrowRight,
  Navigation,
  Zap
} from 'lucide-react';
import './App.css';

const DroneRescueDashboard = () => {
  const [selectedDrone, setSelectedDrone] = useState(1);
  const [selectedDetection, setSelectedDetection] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [zoomedImage, setZoomedImage] = useState(null);
  const audioRef = useRef(null);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize or update the audio object when a new detection is selected
  useEffect(() => {
    if (currentDetectionData && currentDetectionData.audioFile) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(currentDetectionData.audioFile);
      audioRef.current.onended = () => setIsPlaying(false);
    }
  }, [selectedDetection, selectedDrone]);

  const [isPlaying, setIsPlaying] = useState(false); // New state for audio playback

  const handleAudioToggle = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const drones = {
    1: {
      id: 1,
      name: "Phoenix-1",
      callsign: "PHX-01",
      status: "active",
      battery: 87,
      signal: 95,
      altitude: 120,
      speed: 45,
      location: { lat: 28.7041, lng: 77.1025 },
      detections: [
        {
          id: 1,
          type: "visual",
          method: "Image Recognition",
          timestamp: "2024-01-15 14:23:15",
          coordinates: { lat: 28.7041, lng: 77.1025 },
          confidence: 0.94,
          priority: "high",
          image: "human_detected_2.png"
        },
        {
          id: 2,
          type: "thermal",
          method: "Thermal Human Detection",
          timestamp: "2024-01-15 14:25:42",
          coordinates: { lat: 28.7045, lng: 77.1028 },
          confidence: 0.89,
          priority: "medium",
          image: "thermal_detected_1.png"
        }
      ]
    },
    2: {
      id: 2,
      name: "Raven-2",
      callsign: "RVN-02",
      status: "active",
      battery: 92,
      signal: 88,
      altitude: 95,
      speed: 38,
      location: { lat: 28.7055, lng: 77.1015 },
      detections: [
        {
          id: 3,
          type: "visual",
          method: "Multi-Person Detection",
          timestamp: "2024-01-15 14:20:05",
          coordinates: { lat: 28.7055, lng: 77.1015 },
          confidence: 0.91,
          priority: "high",
          image: "human_detected_1.png"
        },
        // --- New Thermal Detection for Drone 2 ---
        {
          id: 5, // New unique ID
          type: "thermal",
          method: "Thermal Human Detection",
          timestamp: "2024-01-15 14:22:18",
          coordinates: { lat: 28.7058, lng: 77.1011 },
          confidence: 0.85,
          priority: "medium",
          image: "thermal_detected_2.png"
        }
      ]
    },
    3: {
      id: 3,
      name: "Hawk-3",
      callsign: "HWK-03",
      status: "active",
      battery: 45,
      signal: 72,
      altitude: 0,
      speed: 0,
      location: { lat: 28.7035, lng: 77.1040 },
      detections: [
        {
          id: 4,
          type: "audio",
          method: "Voice Recognition",
          timestamp: "2024-01-15 14:15:22",
          coordinates: { lat: 28.7035, lng: 77.1040 },
          confidence: 0.82,
          priority: "low",
          audioFile: "shout-104972.mp3" // Added audio file path
        },
        // --- New Detections for Drone 3 ---
        {
          id: 6, // New unique ID
          type: "thermal",
          method: "Thermal Human Detection",
          timestamp: "2024-01-15 14:16:50",
          coordinates: { lat: 28.7033, lng: 77.1042 },
          confidence: 0.90,
          priority: "medium",
          image: "thermal_detected_3.png"
        },
        {
          id: 7, // New unique ID
          type: "thermal",
          method: "Thermal Signature",
          timestamp: "2024-01-15 14:17:30",
          coordinates: { lat: 28.7036, lng: 77.1045 },
          confidence: 0.88,
          priority: "medium",
          image: "thermal_detected_4.png"
        },
        {
          id: 8, // New unique ID
          type: "visual",
          method: "Image Recognition",
          timestamp: "2024-01-15 14:18:05",
          coordinates: { lat: 28.7039, lng: 77.1041 },
          confidence: 0.95,
          priority: "high",
          image: "human_detected_3.png"
        }
      ]
    }
  };

  const currentDrone = drones[selectedDrone];
  const currentDetections = currentDrone.detections;
  const currentDetectionData = currentDetections[selectedDetection];

  const getDetectionIcon = (type) => {
    switch (type) {
      case 'visual': return <Camera className="w-5 h-5" />;
      case 'thermal': return <Thermometer className="w-5 h-5" />;
      case 'audio': return <Mic className="w-5 h-5" />;
      default: return <Camera className="w-5 h-5" />;
    }
  };



  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-emerald-500';
      case 'standby': return 'text-yellow-500';
      case 'offline': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };



  const nextDetection = () => {
    if (selectedDetection < currentDetections.length - 1) {
      setSelectedDetection(selectedDetection + 1);
      // Reset audio and zoom states
      setIsPlaying(false);
      setZoomedImage(null);
    }
  };
  
  const prevDetection = () => {
    if (selectedDetection > 0) {
      setSelectedDetection(selectedDetection - 1);
      // Reset audio and zoom states
      setIsPlaying(false);
      setZoomedImage(null);
    }
  };



  return (
    <div className="dashboard" style={{ minHeight: '100vh', backgroundColor: '#1a1a2e' }}>
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo">
              <Drone className="logo-icon" />
              <div className="logo-text">
                <h1>Drone Rescue Command</h1>
                <p>Emergency Response Dashboard</p>
              </div>
            </div>
          </div>
          
          <div className="header-center">
            <div className="live-indicator">
              <div className={`live-dot ${isLive ? 'live' : 'offline'}`}></div>
              <span>{isLive ? 'LIVE' : 'OFFLINE'}</span>
            </div>
          </div>
          
          <div className="header-right">
            <div className="date-display">
              {currentTime.toLocaleDateString()}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="dashboard-grid">
          {/* Left Sidebar - Fleet Status */}
          <aside className="sidebar">
            <div className="sidebar-section">
              <h2>Fleet Status</h2>
              <div className="fleet-overview">
                {Object.values(drones).map((drone) => (
                  <div
                    key={drone.id}
                    className={`drone-card ${selectedDrone === drone.id ? 'selected' : ''}`}
                    onClick={() => { setSelectedDrone(drone.id); setSelectedDetection(0); }}
                  >
                    <div className="drone-header">
                      <div className="drone-info">
                        <h3>{drone.name}</h3>
                        <span className="callsign">{drone.callsign}</span>
                      </div>
                      <div className={`status-badge ${getStatusColor(drone.status)}`}>
                        {drone.status}
                      </div>
                    </div>
                    

                    
                    <div className="drone-detections">
                      <span>{drone.detections.length} detection{drone.detections.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <section className="main-panel">
            <div className="panel-header">
              <div className="panel-title">
                <h2>{currentDrone.name}</h2>
                <span className="callsign">{currentDrone.callsign}</span>
              </div>
              
              <div className="panel-controls">
                <div className="detection-counter">
                  {selectedDetection + 1} / {currentDetections.length}
                </div>
                
                <div className="navigation-controls">
                  <button 
                    onClick={prevDetection} 
                    disabled={selectedDetection === 0}
                    className="nav-btn"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={nextDetection} 
                    disabled={selectedDetection === currentDetections.length - 1}
                    className="nav-btn"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            
            {currentDetectionData && (
              <div className="detection-content">
                <div className="detection-header">
                  <div className="detection-type">
                    <div className="type-icon">
                      {getDetectionIcon(currentDetectionData.type)}
                    </div>
                    <div className="type-info">
                      <h3>{currentDetectionData.method}</h3>
                      <span className="detection-id">#{currentDetectionData.id}</span>
                    </div>
                  </div>
                  
                  <div className="detection-meta">
                  </div>
                </div>
                
                <div className="detection-body">
                  <div className="detection-media">
                    {currentDetectionData.image && (
                      <div className="media-container" onClick={() => setZoomedImage(currentDetectionData.image)}>
                        <img 
                          src={currentDetectionData.image} 
                          alt="Detection"
                          className="detection-image" 
                        />
                      </div>
                    )}
                    
                    {currentDetectionData.audioFile && (
                      <div className="audio-container">
                        <button onClick={handleAudioToggle} className={`audio-toggle-btn ${isPlaying ? 'playing' : ''}`}>
                          {isPlaying ? <Pause className="audio-icon" /> : <Play className="audio-icon" />}
                        </button>
                        <span>{isPlaying ? 'Playing Audio...' : 'Audio Detection Active'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Right Sidebar - Detection History */}
          <aside className="detection-sidebar">
            <div className="sidebar-section">
              <h2>Detection History</h2>
              <div className="detection-list">
                {currentDetections.map((detection, idx) => (
                  <div
                    key={detection.id}
                    className={`detection-item ${idx === selectedDetection ? 'selected' : ''}`}
                    onClick={() => setSelectedDetection(idx)}
                  >
                    <div className="detection-item-header">
                      <div className="detection-type-icon">
                        {getDetectionIcon(detection.type)}
                      </div>
                      <div className="detection-item-info">
                        <span className="detection-method">{detection.method}</span>
                        <span className="detection-time">{detection.timestamp}</span>
                      </div>
                    </div>
                    
                    <div className="detection-item-footer">
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

    {/* Image Zoom Modal - FIXED */}
      {zoomedImage && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setZoomedImage(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button 
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0px',
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '30px',
                fontWeight: 'bold',
                cursor: 'pointer',
                padding: '5px',
                lineHeight: 1
              }}
              onClick={() => setZoomedImage(null)}
            >
              ×
            </button>
            <img 
              src={zoomedImage} 
              alt="Zoomed Detection" 
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DroneRescueDashboard;