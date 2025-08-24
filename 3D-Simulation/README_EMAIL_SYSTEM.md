# 🚨 Human Detection Email Notification System

A beautiful, professional email notification system that sends stunning HTML emails every time a human is detected during search and rescue missions.

## ✨ Features

### 🎨 **Beautiful Design**
- **Professional HTML emails** with modern design
- **Gradient backgrounds** and smooth animations
- **Responsive layout** that works on all devices
- **Color-coded confidence levels** (High/Medium/Low)
- **Real-time mission statistics**

### 🔍 **Detection Methods**
- **Thermal Imaging** 🔥 - Heat signature detection (High confidence, 500m range)
- **Audio Detection** 🎵 - Sound analysis (Medium confidence, 200m range)  
- **Computer Vision** 👁️ - AI image recognition (High confidence, 300m range)

### 📊 **Rich Data**
- **Exact coordinates** (X, Y, Z)
- **Detection timestamp**
- **Drone ID** that made the detection
- **Mission statistics** (total detections, detection rate, duration)
- **Detection method details** (confidence, range, description)

### 📎 **Media Attachments**
- **Random media files** from test data folders
- **Thermal images** for thermal detections
- **Audio files** for audio detections
- **Visual images** for computer vision detections

## 🚀 Quick Start

### 1. **Test the Email System**
```bash
cd Drone-UI
python3 test_email_system.py
```

### 2. **Run the Multi-Drone Server** (with email notifications)
```bash
python3 multi_drone_server.py
```

### 3. **Connect Drone Clients**
- Open: `http://localhost:3000/multi_drone_client.html?drone_id=D1&server=localhost`
- Press 'T' to start mission
- When humans are detected, emails will be sent automatically

## 📧 Email Configuration

### **Gmail Setup**
```python
email_config = {
    'sender_email': 'your-email@gmail.com',
    'sender_password': 'your-app-password',  # Use Gmail App Password
    'recipient_email': 'recipient@example.com',
    'smtp_server': 'smtp.gmail.com',
    'smtp_port': 587,
    'use_tls': True
}
```

### **Gmail App Password Setup**
1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password: Google Account → Security → App Passwords
3. Use the generated password in the configuration

## 🎯 How It Works

### **Automatic Detection**
1. **Drone moves** around the search area
2. **Human detected** when drone gets within 50m radius
3. **Random detection method** selected (thermal/audio/visual)
4. **Email sent immediately** with beautiful HTML design
5. **Media file attached** based on detection method

### **Email Content**
- **Alert header** with pulsing animation
- **Detection method** with icon and description
- **Coordinates** in a highlighted box
- **Mission statistics** with real-time data
- **Professional footer** with system branding

## 📁 File Structure

```
Drone-UI/
├── human_detection_email.py      # Main email system
├── test_email_system.py          # Test script
├── multi_drone_server.py         # Server with email integration
├── Drone-Dashboard-Frontend/public/test_data/
│   ├── thermal/human/            # Thermal images
│   ├── audio/human/              # Audio files
│   └── image/human/              # Visual images
└── README_EMAIL_SYSTEM.md        # This file
```

## 🎨 Email Design Features

### **Visual Elements**
- **Gradient backgrounds** (red alert header, blue coordinates, green stats)
- **Card-based layout** with shadows and rounded corners
- **Animated pulse effect** on the header
- **Color-coded confidence levels**
- **Professional typography** and spacing

### **Data Display**
- **Grid layout** for detection details
- **Statistics dashboard** with mission metrics
- **Coordinate display** with monospace font
- **Timestamp information** throughout

## 🔧 Customization

### **Change Email Recipients**
Edit `human_detection_email.py`:
```python
self.email_config = {
    'recipient_email': 'new-recipient@example.com',
    # ... other config
}
```

### **Modify Detection Methods**
Add new detection methods in `human_detection_email.py`:
```python
self.detection_methods = {
    'new_method': {
        'name': 'New Detection System',
        'description': 'Description here',
        'icon': '🆕',
        'confidence': 'High',
        'range': 'Up to 400m',
        'media_folder': 'path/to/media'
    }
}
```

### **Customize Email Design**
Modify the HTML template in `create_beautiful_email_html()` method.

## 📊 Mission Statistics

The system tracks:
- **Total detections** across all methods
- **Detections by method** (thermal/audio/visual)
- **Mission duration** in hours and minutes
- **Detection rate** per hour
- **Real-time updates** in each email

## 🚨 Alert Levels

- **High Confidence** (Green) - Thermal, Visual
- **Medium Confidence** (Orange) - Audio
- **Low Confidence** (Red) - Not used currently

## 📱 Email Compatibility

- **Desktop email clients** (Outlook, Thunderbird, Apple Mail)
- **Mobile email apps** (Gmail, Outlook Mobile)
- **Web-based email** (Gmail, Yahoo, Outlook.com)
- **Responsive design** adapts to screen size

## 🔒 Security Features

- **TLS encryption** for email transmission
- **App password authentication** (no plain text passwords)
- **Thread-safe email sending** (non-blocking)
- **Error handling** for failed email attempts

## 📈 Performance

- **Asynchronous email sending** (doesn't block drone operations)
- **Thread-based processing** for email delivery
- **Minimal memory footprint**
- **Fast HTML generation**

---

**🎯 Ready to deploy!** The email system will automatically send beautiful notifications every time a human is detected during search and rescue missions.
