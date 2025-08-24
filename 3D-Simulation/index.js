import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.7.3/+esm';
import SimplexNoise from 'https://cdn.skypack.dev/simplex-noise@3.0.0';
import { Howl } from 'https://cdn.jsdelivr.net/npm/howler@2.2.3/+esm';
import { getGPUTier } from 'https://cdn.jsdelivr.net/npm/detect-gpu@5.0.17/+esm';

// Multi-drone configuration
const DRONE_ID = new URLSearchParams(window.location.search).get('drone_id') || 'D1';
const SERVER_IP = new URLSearchParams(window.location.search).get('server') || 'localhost';
const CLIENT_TYPE = new URLSearchParams(window.location.search).get('type') || 'drone';

const container = document.querySelector('.container');
const canvas = document.querySelector('.canvas');

// Multi-drone variables
let websocket;
let droneId = DRONE_ID;
let clientType = CLIENT_TYPE;
let otherDrones = {}; // Store other drone positions
let myRegion = null;
let myHumans = []; // Humans in my assigned region
let worldSize = 800; // Increased to match server
// NEW: Variables for rendering other drones
let otherDroneModels = {};      // Stores the THREE.Object3D models of other drones
let otherDroneTemplate = null;  // A pre-loaded model to clone for efficiency
const OTHER_DRONE_RENDER_DISTANCE = 250; // How close a drone must be to be rendered

// Removed FOV visualization - not needed

// Original variables
let allTargets = [];
let targetStatus = []; // Stores human detection status for each target
let currentTargetIndex = 0;
let isMoving = false;
let movementSpeed = 0.3;
let rotationSpeed = 0.003;
let lastSentIndex = -1;
let menNeedingHeightUpdate = [];

// Manual control variables
let isManualMode = false;
let manualControls = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    rotateLeft: false,
    rotateRight: false
};
let manualSpeed = 0.5;
let manualRotationSpeed = 0.02;

// Add these variables
let closestMenPositions = [];
let menObjects = new Array(5).fill(null);

// right next to your model types:
const humanModelTypes = ["image", "thermal", "audio"];
const humanNames      = ["Alice", "Bob", "Charlie"];

// ✅ ADD THIS NEW CONSTANT
const HUMAN_LOCATIONS = [
  [85, 45],   // Coordinates for Alice [x, z]
  [-40, 110], // Coordinates for Bob [x, z]
  [60, 150]   // Coordinates for Charlie [x, z]
];


// Add these variables to the existing declarations
let manGeometry, manMaterial, menInstances, menPositions = [];

// Add after setTerrainValues() function
const getTerrainHeightAt = (x, z) => {
  const noise1 = (simplex.noise2D(x * 0.015, z * 0.015) + 1.3) * 0.3;
  const noise2 = (simplex.noise2D(x * 0.015, z * 0.015) + 1) * 0.75;
  const height = Math.pow(noise1, 1.2) * Math.pow(noise2, 1.2) * maxHeight;
  return Math.max(height, sandHeight);
};

// Global function to update connection status (accessible from HTML)
window.updateConnectionStatus = (connected) => {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        if (connected) {
            statusElement.textContent = '🟢 Connected';
            statusElement.className = 'status-online';
        } else {
            statusElement.textContent = '🔴 Disconnected';
            statusElement.className = '';
        }
    }
};

// Removed FOV visualization functions - not needed

// Manual control functions
const toggleManualMode = () => {
    isManualMode = !isManualMode;
    console.log(`🎮 Manual mode: ${isManualMode ? 'ON' : 'OFF'}`);

    // Update UI
    const modeElement = document.getElementById('control-mode');
    if (modeElement) {
        modeElement.textContent = isManualMode ? '🎮 Manual' : '🤖 Auto';
        modeElement.style.backgroundColor = isManualMode ? 'rgba(255, 193, 7, 0.8)' : 'rgba(76, 175, 80, 0.8)';
    }

    // Stop autonomous movement if switching to manual
    if (isManualMode) {
        isMoving = false;
        currentTargetIndex = 0;
    }

    // Removed FOV visualization toggle
};

const handleManualMovement = () => {
    if (!isManualMode) return;

    let moved = false;
    const direction = new THREE.Vector3();

    // Forward/Backward
    if (manualControls.forward) {
        direction.z -= 1;
        moved = true;
    }
    if (manualControls.backward) {
        direction.z += 1;
        moved = true;
    }

    // Left/Right
    if (manualControls.left) {
        direction.x -= 1;
        moved = true;
    }
    if (manualControls.right) {
        direction.x += 1;
        moved = true;
    }

    // Up/Down
    if (manualControls.up) {
        direction.y += 1;
        moved = true;
    }
    if (manualControls.down) {
        direction.y -= 1;
        moved = true;
    }

    // Apply movement
    if (moved) {
        direction.normalize();
        direction.multiplyScalar(manualSpeed);

        // Apply to drone position (character is the drone)
        character.position.add(direction);

        // Enforce region boundary in manual mode too
        if (myRegion) {
            enforceRegionBoundary();
        }

        // Update height based on terrain
        const terrainHeight = getTerrainHeightAt(character.position.x, character.position.z);
        character.position.y = Math.max(character.position.y, terrainHeight + 40);

        // Send position to server
        sendMultiDronePosition();
    }

    // Rotation
    if (manualControls.rotateLeft) {
        character.rotation.y += manualRotationSpeed;
        sendMultiDronePosition();
    }
    if (manualControls.rotateRight) {
        character.rotation.y -= manualRotationSpeed;
        sendMultiDronePosition();
    }
};

// Keyboard event handlers
const handleKeyDown = (event) => {
    if (!isManualMode) return;

    switch (event.code) {
        case 'KeyW': manualControls.forward = true; break;
        case 'KeyS': manualControls.backward = true; break;
        case 'KeyA': manualControls.left = true; break;
        case 'KeyD': manualControls.right = true; break;
        case 'KeyQ': manualControls.up = true; break;
        case 'KeyE': manualControls.down = true; break;
        case 'ArrowLeft': manualControls.rotateLeft = true; break;
        case 'ArrowRight': manualControls.rotateRight = true; break;
    }
};

const handleKeyUp = (event) => {
    if (!isManualMode) return;

    switch (event.code) {
        case 'KeyW': manualControls.forward = false; break;
        case 'KeyS': manualControls.backward = false; break;
        case 'KeyA': manualControls.left = false; break;
        case 'KeyD': manualControls.right = false; break;
        case 'KeyQ': manualControls.up = false; break;
        case 'KeyE': manualControls.down = false; break;
        case 'ArrowLeft': manualControls.rotateLeft = false; break;
        case 'ArrowRight': manualControls.rotateRight = false; break;
    }
};

// Initialize WebSocket connection for multi-drone
const initializeMultiDroneWebSocket = () => {
    const wsUrl = `ws://${SERVER_IP}:8765`;
    websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
        console.log(`🔗 Connected to server as ${clientType} ${droneId}`);

        // Update connection status
        if (typeof updateConnectionStatus === 'function') {
            updateConnectionStatus(true);
        }

        // Register with server
        websocket.send(JSON.stringify({
            type: "register",
            drone_id: droneId,
            client_type: clientType
        }));
    };

    websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
    };

    websocket.onclose = () => {
        console.log("❌ WebSocket connection closed");

        // Update connection status
        if (typeof updateConnectionStatus === 'function') {
            updateConnectionStatus(false);
        }

        // Reconnect after 3 seconds
        setTimeout(initializeMultiDroneWebSocket, 3000);
    };

    websocket.onerror = (error) => {
        console.error("❌ WebSocket error:", error);

        // Update connection status
        if (typeof updateConnectionStatus === 'function') {
            updateConnectionStatus(false);
        }
    };
};

const handleServerMessage = (data) => {
    switch (data.type) {
        case "init":
            // Server sent initial configuration
            myRegion = data.region;
            myHumans = data.humans;
            worldSize = data.world_size;
            console.log(`🎯 Assigned region:`, myRegion);
            console.log(`👥 My humans:`, myHumans);

            // Initialize humans in my region
            initializeMyHumans();
            break;

        case "positions":
            // Update other drone positions
            otherDrones = data.drones;
            updateOtherDronesDisplay();
            break;

        case "humans_detected":
            // Server found humans in my FOV
            console.log("🎯 Humans detected:", data.humans);
            handleHumansDetected(data.humans);
            break;

        case "world_state":
            // Admin received complete world state
            if (clientType === "admin") {
                updateAdminDisplay(data);
            }
            break;
    }
};

const initializeMyHumans = () => {
    // Clear existing humans
    menPositions = [];
    menObjects = [];

    // Add humans from my region
    myHumans.forEach((human, index) => {
        const pos = {
            x: human.position[0],
            z: human.position[2],
            y: getTerrainHeightAt(human.position[0], human.position[2]) + 25,
            loaded: false,
            id: human.id,
            name: human.name
        };
        menPositions.push(pos);
        menObjects.push(null);
    });

    console.log(`👥 Initialized ${menPositions.length} humans in my region`);

    // Spawn humans in the world after getting them from server
    spawnMen();
};

const updateOtherDronesDisplay = () => {
    if (!character || !otherDroneTemplate) return; // Exit if main drone or template isn't ready

    const receivedDroneIds = new Set(Object.keys(otherDrones));
    const myPosition = character.position;

    // 1. REMOVAL PASS: Check for drones that are no longer in the data or are too far away
    for (const id in otherDroneModels) {
        let shouldRemove = false;

        // Reason 1: The drone disconnected (its ID is no longer being sent)
        if (!receivedDroneIds.has(id)) {
            shouldRemove = true;
            console.log(`🛰️ Drone ${id} disconnected. Removing model.`);
        } else {
            // Reason 2: The drone is now too far away to be rendered
            const otherDronePosition = otherDroneModels[id].position;
            if (myPosition.distanceTo(otherDronePosition) > OTHER_DRONE_RENDER_DISTANCE) {
                shouldRemove = true;
                console.log(`🛰️ Drone ${id} is now too far. Removing model.`);
            }
        }

        if (shouldRemove) {
            scene.remove(otherDroneModels[id]);
            // Optional: Properly dispose of geometry and material if needed for memory management
            // otherDroneModels[id].traverse(obj => { if(obj.isMesh) { obj.geometry.dispose(); obj.material.dispose(); }});
            delete otherDroneModels[id];
        }
    }

    // 2. UPDATE AND CREATION PASS: Iterate through fresh data from the server
    for (const id in otherDrones) {
        // Skip rendering our own drone
        if (id === droneId) continue;

        const pos = otherDrones[id];
        const newPositionVec = new THREE.Vector3(pos[0], pos[1], pos[2]);

        // Check if this drone is close enough to be rendered
        if (myPosition.distanceTo(newPositionVec) <= OTHER_DRONE_RENDER_DISTANCE) {

            if (otherDroneModels[id]) {
                // UPDATE: The drone already exists, so just update its position smoothly
                otherDroneModels[id].position.lerp(newPositionVec, 0.1); // Use lerp for smooth movement

            } else {
                // CREATE: The drone is new and close enough, so create a model for it
                console.log(`🛰️ Drone ${id} is close. Rendering model.`);
                const newDrone = otherDroneTemplate.clone();
                newDrone.position.copy(newPositionVec);

                scene.add(newDrone);
                otherDroneModels[id] = newDrone;
            }
        }
    }
};

const handleHumansDetected = (humans) => {
    humans.forEach(human => {
        console.log(`🎯 Found human: ${human.name} at [${human.position[0]}, ${human.position[2]}]`);
        // Change color of found human
        const index = menPositions.findIndex(pos => pos.id === human.id);
        if (index !== -1 && menObjects[index]) {
            changeHumanColor(human.name);
        }
    });
};

const updateAdminDisplay = (worldState) => {
    // Admin interface updates
    console.log("👁️ Admin: Received world state update");
    console.log("🛰️ Drones:", worldState.drones);
    console.log("👥 Humans:", worldState.humans);
};

// Check if position is within assigned region
const isWithinRegion = (position) => {
    if (!myRegion) return true; // Allow movement if no region assigned

    const x = position.x;
    const z = position.z;

    return (x >= myRegion.x_from && x <= myRegion.x_to &&
            z >= myRegion.z_from && z <= myRegion.z_to);
};

// Enforce region boundaries
const enforceRegionBoundary = () => {
    if (!character || !myRegion) return;

    const pos = character.position;
    let needsUpdate = false;

    // Check X boundaries
    if (pos.x < myRegion.x_from) {
        pos.x = myRegion.x_from;
        needsUpdate = true;
    } else if (pos.x > myRegion.x_to) {
        pos.x = myRegion.x_to;
        needsUpdate = true;
    }

    // Check Z boundaries
    if (pos.z < myRegion.z_from) {
        pos.z = myRegion.z_from;
        needsUpdate = true;
    } else if (pos.z > myRegion.z_to) {
        pos.z = myRegion.z_to;
        needsUpdate = true;
    }

    if (needsUpdate) {
        console.log(`🚫 Drone ${droneId} hit region boundary, position corrected`);
    }
};

// Modified position sending for multi-drone
const sendMultiDronePosition = () => {
    if (websocket && websocket.readyState === WebSocket.OPEN && character) {
        // Enforce region boundaries before sending position
        enforceRegionBoundary();

        const pos = [
            character.position.x,
            character.position.y,
            character.position.z
        ];

        websocket.send(JSON.stringify({
            type: "pos",
            drone_id: droneId,
            pos: pos
        }));
    }
};

const sendWebSocketMessage = (status, modelType, targetName, latitude, longitude) => {
  if (websocket.readyState === WebSocket.OPEN) {
    const payload = { status, modelType, name: targetName };
    console.log("📡 Sending WS:", payload);
    websocket.send(JSON.stringify(payload));

    if (status === "Human Detected") {
      changeHumanColor(targetName);

      const emailSubject = "SOS Alert: Human Found at Coordinates";
      const emailBody = `
       <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SOS Alert: Human Found at Coordinates</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background-color: #ff0000;
            color: #ffffff;
            padding: 20px;
            text-align: center;
        }
        .content {
            padding: 20px;
            color: #333333;
        }
        .button {
            display: inline-block;
            padding: 10px 20px;
            background-color: #007BFF;
            color: #ffffff;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 10px;
        }
        .footer {
            background-color: #f1f1f1;
            padding: 10px;
            text-align: center;
            font-size: 12px;
            color: #666666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>SOS Alert: Human Found at Coordinates</h2>
        </div>
        <div class="content">
            <p>Dear [Recipient's Name],</p>
            <p>We have found a human in need of immediate assistance at the following coordinates:</p>
            <p><strong>Latitude:</strong> {{latitude}}</p>
            <p><strong>Longitude:</strong> {{longitude}}</p>
            <p>Please send help as soon as possible. You can view the location on Google Maps by clicking the button below:</p>
            <p><a href="https://www.google.com/maps?q={{latitude}},{{longitude}}" class="button">View Location on Google Maps</a></p>
            <p>Thank you for your prompt attention to this urgent matter.</p>
            <p>Best regards,</p>
            <p>[Your Name]</p>
            <p>[Your Contact Information]</p>
        </div>
        <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
`;

      sendEmail('prakharjain2004@gmail.com', emailSubject, latitude, longitude)
        .then(success => {
          if (!success) {
            console.warn("⚠️ Email notification could not be sent");
          }
        });
    }
  } else {
    console.warn("⚠️ WS not ready. Retrying…");
    setTimeout(() => sendWebSocketMessage(status, modelType, targetName, latitude, longitude), 1000);
  }
};
const changeHumanColor = (targetName) => {
  // Find the index of the human model by name
  const index = humanNames.indexOf(targetName);
  if (index !== -1 && menObjects[index]) {
    // Traverse the model and change the color of all meshes to yellow
    menObjects[index].traverse(child => {
      if (child.isMesh) {
        child.material.color.set(0xFFFFFF); // Yellow color
      }
    });
    console.log(`🎨 Changed color of ${targetName} to black.`);
  }
};


const loadManModel = async (position, index) => {
  try {
    const loader = new OBJLoader();
    const model = await loader.loadAsync('assets/man/man.obj');

    model.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // Ensure correct scaling
        child.geometry.computeBoundingBox();
        const size = child.geometry.boundingBox.getSize(new THREE.Vector3());
        const scaleFactor = 2 / 6; // Adjust as needed
        child.scale.set(scaleFactor, scaleFactor, scaleFactor);

        // Apply red color to material
        child.material = new THREE.MeshStandardMaterial({
          color: 0xff0000, // Red color
          metalness: 0.3,
          roughness: 0.7
        });
      }
    });

    // Apply scaling to the whole model
    // model.scale.set(1/6, 1/6, 1/6);

    model.position.copy(position);
    scene.add(model);
    menObjects[index] = model;

    console.log(`✅ Man model loaded at index ${index} with red color and correct scaling.`);
  } catch (error) {
    console.error('❌ Failed to load man model:', error);
  }
};

// Removed collision avoidance - drones can now get close to humans

// Generate random position within region (no collision avoidance)
const generateSafeRandomPosition = () => {
  if (!myRegion) return null;

  const x = Math.random() * (myRegion.x_to - myRegion.x_from) + myRegion.x_from;
  const z = Math.random() * (myRegion.z_to - myRegion.z_from) + myRegion.z_from;
  const y = getTerrainHeightAt(x, z) + 40; // Safe height above terrain

  return new THREE.Vector3(x, y, z);
};


// Modified position generation
const generateInitialMenPositions = () => {
  const positions = [];
  for (let i = 0; i < 10; i++) {
    const angle    = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * 200;
    const x        = Math.cos(angle) * distance;
    const z        = Math.abs(Math.sin(angle) * distance);
    // sample the terrain height and then add +25

    const groundY  = getTerrainHeightAt(x, z);
    positions.push({
      x,
      z,
      y: groundY + 25,
      loaded: false
    });
  }
  return positions;
};

// Find closest 3 based on X/Z only
const findClosestMen = () => {
  const charPos = new THREE.Vector3(0, 0, 0);

  closestMenPositions = menPositions
    .filter(pos => pos && !isNaN(pos.x) && !isNaN(pos.z))
    .map(pos => ({
      ...pos,
      distance: Math.sqrt(
        Math.pow(pos.x - charPos.x, 2) +
        Math.pow(pos.z - charPos.z, 2)
      )
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  console.log('Identified closest positions:', closestMenPositions);
};


// ✅ REPLACE the old spawnMen function with this new one
const spawnMen = () => {
  // Check if we're in multi-drone mode
  if (myHumans && myHumans.length > 0) {
    // Multi-drone mode: use humans from server
    console.log('✅ Multi-drone mode: Spawning humans from server assignment');
    closestMenPositions = myHumans.map(human => {
      const x = human.position[0];
      const z = human.position[2];
      const groundY = getTerrainHeightAt(x, z);

      return {
        x,
        z,
        y: groundY + 25,
        loaded: false,
        id: human.id,
        name: human.name
      };
    });
  } else {
    // Single drone mode: use the fixed locations
    closestMenPositions = HUMAN_LOCATIONS.map(coords => {
      const x = coords[0];
      const z = coords[1];
      const groundY = getTerrainHeightAt(x, z);

      return {
        x,
        z,
        y: groundY + 25,
        loaded: false
      };
    });
  }

  console.log('✅ Spawning men:');
  closestMenPositions.forEach((pos, i) => {
    console.log(`${i + 1}. ${pos.name || 'Human'}: X: ${pos.x.toFixed(1)}, Z: ${pos.z.toFixed(1)}`);
  });
};


const getGroundYAt = (x, z) => {
  // Create a ray that starts high above the point and points straight down
  const rayOrigin = new THREE.Vector3(x, 100, z); // Start from y=100
  const rayDirection = new THREE.Vector3(0, -1, 0);
  raycaster.set(rayOrigin, rayDirection);

  // Check for intersections with all terrain tile meshes
  const intersects = raycaster.intersectObjects(terrainTiles.map(el => el.hex));

  if (intersects.length > 0) {
    // If we hit something, return the Y-coordinate of the first intersection point
    return intersects[0].point.y;
  }

  // If we hit nothing (terrain not loaded yet), return null
  return null;
};

const updateMenHeights = () => {
  closestMenPositions.forEach((pos, index) => {
    // Stop if this man's model has already been loaded
    if (!pos || pos.loaded) return;

    // Use our new reliable function to check for ground
    const groundY = getGroundYAt(pos.x, pos.z);

    // If groundY is not null, it means the terrain has loaded at this spot
    if (groundY !== null) {
      // Update the position data with the correct height + a small offset
      pos.y = groundY + 0.5; // Place him 0.5 units above the ground

      // Now, load the 3D model at the final, correct position
      loadManModel(new THREE.Vector3(pos.x, pos.y, pos.z), index);

      // Mark this position as loaded so we don't do this again
      pos.loaded = true;
    }
  });
};


// Add new variables for navigation
let isNavigating = false;
let navigationTimeout = null;

const moveToPosition = (target) => {
  if (!target || typeof target.x !== 'number' || typeof target.z !== 'number') {
    console.error('Invalid target position:', target);
    return;
  }

  const tempHeight = 50;
  const direction = new THREE.Vector3(
    target.x - character.position.x,
    0,
    target.z - character.position.z
  ).normalize();

  const interval = setInterval(() => {
    if (!character?.position) {
      clearInterval(interval);
      return;
    }

    const targetY = target.y > 0 ? target.y + 10 : tempHeight;
    const dx = target.x - character.position.x;
    const dz = target.z - character.position.z;
    const distance = Math.sqrt(dx*dx + dz*dz);

    if (distance < 5) {
      clearInterval(interval);
      currentTargetIndex++;
      setTimeout(navigateToNextTarget, 2000);
      return;
    }

    character.position.x += direction.x * 0.5;
    character.position.z += direction.z * 0.5;
    character.position.y += (targetY - character.position.y) * 0.05;
  }, 16);
};

// Function to navigate to closest men
const navigateToClosestMen = () => {
  if (closestMenPositions.length === 0) return;

  isNavigating = true;
  currentTargetIndex = 0;
  navigateToNextTarget();
};
// Function to handle navigation to each target
const navigateToNextTarget = () => {
  if (!isNavigating || currentTargetIndex >= closestMenPositions.length) {
    isNavigating = false;
    currentTargetIndex = 0;
    return;
  }

  const target = closestMenPositions[currentTargetIndex];
  moveToPosition(target);
};
// ✅ WebSocket Connection (Legacy - only for single drone mode)
const connectWebSocket = () => {
    // Only connect if we're not in multi-drone mode
    if (DRONE_ID === 'D1' && SERVER_IP === 'localhost') {
        websocket = new WebSocket('ws://localhost:8765/');

        websocket.onopen = () => {
            console.log("✅ WebSocket connected!");
        };

        websocket.onerror = (error) => {
            console.error("❌ WebSocket error:", error);
        };

        websocket.onclose = () => {
            console.log("⚠️ WebSocket closed. Reconnecting...");
            setTimeout(connectWebSocket, 3000);
        };
    }
};

// ✅ Send WebSocket Message

// ✅ Connect WebSocket on page load (only for single drone mode)
connectWebSocket();


let
gpuTier,
sizes,
scene,
camera,
camY,
camZ,
renderer,
clock,
raycaster,
distance,
flyingIn,
clouds,
movingCharDueToDistance,
movingCharTimeout,
currentPos,
currentLookAt,
lookAtPosZ,
thirdPerson,
doubleSpeed,
character,
charPosYIncrement,
charRotateYIncrement,
charRotateYMax,
mixer,
charAnimation,
gliding,
charAnimationTimeout,
charNeck,
charBody,
gltfLoader,
grassMeshes,
treeMeshes,
centerTile,
tileWidth,
amountOfHexInTile,
simplex,
maxHeight,
snowHeight,
lightSnowHeight,
rockHeight,
forestHeight,
lightForestHeight,
grassHeight,
sandHeight,
shallowWaterHeight,
waterHeight,
deepWaterHeight,
textures,
terrainTiles,
activeTile,
activeKeysPressed,
bgMusic,
muteBgMusic,
infoModalDisplayed,
loadingDismissed,
simulationStarted = false,
coordsDisplay;

const setScene = async () => {

  gpuTier = await getGPUTier();
  console.log(gpuTier.tier);

  sizes = {
    width:  container.offsetWidth,
    height: container.offsetHeight
  };

  scene             = new THREE.Scene();
  scene.background  = new THREE.Color(0xf5e6d3);

  flyingIn  = true;
  camY      = 160,
  camZ      = -190;
  camera    = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 1, 300);
  camera.position.set(0, camY, camZ);

  renderer = new THREE.WebGLRenderer({
    canvas:     canvas,
    antialias:  false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;
  clock = new THREE.Clock();

  scene.add(new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5));

  gltfLoader = new GLTFLoader();

  activeKeysPressed   = [];
  muteBgMusic         = true;
  infoModalDisplayed  = false;

  joystick();
  setFog();
  setRaycast();
  setTerrainValues();
  await setClouds();
  await setCharacter();
  await loadOtherDroneTemplate();
  // await loadManModel();
  // spawnMen(); // Moved to after WebSocket connection
  await setGrass();
  await setTrees();
  setCam();
  createTile();
  createSurroundingTiles(`{"x":${centerTile.xFrom},"y":${centerTile.yFrom}}`);
  calcCharPos();
  resize();
  listenTo();
  render();
  coordsDisplay = document.getElementById('coords-display');

  // Initialize multi-drone WebSocket if parameters are present
  if (DRONE_ID !== 'D1' || SERVER_IP !== 'localhost') {
    console.log(`🚀 Initializing multi-drone mode for ${droneId}`);
    initializeMultiDroneWebSocket();

    // Start position sending loop for multi-drone
    setInterval(sendMultiDronePosition, 100);
  } else {
    // Single drone mode: spawn humans immediately
    spawnMen();
  }

  // Removed FOV visualization creation


  pauseIconAnimation();
  checkLoadingPage();

}

const joystick = () => {

  const calcJoystickDir = (deg) => {

    activeKeysPressed = [];

    if(deg < 22.5 || deg >= 337.5) activeKeysPressed.push(39); // right
    if(deg >= 22.5 && deg < 67.5) {
      activeKeysPressed.push(38);
      activeKeysPressed.push(39);
    } // up right
    if(deg >= 67.5 && deg < 112.5) activeKeysPressed.push(38); // up
    if(deg >= 112.5 && deg < 157.5) {
      activeKeysPressed.push(38);
      activeKeysPressed.push(37);
    } // up left
    if(deg >= 157.5 && deg < 202.5) activeKeysPressed.push(37); // left
    if(deg >= 202.5 && deg < 247.5) {
      activeKeysPressed.push(40);
      activeKeysPressed.push(37);
    } // down left
    if(deg >= 247.5 && deg < 292.5) activeKeysPressed.push(40); // down
    if(deg >= 292.5 && deg < 337.5) {
      activeKeysPressed.push(40);
      activeKeysPressed.push(39);
    } // down right

  }

  const joystickOptions = {
    zone: document.getElementById('zone-joystick'),
    shape: 'circle',
    color: '#ffffff6b',
    mode: 'dynamic'
  };

  const manager = nipplejs.create(joystickOptions);

  manager.on('move', (e, data) => calcJoystickDir(data.angle.degree));
  manager.on('end', () => (activeKeysPressed = []));

};

const setFog = () => {

  THREE.ShaderChunk.fog_pars_vertex += `
    #ifdef USE_FOG
      varying vec3 vWorldPosition;
    #endif `
  ;

  THREE.ShaderChunk.fog_vertex += `
    #ifdef USE_FOG
      vec4 worldPosition = projectionMatrix * modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
    #endif`
  ;

  THREE.ShaderChunk.fog_pars_fragment += `
    #ifdef USE_FOG
      varying vec3 vWorldPosition;
      float fogHeight = 10.0;
    #endif`
  ;

  const FOG_APPLIED_LINE = 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );';
  THREE.ShaderChunk.fog_fragment = THREE.ShaderChunk.fog_fragment.replace(FOG_APPLIED_LINE, `
    float heightStep = smoothstep(fogHeight, 0.0, vWorldPosition.y);
    float fogFactorHeight = smoothstep( fogNear * 0.7, fogFar, vFogDepth );
    float fogFactorMergeHeight = fogFactorHeight * heightStep;
    
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactorMergeHeight );
    ${FOG_APPLIED_LINE}`
  );

  const near =
    gpuTier.tier === 1
      ? 70
      : gpuTier.tier === 2
      ? 70
      : gpuTier.tier === 3
      ? 70
      : 70
  const far =
    gpuTier.tier === 1
      ? 90
      : gpuTier.tier === 2
      ? 90
      : gpuTier.tier === 3
      ? 90
      : 90

  scene.fog = new THREE.Fog(0xf5e6d3, near, far);

}

const setRaycast = () => {

  THREE.BufferGeometry.prototype.computeBoundsTree  = computeBoundsTree;
  THREE.BufferGeometry.prototype.disposeBoundsTree  = disposeBoundsTree;
  THREE.Mesh.prototype.raycast                      = acceleratedRaycast;

  raycaster = new THREE.Raycaster();
  distance  = 14;
  movingCharDueToDistance = false;
  raycaster.firstHitOnly = true;

}

const setTerrainValues = () => {

  const centerTileFromTo =
    gpuTier.tier === 1
      ? 20
      : gpuTier.tier === 2
      ? 20
      : gpuTier.tier === 3
      ? 20
      : 20

  centerTile = {
    xFrom:  -centerTileFromTo,
    xTo:    centerTileFromTo,
    yFrom:  -centerTileFromTo,
    yTo:    centerTileFromTo
  };
  tileWidth             = centerTileFromTo * 2; // diff between xFrom - xTo (not accounting for 0)
  amountOfHexInTile     = Math.pow((centerTile.xTo + 1) - centerTile.xFrom, 2); // +1 accounts for 0
  simplex               = new SimplexNoise("mahakumbh");
  maxHeight             = 30;
  snowHeight            = maxHeight * 0.9;
  lightSnowHeight       = maxHeight * 0.8;
  rockHeight            = maxHeight * 0.7;
  forestHeight          = maxHeight * 0.45;
  lightForestHeight     = maxHeight * 0.32;
  grassHeight           = maxHeight * 0.22;
  sandHeight            = maxHeight * 0.15;
  shallowWaterHeight    = maxHeight * 0.1;
  waterHeight           = maxHeight * 0.05;
  deepWaterHeight       = maxHeight * 0;
  textures              = {
    snow:         new THREE.Color(0xE5E5E5),
    lightSnow:    new THREE.Color(0x73918F),
    rock:         new THREE.Color(0x2A2D10),
    forest:       new THREE.Color(0x224005),
    lightForest:  new THREE.Color(0x367308),
    grass:        new THREE.Color(0x98BF06),
    sand:         new THREE.Color(0xE3F272),
    shallowWater: new THREE.Color(0x3EA9BF),
    water:        new THREE.Color(0x00738B),
    deepWater:    new THREE.Color(0x015373)
  };
  terrainTiles      = [];

}

const setClouds = async () => {

  clouds                = []
  const amountOfClouds  = 10;

  const createClouds = async () => {

    const cloudModels     = [];
    const cloudModelPaths = [
      'assets/clouds/cloud-one/scene.gltf',
      'assets/clouds/cloud-two/scene.gltf'
    ];

    for(let i = 0; i < cloudModelPaths.length; i++)
      cloudModels[i] = await gltfLoader.loadAsync(cloudModelPaths[i]);

    return cloudModels;

  }

  const getRandom = (max, min) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  const cloudModels = await createClouds();

  for(let i = 0; i < Math.floor(amountOfClouds / 2) * 2; i++) {

    let cloud;

    if(i < Math.floor(amountOfClouds / 2)) { // cloud-one
      cloud = cloudModels[0].scene.clone();
      cloud.scale.set(5.5, 5.5, 5.5);
      cloud.rotation.y = cloud.rotation.z = -(Math.PI / 2);
    }
    else { // cloud-two
      cloud = cloudModels[1].scene.clone();
      cloud.scale.set(0.02, 0.02, 0.02);
      cloud.rotation.y = cloud.rotation.z = 0;
    }

    cloud.name = `cloud-${i}`;
    cloud.position.set(
      getRandom(-20, 20),
      getRandom(camY - 90, camY - 110),
      getRandom(camZ + 200, camZ + 320)
    );

    scene.add(cloud);
    clouds.push(cloud);

  }

  return;

}

const animateClouds = () => {

  for(let i = 0; i < clouds.length; i++)
    clouds[i].position.x =
    clouds[i].position.x < 0
      ? clouds[i].position.x - (clock.getElapsedTime() * 0.04)
      : clouds[i].position.x + (clock.getElapsedTime() * 0.04);

}

const cleanUpClouds = () => {

  flyingIn = false;
  playMusic();

  for(let i = 0; i < clouds.length; i++) {
    const cloud = scene.getObjectByProperty('name', `cloud-${i}`);
    cleanUp(cloud);
  }

  clouds = undefined;

}

const setCharAnimation = () => {

  const
  min = 3,
  max = 14;

  if(charAnimationTimeout) clearTimeout(charAnimationTimeout);

  const interval = () => {

    if(!gliding)
      charAnimation
        .reset()
        .setEffectiveTimeScale(doubleSpeed ? 2 : 1)
        .setEffectiveWeight(1)
        .setLoop(THREE.LoopRepeat)
        .fadeIn(1)
        .play();
    else charAnimation.fadeOut(2);
    gliding = !gliding;

    const randomTime      = Math.floor(Math.random() * (max - min + 1) + min);
    charAnimationTimeout  = setTimeout(interval, randomTime * 1000);

  }

  interval();

}

const setCharacter = async () => {
  const model = await gltfLoader.loadAsync('assets/bird/scene.gltf');
  character = model.scene;

  // Adjust scale and position
  character.scale.set(3, 3, 3);
  character.position.set(0, 40, 0);

  // Set up propeller animation
  mixer = new THREE.AnimationMixer(character);
  charAnimation = mixer.clipAction(model.animations[0]);
  charAnimation.play();

  // Update node references based on your GLTF structure
  charBody = character.getObjectByName('helicopter_box_0');
  charNeck = character.getObjectByName('Plane_0');

  // Enable shadows
  character.traverse(child => {
    if(child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  // In setCharacter()
  charPosYIncrement = 0;
  charRotateYIncrement = 0;
  charRotateYMax = 0.03; // Faster rotation for drone
  scene.add(character);
};

// NEW: Function to pre-load the drone model for cloning
const loadOtherDroneTemplate = async () => {
  try {
    const model = await gltfLoader.loadAsync('assets/bird/scene.gltf');
    otherDroneTemplate = model.scene;
    otherDroneTemplate.scale.set(3, 3, 3); // Match the main drone's scale

    // Make the other drones a different color (e.g., blue) to distinguish them
    otherDroneTemplate.traverse(child => {
      if (child.isMesh) {
        // Clone the material so we don't change the original character's material
        const newMaterial = child.material.clone();
        newMaterial.color.set(0x007bff); // A nice blue color
        child.material = newMaterial;
      }
    });

    console.log('✅ Other drone template loaded successfully.');
  } catch (error) {
    console.error('❌ Failed to load other drone template:', error);
  }
};
const setGrass = async () => {

  grassMeshes           = {};
  const model           = await gltfLoader.loadAsync('assets/grass/scene.gltf');
  const grassMeshNames  = [
    {
      varName:  'grassMeshOne',
      meshName: 'Circle015_Grass_0'
    },
    {
      varName:  'grassMeshTwo',
      meshName: 'Circle018_Grass_0'
    }
  ];

  for(let i = 0; i < grassMeshNames.length; i++) {
    const mesh  = model.scene.getObjectByName(grassMeshNames[i].meshName);
    const geo   = mesh.geometry.clone();
    const mat   = mesh.material.clone();
    grassMeshes[grassMeshNames[i].varName] = new THREE.InstancedMesh(geo, mat, Math.floor(amountOfHexInTile / 40));
  }

  return;

}

const setTrees = async () => {

  treeMeshes          = {};
  const treeMeshNames = [
    {
      varName:    'treeMeshOne',
      modelPath:  'assets/trees/pine/scene.gltf',
      meshName:   'Object_4'
    },
    {
      varName:    'treeMeshTwo',
      modelPath:  'assets/trees/twisted-branches/scene.gltf',
      meshName:   'Tree_winding_01_Material_0'
    }
  ];

  for(let i = 0; i < treeMeshNames.length; i++) {
    const model  = await gltfLoader.loadAsync(treeMeshNames[i].modelPath);
    const mesh  = model.scene.getObjectByName(treeMeshNames[i].meshName);
    const geo   = mesh.geometry.clone();
    const mat   = mesh.material.clone();
    treeMeshes[treeMeshNames[i].varName] = new THREE.InstancedMesh(geo, mat, Math.floor(amountOfHexInTile / 45));
  }

  return;

}

const setCam = () => {

  currentPos    = new THREE.Vector3();
  currentLookAt = new THREE.Vector3();
  lookAtPosZ    = 15;
  thirdPerson   = true;
  doubleSpeed   = false;

}

const createSurroundingTiles = (newActiveTile) => {

  const setCenterTile = (parsedCoords) => {
    centerTile = {
      xFrom:  parsedCoords.x,
      xTo:    parsedCoords.x + tileWidth,
      yFrom:  parsedCoords.y,
      yTo:    parsedCoords.y + tileWidth
    }
  }

  const parsedCoords = JSON.parse(newActiveTile);

  setCenterTile(parsedCoords);

  tileYNegative();

  tileXPositive();

  tileYPositive();
  tileYPositive();

  tileXNegative();
  tileXNegative();

  tileYNegative();
  tileYNegative();

  setCenterTile(parsedCoords);

  cleanUpTiles();

  activeTile = newActiveTile;

}

const tileYNegative = () => {

  centerTile.yFrom -= tileWidth;
  centerTile.yTo -= tileWidth;
  createTile();

}

emailjs.init('RSRW9vSDMuUhuvsBC');

// Modified sendEmail function using EmailJS
const sendEmail = async (to, subject, latitude, longitude) => {
  try {
    console.log('📧 Attempting to send email to ${to} with subject: ${subject}');

    // Define the template parameters
    const templateParams = {
      to_email: to,
      latitude: latitude,
      longitude: longitude,
    };

    // Send the email using EmailJS
    const response = await emailjs.send('service_nypllv7', 'template_c7sts0c', templateParams);

    if (response.status === 200) {
      console.log('✅ Email sent successfully', response);
      return true;
    } else {
      console.error('❌ Failed to send email:', response);
      return false;
    }
  } catch (error) {
    console.error('❌ Exception while sending email:', error);
    return false;
  }
};
const tileYPositive = () => {

  centerTile.yFrom += tileWidth;
  centerTile.yTo += tileWidth;
  createTile();

}

const tileXNegative = () => {

  centerTile.xFrom -= tileWidth;
  centerTile.xTo -= tileWidth;
  createTile();

}

const tileXPositive = () => {

  centerTile.xFrom += tileWidth;
  centerTile.xTo += tileWidth;
  createTile();

}

const createTile = () => {

  const tileName = JSON.stringify({
    x: centerTile.xFrom,
    y: centerTile.yFrom
  });

  if(terrainTiles.some(el => el.name === tileName)) return; // Returns if tile already exists

  const tileToPosition = (tileX, height, tileY) => {
    return new THREE.Vector3((tileX + (tileY % 2) * 0.5) * 1.68, height / 2, tileY * 1.535);
  }

  const setHexMesh = (geo) => {

    const mat   = new THREE.MeshStandardMaterial();
    const mesh  = new THREE.InstancedMesh(geo, mat, amountOfHexInTile);

    mesh.castShadow     = true;
    mesh.receiveShadow  = true;

    return mesh;

  }

  const hexManipulator      = new THREE.Object3D();
  const grassManipulator    = new THREE.Object3D();
  const treeOneManipulator  = new THREE.Object3D();
  const treeTwoManipulator  = new THREE.Object3D();

  const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);
  const hex = setHexMesh(geo);
  hex.name  = tileName;
  geo.computeBoundsTree();

  const grassOne  = grassMeshes.grassMeshOne.clone();
  grassOne.name   = tileName;
  const grassTwo  = grassMeshes.grassMeshTwo.clone();
  grassTwo.name   = tileName;

  const treeOne = treeMeshes.treeMeshOne.clone();
  treeOne.name  = tileName;
  const treeTwo = treeMeshes.treeMeshTwo.clone();
  treeTwo.name  = tileName;

  terrainTiles.push({
    name:   tileName,
    hex:    hex,
    grass:  [
      grassOne.clone(),
      grassTwo.clone(),
    ],
    trees:  [
      treeOne.clone(),
      treeTwo.clone(),
    ]
  });

  let hexCounter      = 0;
  let grassOneCounter = 0;
  let grassTwoCounter = 0;
  let treeOneCounter  = 0;
  let treeTwoCounter  = 0;

  for(let i = centerTile.xFrom; i <= centerTile.xTo; i++) {
    for(let j = centerTile.yFrom; j <= centerTile.yTo; j++) {

      let noise1     = (simplex.noise2D(i * 0.015, j * 0.015) + 1.3) * 0.3;
      noise1         = Math.pow(noise1, 1.2);
      let noise2     = (simplex.noise2D(i * 0.015, j * 0.015) + 1) * 0.75;
      noise2         = Math.pow(noise2, 1.2);
      const height   = noise1 * noise2 * maxHeight;

      hexManipulator.scale.y = height >= sandHeight ? height : sandHeight;

      const pos = tileToPosition(i, height >= sandHeight ? height : sandHeight, j);
      hexManipulator.position.set(pos.x, pos.y, pos.z);

      hexManipulator.updateMatrix();
      hex.setMatrixAt(hexCounter, hexManipulator.matrix);

      if(height > snowHeight)               hex.setColorAt(hexCounter, textures.snow);
      else if(height > lightSnowHeight)     hex.setColorAt(hexCounter, textures.lightSnow);
      else if(height > rockHeight)          hex.setColorAt(hexCounter, textures.rock);
      else if(height > forestHeight) {

        hex.setColorAt(hexCounter, textures.forest);
        treeTwoManipulator.scale.set(1.1, 1.2, 1.1);
        treeTwoManipulator.rotation.y = Math.floor(Math.random() * 3);
        treeTwoManipulator.position.set(pos.x, (pos.y * 2) + 5, pos.z);
        treeTwoManipulator.updateMatrix();

        if((Math.floor(Math.random() * 15)) === 0) {
          treeTwo.setMatrixAt(treeTwoCounter, treeTwoManipulator.matrix);
          treeTwoCounter++;
        }

      }
      else if(height > lightForestHeight) {

        hex.setColorAt(hexCounter, textures.lightForest);

        treeOneManipulator.scale.set(0.4, 0.4, 0.4);
        treeOneManipulator.position.set(pos.x, (pos.y * 2), pos.z);
        treeOneManipulator.updateMatrix();

        if((Math.floor(Math.random() * 10)) === 0) {
          treeOne.setMatrixAt(treeOneCounter, treeOneManipulator.matrix);
          treeOneCounter++;
        }

      }
      else if(height > grassHeight) {

        hex.setColorAt(hexCounter, textures.grass);

        grassManipulator.scale.set(0.15, 0.15, 0.15);
        grassManipulator.rotation.x = -(Math.PI / 2);
        grassManipulator.position.set(pos.x, pos.y * 2, pos.z);
        grassManipulator.updateMatrix();

        if((Math.floor(Math.random() * 6)) === 0)
          switch (Math.floor(Math.random() * 2) + 1) {
            case 1:
              grassOne.setMatrixAt(grassOneCounter, grassManipulator.matrix);
              grassOneCounter++;
              break;
            case 2:
              grassTwo.setMatrixAt(grassTwoCounter, grassManipulator.matrix);
              grassTwoCounter++;
              break;
          }

      }
      else if(height > sandHeight)          hex.setColorAt(hexCounter, textures.sand);
      else if(height > shallowWaterHeight)  hex.setColorAt(hexCounter, textures.shallowWater);
      else if(height > waterHeight)         hex.setColorAt(hexCounter, textures.water);
      else if(height > deepWaterHeight)     hex.setColorAt(hexCounter, textures.deepWater);

      hexCounter++;

    }
  }

  scene.add(hex, grassOne, grassTwo, treeOne, treeTwo);

}

const cleanUpTiles = () => {

  for(let i = terrainTiles.length - 1; i >= 0; i--) {

    let tileCoords  = JSON.parse(terrainTiles[i].hex.name);
    tileCoords      = {
      xFrom:  tileCoords.x,
      xTo:    tileCoords.x + tileWidth,
      yFrom:  tileCoords.y,
      yTo:    tileCoords.y + tileWidth
    }

    if(
      tileCoords.xFrom < centerTile.xFrom - tileWidth * 2 || // 2x tileWidth
      tileCoords.xTo > centerTile.xTo + tileWidth * 2 ||
      tileCoords.yFrom < centerTile.yFrom - tileWidth * 2 ||
      tileCoords.yTo > centerTile.yTo + tileWidth * 2
    ) {

      const tile = scene.getObjectsByProperty('name', terrainTiles[i].hex.name);
      for(let o = 0; o < tile.length; o++) cleanUp(tile[o]);

      terrainTiles.splice(i, 1);

    }

  }

}

const resize = () => {

  sizes = {
    width:  container.offsetWidth,
    height: container.offsetHeight
  };

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);

}


const toggleDoubleSpeed = () => {

  if(flyingIn) return;

  doubleSpeed = doubleSpeed ? false : true;
  charRotateYMax = doubleSpeed ? 0.02 : 0.01;
  setCharAnimation();

}

const toggleBirdsEyeView = () => {

  if(flyingIn) return;
  thirdPerson = thirdPerson ? false : true;

}

const keyDown = (event) => {
  if (infoModalDisplayed) return;

  // Manual mode toggle with 'M' key
  if (event.keyCode === 77 || event.code === 'KeyM' || event.key === 'm' || event.key === 'M') {
    toggleManualMode();
    return;
  }

  // Removed FOV visualization toggle key

  if (event.keyCode === 84 && !simulationStarted) { // 84 is the keyCode for 't'
    simulationStarted = true;
    document.getElementById('start-message').style.display = 'none';
    console.log("🚀 Starting Automated Movement via 'T' key...");
    startAutomatedMovement();
    return; // Stop further processing for this key press
  }

  // Handle manual controls if in manual mode
  if (isManualMode) {
    handleKeyDown(event);
    return;
  }

  if (!activeKeysPressed.includes(event.keyCode)) {
    activeKeysPressed.push(event.keyCode);
  }

  if (event.keyCode === 71 && !isNavigating) { // 'G' key
    if (menNeedingHeightUpdate.length === 0) { // Only allow if all heights are set
      navigateToClosestMen();
    } else {
      console.log("Waiting for terrain to load before navigating...");
    }
  }
};

const keyUp = (event) => {
  // Handle manual controls if in manual mode
  if (isManualMode) {
    handleKeyUp(event);
    return;
  }

  const index = activeKeysPressed.indexOf(event.keyCode);
  if (index !== -1) {
    activeKeysPressed.splice(index, 1);
  }
};


const determineMovement = () => {

  if (flyingIn) return;

  // W and S for forward and backward movement
  if (activeKeysPressed.includes(87)) { // W key
    character.translateZ(0.4);
  }
  if (activeKeysPressed.includes(83)) { // S key
    character.translateZ(-0.4);
  }

  // Up arrow for moving up
  if (activeKeysPressed.includes(38)) { // Up arrow
    if (character.position.y < 90) {
      character.position.y += charPosYIncrement;
      if (charPosYIncrement < 0.3) charPosYIncrement += 0.02;
    }
  }

  // Down arrow for moving down, ensuring no collision
  if (activeKeysPressed.includes(40)) { // Down arrow
    if (character.position.y > 20) {
      character.position.y -= charPosYIncrement;
      if (charPosYIncrement < 0.3) charPosYIncrement += 0.02;
    }
  }

  // Auto-correct vertical movement to avoid floating
  if (!activeKeysPressed.includes(38) && !activeKeysPressed.includes(40)) {
    if (charPosYIncrement > 0) charPosYIncrement -= 0.02;
  }

  // Left and Right Arrow Keys for Rotation
  if (activeKeysPressed.includes(37)) { // Left arrow
    character.rotateY(charRotateYIncrement);
    if (charRotateYIncrement < charRotateYMax) charRotateYIncrement += 0.0005;
  }
  if (activeKeysPressed.includes(39)) { // Right arrow
    character.rotateY(-charRotateYIncrement);
    if (charRotateYIncrement < charRotateYMax) charRotateYIncrement += 0.0005;
  }

  // Revert Rotation
  if ((!activeKeysPressed.includes(37) && !activeKeysPressed.includes(39)) ||
      (activeKeysPressed.includes(37) && activeKeysPressed.includes(39))) {
    if (charRotateYIncrement > 0) charRotateYIncrement -= 0.0005;
  }
};



const camUpdate = () => {

  const calcIdealOffset = () => {
    const idealOffset = thirdPerson ? new THREE.Vector3(0, camY, camZ) : new THREE.Vector3(0, 3, 7);
    idealOffset.applyQuaternion(character.quaternion);
    idealOffset.add(character.position);
    return idealOffset;
  }

  const calcIdealLookat = () => {
    const idealLookat = thirdPerson ? new THREE.Vector3(0, -1.2, lookAtPosZ) : new THREE.Vector3(0, 0.5, lookAtPosZ + 5);
    idealLookat.applyQuaternion(character.quaternion);
    idealLookat.add(character.position);
    return idealLookat;
  }

  if(!activeKeysPressed.length) {
    if(character.position.y > 60 && lookAtPosZ > 5) lookAtPosZ -= 0.2;
    if(character.position.y <= 60 && lookAtPosZ < 15) lookAtPosZ += 0.2;
  }

  const idealOffset = calcIdealOffset();
  const idealLookat = calcIdealLookat();

  currentPos.copy(idealOffset);
  currentLookAt.copy(idealLookat);

  camera.position.lerp(currentPos, 0.14);
  camera.lookAt(currentLookAt);

  if(camY > 7)    camY -= 0.5;
  if(camZ < -10)  camZ += 0.5;
  else {
    if(flyingIn) {
      setCharAnimation();
      cleanUpClouds(); // This statement is called once when the fly in animation is compelte
    }
  }

}

const calcCharPos = () => {
  raycaster.set(character.position, new THREE.Vector3(0, -1, -0.1));
  const intersects = raycaster.intersectObjects(terrainTiles.map(el => el.hex));

  if(activeTile !== intersects[0].object.name) {
    createSurroundingTiles(intersects[0].object.name);
  }

  if (intersects[0].distance < distance) {
    movingCharDueToDistance = true;
    character.position.y += doubleSpeed ? 0.3 : 0.1;
  }
  else {
    if(movingCharDueToDistance && !movingCharTimeout) {
      movingCharTimeout = setTimeout(() => {
        movingCharDueToDistance = false;
        movingCharTimeout = undefined;
      }, 600);
    }
  }

  camUpdate();
  // Removed updateClosestMenDisplay() call since we only want initial positions
}

const listenTo = () => {

  window.addEventListener('resize', resize.bind(this));
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  // document.querySelector('.hex-music')
  //   .addEventListener('click', () => updateMusicVolume());
  // document.querySelector('.hex-info')
  //   .addEventListener('click', () => toggleInfoModal());
  // document.querySelector('.info-close')
  //   .addEventListener('click', () => toggleInfoModal(false));
  // document.querySelector('.hex-speed')
  //   .addEventListener('click', () => toggleDoubleSpeed());
  // document.querySelector('.hex-birds-eye')
  //   .addEventListener('click', () => toggleBirdsEyeView());

}

const cleanUp = (obj) => {

  if(isNavigating) {
    isNavigating = false;
    if(navigationTimeout) {
      clearTimeout(navigationTimeout);
      navigationTimeout = null;
    }
  }

  if(obj.geometry && obj.material) {
    obj.geometry.dispose();
    obj.material.dispose();
  }
  else {
    obj.traverse(el => {
      if(el.isMesh) {
        el.geometry.dispose();
        el.material.dispose();
      }
    });
  }

  if (obj === menInstances) {
    manGeometry.dispose();
    manMaterial.dispose();
  }

  scene.remove(obj);
  renderer.renderLists.dispose();

}

const render = () => {
  if(loadingDismissed) {
    // Handle manual movement if in manual mode
    if (isManualMode) {
      handleManualMovement();
    } else {
      determineMovement();
    }

    calcCharPos();
    if(flyingIn) animateClouds();
    if(mixer) mixer.update(clock.getDelta());

    updateMenHeights(); // Check for height updates
    if (character && coordsDisplay) {
      const { x, y, z } = character.position;
      coordsDisplay.innerHTML = `X: ${x.toFixed(1)}<br>Y: ${y.toFixed(1)}<br>Z: ${z.toFixed(1)}`;
    }

    // Removed FOV visualization update
  }
  renderer.render(scene, camera);
  requestAnimationFrame(render.bind(this));
};

const playMusic = () => {

  bgMusic = new Howl({
    src: ['assets/sound/bg-music.mp3'],
    autoplay: true,
    loop: true,
    volume: 0,
  });

  bgMusic.play();

}

const updateMusicVolume = () => {

  muteBgMusic = !muteBgMusic;
  bgMusic.volume(muteBgMusic ? 0 : 0.01);

  document.getElementById('sound').src =
    muteBgMusic ?
    'assets/icons/sound-off.svg' :
    'assets/icons/sound-on.svg'

};

const pauseIconAnimation = (pause = true) => {

  if(pause) {
    // document.querySelector('.hex-music').classList.add('js-loading');
    // document.querySelector('.hex-info').classList.add('js-loading');
    // document.querySelector('.hex-speed').classList.add('js-loading');
    // document.querySelector('.hex-birds-eye').classList.add('js-loading');
    return;
  }

  // document.querySelector('.hex-music').classList.remove('js-loading');
  // document.querySelector('.hex-info').classList.remove('js-loading');
  // document.querySelector('.hex-speed').classList.remove('js-loading');
  // document.querySelector('.hex-birds-eye').classList.remove('js-loading');

}

// const toggleInfoModal = (display = true) => {

//   infoModalDisplayed = display;

//   if(display) return gsap.timeline()
//     .to('.info-modal-page', {
//       zIndex: 100
//     })
//     .to('.info-modal-page', {
//       opacity:  1,
//       duration: 1
//     })
//     .to('.info-box', {
//       opacity:  1,
//       duration: 1
//     })

//   gsap.timeline()
//     .to('.info-box', {
//       opacity:  0,
//       duration: 0.5
//     })
//     .to('.info-modal-page', {
//       opacity:  0,
//       duration: 0.5
//     })
//     .to('.info-modal-page', {
//       zIndex: -1
//     })

// }

/**
 * Checks if a given point is outside a specified radius of all known human positions.
 * @param {THREE.Vector3} point The point to check.
 * @param {number} exclusionRadius The minimum safe distance from any human.
 * @returns {boolean} True if the point is safe, false otherwise.
 */

/**
 * Calculates the 2D distance between two points (Vector3 or similar object with x/z).
 * @param {{x: number, z: number}} p1 The first point.
 * @param {{x: number, z: number}} p2 The second point.
 * @returns {number} The 2D distance.
 */
const getDistance = (p1, p2) => {
  const dx = p1.x - p2.x;
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dz * dz);
};
const isSafeFromHumans = (point, exclusionRadius, humanToIgnore = null) => {
  for (const humanPos of closestMenPositions) {
    // ✅ NEW: Skip the check if this is the human we're deliberately leaving.
    if (humanPos === humanToIgnore) {
      continue;
    }

    // Calculate 2D distance (ignoring Y-axis)
    const dx = point.x - humanPos.x;
    const dz = point.z - humanPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < exclusionRadius) {
      // Point is inside the exclusion zone of a human
      console.log(`Path point rejected: Too close to human at (${humanPos.x.toFixed(1)}, ${humanPos.z.toFixed(1)})`);
      return false;
    }
  }
  // Point is a safe distance from all humans
  return true;
};
/**
 * Checks if the straight-line path between two points intersects any human's exclusion zone.
 * @param {{x: number, z: number}} startPoint The starting point of the path.
 * @param {{x: number, z: number}} endPoint The ending point of the path.
 * @param {number} exclusionRadius The radius of the zone to avoid.
 * @returns {boolean} True if the path is safe, false if it intersects a zone.
 */
const isPathSafe = (startPoint, endPoint, exclusionRadius, humanToIgnore = null) => {
  for (const human of closestMenPositions) {
    // ✅ NEW: Skip the check if this is the human we're deliberately leaving.
    if (human === humanToIgnore) {
        continue;
    }

    const humanPoint = { x: human.x, z: human.z };

    // ... (rest of the function is unchanged) ...
    const lineVec = { x: endPoint.x - startPoint.x, z: endPoint.z - startPoint.z };
    const humanVec = { x: startPoint.x - humanPoint.x, z: startPoint.z - humanPoint.z };

    const lineLenSq = lineVec.x * lineVec.x + lineVec.z * lineVec.z;
    if (lineLenSq === 0) return true;

    const dot = humanVec.x * lineVec.x + humanVec.z * lineVec.z;
    const t = Math.max(0, Math.min(1, -dot / lineLenSq));

    const closestPoint = {
      x: startPoint.x + t * lineVec.x,
      z: startPoint.z + t * lineVec.z,
    };

    if (getDistance(humanPoint, closestPoint) < exclusionRadius) {
      console.log(`Path REJECTED: Trajectory from (${startPoint.x.toFixed(1)}, ${startPoint.z.toFixed(1)}) to (${endPoint.x.toFixed(1)}, ${endPoint.z.toFixed(1)}) is too close to a human.`);
      return false;
    }
  }

  return true;
};
const isPointInRegion = (point) => {
    // If no region is assigned (single-player mode), always return true.
    if (!myRegion) {
        return true;
    }

    // Check if the point's coordinates are within the region's boundaries.
    return (
        point.x >= myRegion.x_from &&
        point.x <= myRegion.x_to &&
        point.z >= myRegion.z_from &&
        point.z <= myRegion.z_to
    );
};
// MODIFIED FUNCTION
// MODIFIED FUNCTION
// MODIFIED FUNCTION
/**
 * Generates waypoints between a start and end point that create a zig-zag search pattern,
 * ensuring all waypoints stay within the drone's assigned region.
 * @param {THREE.Vector3} startPos - The starting position for the segment.
 * @param {THREE.Vector3} humanPos - The end position (the human) for the segment.
 * @param {number} count - The number of dummy waypoints to generate.
 * @returns {THREE.Vector3[]} An array of generated waypoint vectors.
 */
function generateDummyWaypoints(startPos, humanPos, count = 2, humanToIgnore = null) {
    const waypoints = [];
    const exclusionRadius = 50;

    const direction = new THREE.Vector2(humanPos.x - startPos.x, humanPos.z - startPos.z).normalize();
    const perpendicular = new THREE.Vector2(-direction.y, direction.x);

    let lastWaypoint = startPos;

    for (let i = 1; i <= count; i++) {
        let safePoint;
        let isPointSafe = false;
        let isSegmentSafe = false;
        let attempts = 0;

        do {
            const t = i / (count + 1);
            const pointOnLine = new THREE.Vector3().lerpVectors(startPos, humanPos, t);
            const searchOffset = 40 + Math.random() * 30;
            const side = (i % 2 === 0) ? -1 : 1;

            let x = pointOnLine.x + perpendicular.x * searchOffset * side;
            let z = pointOnLine.z + perpendicular.y * searchOffset * side;

            if (myRegion) {
                x = THREE.MathUtils.clamp(x, myRegion.x_from, myRegion.x_to);
                z = THREE.MathUtils.clamp(z, myRegion.z_from, myRegion.z_to);
            }

            const y = getTerrainHeightAt(x, z) + 40;
            safePoint = new THREE.Vector3(x, y, z);

            // ✅ MODIFIED: Pass 'humanToIgnore' to the safety functions
            isPointSafe = isSafeFromHumans(safePoint, exclusionRadius, humanToIgnore);
            if (isPointSafe) {
                isSegmentSafe = isPathSafe(lastWaypoint, safePoint, exclusionRadius, humanToIgnore);
            } else {
                isSegmentSafe = false;
            }

            attempts++;
        } while ((!isPointSafe || !isSegmentSafe) && attempts < 25);

        if (isPointSafe && isSegmentSafe) {
            waypoints.push(safePoint);
            lastWaypoint = safePoint.clone();
        } else {
            console.warn(`Could not find a safe & valid search waypoint towards ${humanPos.x},${humanPos.z}. Path may be more direct.`);
        }
    }
    return waypoints;
}
// MODIFIED FUNCTION
// REPLACED FUNCTION - NEW DYNAMIC LOGIC
// REPLACED FUNCTION - FINAL VERSION
// REPLACED FUNCTION - FINAL VERSION
const generateFixedTargets = () => {
  console.log("🚀 Generating new dynamic and safe flight path...");

  // ... (the forEach loop for updating heights is unchanged) ...
  closestMenPositions.forEach(pos => {
    if (!pos.loaded) {
      const groundY = getGroundYAt(pos.x, pos.z);
      if (groundY !== null) pos.y = groundY + 0.5;
    }
  });

  allTargets = [];
  targetStatus = [];
  const exclusionRadius = 100;

  let currentPos = character.position.clone();

  // ... (the initial "warm-up" dummies loop is unchanged) ...
  const initialDummyCount = 3;
  // ...

  // 2️⃣ DYNAMICALLY BUILD REST OF PATH by finding the nearest neighbor at each step
  let remainingHumans = [...closestMenPositions];
  let lastHuman = null; // ✅ NEW: Variable to track the previously pathed human

  while (remainingHumans.length > 0) {
    remainingHumans.sort((a, b) => getDistance(currentPos, a) - getDistance(currentPos, b));
    const nextHuman = remainingHumans.shift();

    console.log(`Next closest target: ${nextHuman.name || 'Human'}. Generating safe path...`);
    const humanPos = new THREE.Vector3(nextHuman.x, nextHuman.y, nextHuman.z);

    // ✅ MODIFIED: Pass 'lastHuman' to be ignored by the safety checks
    const dummies = generateDummyWaypoints(currentPos, humanPos, 3, lastHuman);

    dummies.forEach(waypoint => {
      allTargets.push(waypoint);
      targetStatus.push({ detected: false, name: `Waypoint to ${nextHuman.name}` });
    });

    // ... (adding the human to the target list is unchanged) ...
    allTargets.push(humanPos);
    targetStatus.push({
      detected: true,
      modelType: humanModelTypes[closestMenPositions.indexOf(nextHuman) % humanModelTypes.length],
      name: humanNames[closestMenPositions.indexOf(nextHuman) % humanNames.length]
    });

    // Update the starting point for the next human search
    currentPos = humanPos.clone();
    lastHuman = nextHuman; // ✅ NEW: Remember this human for the next iteration
  }

  console.log(`✅ Safe path generation complete. Total targets: ${allTargets.length}`);
};
// ✅ Move drone from one target to another
// ✅ Move drone from one target to another
const moveToNextTarget = () => {
  if (currentTargetIndex >= allTargets.length) {
    console.log("✅ All closest men visited! Stopping movement.");
    isMoving = false;
    return;
  }

  let target = allTargets[currentTargetIndex];

  // Calculate direction but ignore Y-axis
  let direction = new THREE.Vector3(target.x - character.position.x, 0, target.z - character.position.z);
  direction.normalize();

  // 🚀 Move drone towards target (Only X and Z)
  character.position.x += direction.x * movementSpeed;
  character.position.z += direction.z * movementSpeed;

  // Enforce region boundaries after movement
  if (myRegion) {
    enforceRegionBoundary();
  }

  // 🔄 Rotate smoothly towards target
  let targetRotation = Math.atan2(direction.x, direction.z);
  character.rotation.y += (targetRotation - character.rotation.y) * rotationSpeed;

  // 🛑 Collision detection for maintaining safe altitude
  let rayOrigin = character.position.clone();
  let rayDirection = new THREE.Vector3(0, -1, 0); // Downward direction
  raycaster.set(rayOrigin, rayDirection);

  let intersections = raycaster.intersectObjects(terrainTiles.map(el => el.hex));
  if (intersections.length > 0) {
    let terrainHeight = intersections[0].point.y;
    let safeAltitude = terrainHeight + 10; // Ensure at least 10 units above the ground

    if (character.position.y < safeAltitude) {
      character.position.y += 0.2; // Smoothly increase height to avoid collision
    }
  }

  // 🛑 If close to target (only checking X and Z)
  let dx = Math.abs(character.position.x - target.x);
  let dz = Math.abs(character.position.z - target.z);
  let distance = Math.sqrt(dx * dx + dz * dz); // Ignore Y-axis

  if (distance < 3) {
    // --- Start of Corrected Block ---

    // Only send the WebSocket message ONCE when we first arrive.
    if (lastSentIndex !== currentTargetIndex) {
      const { detected, modelType, name } = targetStatus[currentTargetIndex];
      const message = detected ? "Human Detected" : "No human detected";
      sendWebSocketMessage(message, modelType, name);
      lastSentIndex = currentTargetIndex;
    }

    const { detected } = targetStatus[currentTargetIndex];

    if (detected) {
      // This is a human target, perform the animation.
      isMoving = false;

      const hoverHeight = target.y + 2;
      const cruiseHeight = hoverHeight + 10;
      const backDistance = 25;
      const backVec = direction.clone().negate().multiplyScalar(backDistance);

      gsap.timeline()
        .to(character.position, { duration: 1, x: `+=${backVec.x}`, z: `+=${backVec.z}`, ease: "power1.inOut" })
        .to(character.position, { duration: 1.2, y: hoverHeight, ease: "power1.out" })
        .to({}, { duration: 3 })
        .to(character.position, { duration: 1.2, y: cruiseHeight, ease: "power1.in" })
        .call(() => {
          currentTargetIndex++;
          isMoving = true;
          requestAnimationFrame(moveToNextTarget); // Relaunch the loop after animation.
        });

      return; // Exit this frame's execution.
    } else {
      // This is a dummy waypoint.
      currentTargetIndex++; // Move to the next target.
      // Manually schedule the next frame and then exit this one.
      // This creates the clean break needed for a sharp turn.
      requestAnimationFrame(moveToNextTarget);
      return;
    }
    // --- End of Corrected Block ---
  }

  if (isMoving) {
    requestAnimationFrame(moveToNextTarget);
  }
};

// ✅ Start automated movement
const startAutomatedMovement = () => {
  if (!character) {
      console.error("❌ Character model not loaded.");
      return;
  }

  generateFixedTargets(); // Ensure targets are updated
if (allTargets.length < 3) {
    console.error("Not enough human detection targets! Aborting movement.");
    return;
}

  currentTargetIndex = 0;
  isMoving = true;
  moveToNextTarget();
};

// ✅ Start movement after 2 seconds
// setTimeout(() => {
//   console.log("🚀 Starting Automated Movement...");
//   startAutomatedMovement();
// }, 2000);

const checkLoadingPage = () => {

  let loadingCounter  = 0;
  loadingDismissed    = false;

  const checkAssets = () => {

    let allAssetsLoaded = true;

    if(!scene)                                  allAssetsLoaded = false;
    if (!clouds || clouds.length < 5) allAssetsLoaded = false;
    if(!character)                              allAssetsLoaded = false;
    if(!Object.keys(grassMeshes).length === 2)  allAssetsLoaded = false;
    if(!Object.keys(treeMeshes).length === 2)   allAssetsLoaded = false;
    if(!activeTile)                             allAssetsLoaded = false;
    if(loadingCounter < 6)                      allAssetsLoaded = false;
    if(loadingCounter > 50)                     allAssetsLoaded = true;
    if(allAssetsLoaded)                         return dismissLoading();

    loadingCounter++;
    setTimeout(checkAssets, 500);

  }

  const dismissLoading = () => {

    gsap.timeline()
      .to('.loader-container', {
        opacity:  0,
        duration: 0.6
      })
      .to('.page-loader', {
        opacity:  0,
        duration: 0.6
      })
      .to('.page-loader', {
        display: 'none'
      })
      .then(() => {
        loadingDismissed = true;
        pauseIconAnimation(false);
      });

  }

  checkAssets();

}

setScene().catch(err => {
  console.error("❌ Error in setScene():", err);
});