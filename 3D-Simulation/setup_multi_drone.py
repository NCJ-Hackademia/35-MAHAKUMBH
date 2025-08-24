#!/usr/bin/env python3
"""
Multi-Drone System Setup Script
Helps configure and run the distributed search and rescue system
"""

import os
import sys
import socket
import subprocess
import webbrowser
import time
from pathlib import Path

def get_local_ip():
    """Get the local IP address for LAN communication"""
    try:
        # Connect to a remote address to determine local IP
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "localhost"

def check_dependencies():
    """Check if required Python packages are installed"""
    required_packages = ["websockets", "asyncio"]
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"❌ Missing packages: {', '.join(missing_packages)}")
        print("Install with: pip install websockets")
        return False
    
    return True

def start_server():
    """Start the multi-drone server"""
    print("🚀 Starting Multi-Drone Server...")
    
    server_script = Path(__file__).parent / "multi_drone_server.py"
    if not server_script.exists():
        print(f"❌ Server script not found: {server_script}")
        return False
    
    try:
        # Start server in background
        process = subprocess.Popen([
            sys.executable, str(server_script)
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        # Wait a moment for server to start
        time.sleep(2)
        
        if process.poll() is None:
            print("✅ Server started successfully")
            return process
        else:
            stdout, stderr = process.communicate()
            print(f"❌ Server failed to start: {stderr.decode()}")
            return False
            
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        return False

def open_admin_dashboard(local_ip):
    """Open the admin dashboard in browser"""
    admin_url = f"http://localhost:3000/admin_dashboard.html?server=localhost"
    print(f"👁️ Opening admin dashboard: {admin_url}")
    
    try:
        webbrowser.open(admin_url)
        return True
    except Exception as e:
        print(f"❌ Error opening admin dashboard: {e}")
        return False

def generate_client_urls(local_ip):
    """Generate URLs for drone clients"""
    base_url = f"http://localhost:3000/multi_drone_client.html"
    
    urls = {
        "D1": f"{base_url}?drone_id=D1&server={local_ip}",
        "D2": f"{base_url}?drone_id=D2&server={local_ip}",
        "D3": f"{base_url}?drone_id=D3&server={local_ip}"
    }
    
    return urls

def print_instructions(local_ip, client_urls):
    """Print setup instructions"""
    print("\n" + "="*60)
    print("🛰️ MULTI-DRONE SYSTEM SETUP COMPLETE")
    print("="*60)
    
    print(f"\n📍 Server IP: {local_ip}")
    print("🌐 WebSocket Port: 8765")
    
    print("\n📋 NEXT STEPS:")
    print("1. Start a local web server (if not already running):")
    print("   python -m http.server 3000")
    
    print("\n2. Open drone clients on different laptops:")
    for drone_id, url in client_urls.items():
        print(f"   {drone_id}: {url}")
    
    print(f"\n3. Admin dashboard: http://localhost:3000/admin_dashboard.html?server=localhost")
    
    print("\n🔧 TROUBLESHOOTING:")
    print("- Ensure all laptops are on the same WiFi network")
    print("- Check firewall settings allow port 8765")
    print("- Verify server IP is accessible from other laptops")
    
    print("\n📖 For detailed instructions, see: README_MULTI_DRONE.md")

def main():
    """Main setup function"""
    print("🛰️ Multi-Drone System Setup")
    print("="*40)
    
    # Check dependencies
    if not check_dependencies():
        return 1
    
    # Get local IP
    local_ip = get_local_ip()
    print(f"📍 Local IP: {local_ip}")
    
    # Start server
    server_process = start_server()
    if not server_process:
        return 1
    
    # Generate client URLs
    client_urls = generate_client_urls(local_ip)
    
    # Open admin dashboard
    open_admin_dashboard(local_ip)
    
    # Print instructions
    print_instructions(local_ip, client_urls)
    
    try:
        # Keep server running
        print("\n🔄 Server is running. Press Ctrl+C to stop.")
        server_process.wait()
    except KeyboardInterrupt:
        print("\n🛑 Stopping server...")
        server_process.terminate()
        server_process.wait()
        print("✅ Server stopped")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
