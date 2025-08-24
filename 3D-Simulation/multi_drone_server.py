import asyncio
import json
import websockets
from datetime import datetime
import random
import threading
from human_detection_email import HumanDetectionEmailer

class MultiDroneServer:
    def __init__(self):
        self.clients = {}  # drone_id -> websocket
        self.drone_positions = {}  # drone_id -> [x, y, z]
        self.drone_regions = {}  # drone_id -> region
        self.admin_clients = []  # List of admin spectator websockets
        
        # World configuration
        self.world_size = 800  # Increased world size for better exploration  # 400x400 world
        self.regions = {
            "D1": {"x_from": -400, "x_to": 0, "z_from": -400, "z_to": 0},      # Bottom-left
            "D2": {"x_from": 0, "x_to": 400, "z_from": -400, "z_to": 0},       # Bottom-right  
            "D3": {"x_from": -400, "x_to": 400, "z_from": 0, "z_to": 400}      # Top (spans full width)
        }
        
        # Generate 9 humans (3 per region)
        self.humans = self.generate_humans()
        
        # Initialize email system
        self.emailer = HumanDetectionEmailer()

    def generate_humans(self):
        humans = []
        min_distance = 150  # Minimum distance between any two humans in the same region

        for region_id, region in self.regions.items():
            region_humans = []
            for i in range(3):
                while True:
                    # Generate a potential position
                    x = random.uniform(region["x_from"] + 50, region["x_to"] - 50)
                    z = random.uniform(region["z_from"] + 50, region["z_to"] - 50)

                    # Check distance against other humans in this region
                    is_far_enough = True
                    for other_human in region_humans:
                        other_pos = other_human["position"]
                        dist = ((x - other_pos[0]) ** 2 + (z - other_pos[2]) ** 2) ** 0.5
                        if dist < min_distance:
                            is_far_enough = False
                            break

                    if is_far_enough:
                        # Position is valid, add the human and break the loop
                        new_human = {
                            "id": f"{region_id}_human_{i + 1}",
                            "name": f"Human_{len(humans) + 1}",
                            "position": [x, 0, z],
                            "region": region_id,
                            "found": False
                        }
                        region_humans.append(new_human)
                        humans.append(new_human)
                        break

        print(f"✅ Generated {len(humans)} humans (spaced apart):")
        for human in humans:
            print(
                f"   {human['name']} -> Region: {human['region']} - [{human['position'][0]:.1f}, {human['position'][2]:.1f}]")
        return humans
    async def register_client(self, websocket, path):
        """Handle new client connections"""
        try:
            # Wait for client to identify itself
            message = await websocket.recv()
            data = json.loads(message)
            
            if data.get("type") == "register":
                drone_id = data.get("drone_id")
                client_type = data.get("client_type", "drone")
                
                if client_type == "admin":
                    # Admin spectator
                    self.admin_clients.append(websocket)
                    print(f"👁️ Admin spectator connected")
                    
                    # Send initial world state
                    await self.send_world_state(websocket)
                    
                else:
                    # Drone client
                    if drone_id in self.clients:
                        await websocket.close(1008, "Drone ID already registered")
                        return
                    
                    self.clients[drone_id] = websocket
                    self.drone_positions[drone_id] = [0, 40, 0]  # Default starting position
                    
                    # Assign starting position based on region
                    if drone_id in self.regions:
                        region = self.regions[drone_id]
                        start_x = (region["x_from"] + region["x_to"]) / 2
                        start_z = (region["z_from"] + region["z_to"]) / 2
                        self.drone_positions[drone_id] = [start_x, 40, start_z]
                    
                    print(f"🛰️ Drone {drone_id} connected")
                    
                    # Get humans for this drone's region
                    drone_humans = [h for h in self.humans if h["region"] == drone_id]
                    print(f"🛰️ Drone {drone_id} assigned humans: {[h['name'] for h in drone_humans]}")
                    
                    # Send initial configuration
                    await websocket.send(json.dumps({
                        "type": "init",
                        "drone_id": drone_id,
                        "region": self.regions.get(drone_id, {}),
                        "humans": drone_humans,
                        "world_size": self.world_size
                    }))
                
                # Handle messages from this client
                await self.handle_client_messages(websocket, drone_id, client_type)
                
        except websockets.exceptions.ConnectionClosed:
            print(f"Client disconnected")
        except Exception as e:
            print(f"Error handling client: {e}")
        finally:
            await self.cleanup_client(websocket, drone_id if 'drone_id' in locals() else None, client_type if 'client_type' in locals() else None)
    
    async def handle_client_messages(self, websocket, drone_id, client_type):
        """Handle messages from connected clients"""
        try:
            async for message in websocket:
                data = json.loads(message)
                
                if client_type == "drone" and data.get("type") == "pos":
                    # Update drone position
                    self.drone_positions[drone_id] = data["pos"]
                    
                    # Check for humans in FOV
                    humans_found = self.check_humans_in_fov(drone_id, data["pos"])
                    
                    # Broadcast updated positions to all clients
                    await self.broadcast_positions()
                    
                    # Send human detection results back to the drone
                    if humans_found:
                        await websocket.send(json.dumps({
                            "type": "humans_detected",
                            "humans": humans_found
                        }))
                
                elif client_type == "admin" and data.get("type") == "request_update":
                    # Admin requesting current state
                    await self.send_world_state(websocket)
                    
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            print(f"Error handling message: {e}")
    
    def check_humans_in_fov(self, drone_id, drone_pos):
        """Check if any humans are within drone's field of view"""
        fov_radius = 50  # Detection radius (increased for better detection)
        humans_found = []
        
        for human in self.humans:
            if human["region"] == drone_id and not human["found"]:
                dx = human["position"][0] - drone_pos[0]
                dz = human["position"][2] - drone_pos[2]
                distance = (dx**2 + dz**2)**0.5
                
                if distance <= fov_radius:
                    human["found"] = True
                    humans_found.append(human)
                    
                    # Send email notification for human detection
                    self.send_human_detection_email(human, drone_id, drone_pos)
        
        return humans_found
    
    def send_human_detection_email(self, human, drone_id, drone_pos):
        """Send email notification for human detection"""
        try:
            detection_data = {
                'position': human['position'],
                'drone_id': drone_id,
                'timestamp': datetime.now().strftime('%H:%M:%S'),
                'method': self.emailer.get_random_detection_method()  # Randomize detection method
            }
            
            # Send email in a separate thread to avoid blocking
            def send_email_async():
                self.emailer.send_human_detection_email(detection_data)
            
            email_thread = threading.Thread(target=send_email_async)
            email_thread.daemon = True
            email_thread.start()
            
            print(f"📧 Email notification queued for {human['name']} detected by {drone_id}")
            
        except Exception as e:
            print(f"❌ Failed to send email notification: {str(e)}")
    
    async def broadcast_positions(self):
        """Broadcast all drone positions to all clients"""
        positions_message = {
            "type": "positions",
            "drones": self.drone_positions,
            "timestamp": datetime.now().isoformat()
        }
        
        # Send to all drone clients
        for client_ws in self.clients.values():
            try:
                await client_ws.send(json.dumps(positions_message))
            except:
                pass
        
        # Send to all admin clients
        for admin_ws in self.admin_clients:
            try:
                await admin_ws.send(json.dumps(positions_message))
            except:
                pass
    
    async def send_world_state(self, websocket):
        """Send complete world state to admin client"""
        world_state = {
            "type": "world_state",
            "drones": self.drone_positions,
            "humans": self.humans,
            "regions": self.regions,
            "world_size": self.world_size,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            await websocket.send(json.dumps(world_state))
        except:
            pass
    
    async def cleanup_client(self, websocket, drone_id, client_type):
        """Clean up when client disconnects"""
        if client_type == "admin":
            if websocket in self.admin_clients:
                self.admin_clients.remove(websocket)
            print("👁️ Admin spectator disconnected")
        elif drone_id:
            if drone_id in self.clients:
                del self.clients[drone_id]
            if drone_id in self.drone_positions:
                del self.drone_positions[drone_id]
            print(f"🛰️ Drone {drone_id} disconnected")

async def main():
    server = MultiDroneServer()
    
    # Create a wrapper function for the websockets library
    async def handler(websocket, path=None):
        await server.register_client(websocket, path)
    
    # Start WebSocket server
    start_server = websockets.serve(
        handler, 
        "0.0.0.0",  # Listen on all interfaces for LAN access
        8765
    )
    
    print("🚀 Multi-Drone Server starting...")
    print("📡 WebSocket server listening on ws://0.0.0.0:8765")
    print("🛰️ Available drone IDs: D1, D2, D3")
    print("👁️ Admin clients can connect with client_type: 'admin'")
    
    await start_server
    await asyncio.Future()  # Run forever

if __name__ == "__main__":
    asyncio.run(main())

