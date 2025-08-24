# 🛰️ Multi-Drone Distributed Search & Rescue System

A distributed system where 3 drones work together to search for humans across a shared world, with real-time coordination and admin monitoring.

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Drone D1      │    │   Drone D2      │    │   Drone D3      │
│  (Laptop 1)     │    │  (Laptop 2)     │    │  (Laptop 3)     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │    Multi-Drone Server     │
                    │      (Laptop 4)           │
                    │                           │
                    │ • WebSocket Hub           │
                    │ • Position Coordination   │
                    │ • Human Detection Logic   │
                    │ • Region Management       │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │    Admin Dashboard        │
                    │      (Laptop 4)           │
                    │                           │
                    │ • Real-time Monitoring    │
                    │ • World Map View          │
                    │ • Drone Status Tracking   │
                    │ • Human Discovery Log     │
                    └───────────────────────────┘
```

## 🚀 Quick Start

### 1. Start the Server (Laptop 4 - Admin)

```bash
cd Drone-UI
python multi_drone_server.py
```

The server will start on `ws://0.0.0.0:8765` and be accessible from all laptops on the LAN.

### 2. Start Drone Clients (Laptops 1, 2, 3)

For each drone, open the client with specific parameters:

**Drone D1 (Bottom Left Region):**
```
http://localhost:3000/multi_drone_client.html?drone_id=D1&server=192.168.1.100
```

**Drone D2 (Bottom Right Region):**
```
http://localhost:3000/multi_drone_client.html?drone_id=D2&server=192.168.1.100
```

**Drone D3 (Top Region):**
```
http://localhost:3000/multi_drone_client.html?drone_id=D3&server=192.168.1.100
```

Replace `192.168.1.100` with the actual IP address of the server laptop.

### 3. Open Admin Dashboard (Laptop 4)

```
http://localhost:3000/admin_dashboard.html?server=localhost
```

## 📡 Communication Protocol

### Client → Server Messages

**Registration:**
```json
{
  "type": "register",
  "drone_id": "D1",
  "client_type": "drone"
}
```

**Position Update:**
```json
{
  "type": "pos",
  "drone_id": "D1",
  "pos": [x, y, z]
}
```

### Server → Client Messages

**Initialization:**
```json
{
  "type": "init",
  "drone_id": "D1",
  "region": {
    "x_from": -200,
    "x_to": 0,
    "z_from": -200,
    "z_to": 0
  },
  "humans": [
    {
      "id": "D1_human_1",
      "name": "Human_1",
      "position": [x, y, z],
      "region": "D1",
      "found": false
    }
  ],
  "world_size": 400
}
```

**Position Broadcast:**
```json
{
  "type": "positions",
  "drones": {
    "D1": [x1, y1, z1],
    "D2": [x2, y2, z2],
    "D3": [x3, y3, z3]
  },
  "timestamp": "2024-01-01T12:00:00"
}
```

**Human Detection:**
```json
{
  "type": "humans_detected",
  "humans": [
    {
      "id": "D1_human_1",
      "name": "Human_1",
      "position": [x, y, z],
      "region": "D1",
      "found": true
    }
  ]
}
```

## 🎯 Features

### ✅ Implemented
- **Distributed Coordination**: 3 drones working independently in assigned regions
- **Real-time Position Sharing**: All drones see each other's positions
- **Human Detection**: Automatic detection when drones are within 50 units of humans
- **Admin Monitoring**: Real-time dashboard showing all drones and humans
- **Region Assignment**: Automatic region assignment to prevent overlap
- **WebSocket Communication**: Robust networking over LAN
- **Visual Feedback**: Humans change color when found (red → white)

### 🔄 In Progress
- **Pathfinding**: Intelligent search patterns within regions
- **Region Boundaries**: Drones stay within assigned regions
- **Mission Completion**: Automatic detection when all humans are found
- **Performance Optimization**: Efficient rendering for multiple drones

## 🛠️ Technical Details

### Server (multi_drone_server.py)
- **WebSocket Server**: Handles multiple concurrent connections
- **Position Management**: Tracks all drone positions in real-time
- **Human Detection**: Calculates FOV-based human detection
- **Region Management**: Assigns and manages drone regions
- **State Broadcasting**: Sends updates to all connected clients

### Client (multi_drone_client.js)
- **WebSocket Client**: Connects to server and maintains connection
- **Region Awareness**: Only spawns humans in assigned region
- **Position Reporting**: Sends position updates every 100ms
- **Visual Rendering**: Shows other drones and found humans
- **Terrain Integration**: Works with existing terrain system

### Admin Dashboard (admin_dashboard.html)
- **Real-time Map**: Visual representation of world and all entities
- **Status Monitoring**: Live status of all drones and humans
- **Statistics**: Count of active drones and found humans
- **Responsive Design**: Works on different screen sizes

## 🔧 Configuration

### Environment Variables
- `DRONE_ID`: Which drone this client represents (D1, D2, D3)
- `SERVER_IP`: IP address of the server laptop
- `CLIENT_TYPE`: Type of client (drone or admin)

### Network Requirements
- All laptops must be on the same LAN/WiFi network
- Server must be accessible on port 8765
- Firewall must allow WebSocket connections

### Performance Considerations
- Position updates sent every 100ms
- Human detection radius: 50 units
- World size: 400x400 units
- Maximum concurrent connections: 10
