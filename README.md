<p align="center" style="background: rgba(0,0,0,0.6); border-radius: 10px; padding: 20px; padding-bottom: 0;">
  <img 
    src="https://github.com/NCJ-Hackademia/Assets/blob/main/Hackademia-Logo%20(1).png?raw=true" 
    alt="Hackademia Logo" 
    height="70"
  >
</p>

# Hackademia 2025 – MAHAKUMBH

Welcome to the official repository for **Hackademia 2025 – MAHAKUMBH**, part of the national-level hackathon hosted by **National College Jayanagar**.  

We’re committed to the hackathon values of **innovation, integrity, and collaboration** — no early commits before the official start, regular and transparent progress updates, and adherence to all rules and guidelines.  

---

## **Team Information**
- **Team Name:** MAHAKUMBH  
- **Team Captain (GitHub):** [@prakharjain1509](https://github.com/prakharjain1509)  
- **Repository Name:** 35-MAHAKUMBH  

---

## **Rules & Guidelines**
1. **No early commits** before official start time.  
2. **Commit regularly** to track progress.  
3. Follow all instructions from **event heads & judges**.  
4. **AI-generated code limit** → Code must be **less than 60% AI-generated**. Exceeding this limit will lead to disqualification.  

---

## **Hackathon Timeline**
- **23rd Aug 2025 – 8:00 PM** → First Checkpoint  
- **24th Aug 2025 – 7:00 AM** → Second Checkpoint  
- **24th Aug 2025 – 11:00 AM to 11:30 AM** → Final Submission  
- **24th Aug 2025 – Post Submission** → Presentations  

---

# 🛁 Autonomous Search and Rescue Drone System

[![Python Version](https://img.shields.io/badge/python-3.8%2B-blue)](https://www.python.org/downloads/)
[![PyBullet](https://img.shields.io/badge/simulation-PyBullet-red)](https://pybullet.org)
[![Stable Baselines3](https://img.shields.io/badge/RL-StableBaselines3-orange)](https://stable-baselines3.readthedocs.io/)

## 🗃️ Overview

This project implements an autonomous multi-drone system for search and rescue operations using reinforcement learning (RL). The system trains drone swarms to efficiently search areas, detect victims, and optimize rescue routes while maintaining stable flight patterns. The project consists of:

![Multi Drone Training](https://github.com/NCJ-Hackademia/35-MAHAKUMBH/blob/main/RL_TRAINING/assets/multi.png)

- A **real-time drone UI** for monitoring and controlling drones
- **Reinforcement learning** models to optimize drone search efficiency
- **Simulation-based training** with PyBullet for drone behavior learning
- **Autonomous victim detection** and rescue path optimization

## 🔍 Key Features

- **Autonomous Drone Operations**: Drones navigate and search independently
- **Multi-sensor Integration**: Uses position, IMU, and FOV data
- **Victim Detection & Rescue Planning**: AI-driven decision-making for optimal rescue routes
- **Real-time UI Dashboard**: Monitor drone behavior and RL training
- **Reinforcement Learning**: PPO-based training for optimized navigation

![RL Dashboard](https://github.com/NCJ-Hackademia/35-MAHAKUMBH/blob/main/RL_TRAINING/assets/frontend.png)

## 👩‍💻 System Components

### 1. **Drone UI**
A React and Vite-powered dashboard for real-time visualization and control.

### 2. **Backend (Drone-UI)**
A Python-based backend for processing drone input and managing communication.

### 3. **Reinforcement Learning Module (Drone-RL-Processing)**
Trains drones using PPO with PyBullet simulation.

---

## 🛠️ Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/NCJ-Hackademia/35-MAHAKUMBH.git
cd 35-MAHAKUMBH
```

### 2. Backend Setup (Drone-UI)
```bash
cd 3D-Simulation
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements_multi_drone.txt
python backend.py
```

### 3. Frontend Setup (Drone-Dashboard-Frontend)
```bash
cd ../Drone-Recognition-Dashboard
npm install
npm run dev
```
Navigate to `http://localhost:5173` to view the UI.

### 4. Running the Basic UI (Static Page)
To serve the Simulation UI:
```bash
cd ../3D-Simulation
python3 -m http.server 3000
python3 setup_multi_drone.py
```

---
![Basic UI](https://github.com/NCJ-Hackademia/35-MAHAKUMBH/blob/main/RL_TRAINING/assets/frontend_drone.png)

## 🚀 Running the RL Simulation

### 1. Setup the RL Environment
```bash
cd ../RL_TRAINING
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Start RL Training & Simulation
```bash
# Run the single drone simulation with FOV visualization
python singleDroneWithFOV.py

# Optimized single drone simulation
python singleDrone_final.py

# Multi-drone simulation
python fourDrones_final.py
```

### 3. Start RL Dashboard
```bash
cd RL_Training_FrontendReport
npm install
npm start
```
Navigate to `http://localhost:3000` to view training metrics.

---

## 📊 Performance Metrics

- **Search Efficiency**: Evaluates coverage per unit time
- **Victim Detection Rate**: Measures success in locating victims
- **Revisit Rate**: Tracks unnecessary redundant searches
- **Flight Stability**: Ensures stable drone movement during searches

## 💌 Email Notification System

Mission progress updates are automatically sent via email:
- Search coverage statistics
- Victim detection details
- Optimized rescue paths

---





