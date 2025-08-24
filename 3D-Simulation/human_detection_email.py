import smtplib
import random
import os
import time
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.mime.audio import MIMEAudio
from email.mime.base import MIMEBase
from email import encoders

class HumanDetectionEmailer:
    def __init__(self):
        self.email_config = {
            'sender_email': 'abhisheksaraff18@gmail.com',
            'sender_password': 'wwtx zfew vgzq odzx',  # For Gmail, use App Password
            'recipient_email': 'prakharjain.cd22@rvce.edu.in',
            'smtp_server': 'smtp.gmail.com',
            'smtp_port': 587,
            'use_tls': True
        }
        
        # Detection methods and their descriptions
        self.detection_methods = {
            'thermal': {
                'name': 'Thermal Imaging Camera',
                'description': 'Heat signature detection using thermal camera',
                'icon': '🔥',
                'confidence': 'High',
                'media_files': [
                    '../Drone-Recognition-Dashboard/thermal_detected_1.png',
                    '../Drone-Recognition-Dashboard/thermal_detected_2.png',
                    '../Drone-Recognition-Dashboard/thermal_detected_3.png',
                    '../Drone-Recognition-Dashboard/thermal_detected_4.png'
                ]
            },
            'audio': {
                'name': 'Audio Detection System',
                'description': 'Sound analysis using advanced audio processing',
                'icon': '🎵',
                'confidence': 'Medium',
                'media_files': [
                    'test_data/audio/human/PES University Road 5.m4a',
                    '../Drone-Recognition-Dashboard/shout-104972.mp3'
                ]
            },
            'visual': {
                'name': 'Image Detection System',
                'description': 'AI-powered image recognition',
                'icon': '👁️',
                'confidence': 'High',
                'media_file': '../Drone-Recognition-Dashboard/human_detected_1.png'
            }
        }
        
        # Mission statistics
        self.mission_stats = {
            'total_detections': 0,
            'detections_by_method': {'thermal': 0, 'audio': 0, 'visual': 0},
            'mission_start_time': datetime.now(),
            'last_detection_time': None
        }

    def get_random_detection_method(self):
        """Get a random detection method"""
        return random.choice(list(self.detection_methods.keys()))

    def get_media_file(self, method):
        """Get the specific media file for the detection method"""
        method_info = self.detection_methods[method]
        
        # Get the current script directory
        script_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Check if it's a list of files (for thermal and audio)
        if 'media_files' in method_info:
            relative_path = random.choice(method_info['media_files'])
        else:
            # Single file (for visual)
            relative_path = method_info['media_file']
        
        # Convert relative path to absolute path
        absolute_path = os.path.abspath(os.path.join(script_dir, relative_path))
        return absolute_path

    def create_beautiful_email_html(self, detection_data):
        """Create a beautiful, professional HTML email"""
        
        method_info = self.detection_methods[detection_data['method']]
        
        html_content = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Human Detection Alert</title>
            <style>
                * {{
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }}
                
                body {{
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #2c3e50;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 20px;
                    min-height: 100vh;
                }}
                
                .email-container {{
                    max-width: 800px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                }}
                
                .header {{
                    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                    color: white;
                    padding: 40px 30px;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                }}
                
                .header::before {{
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
                    animation: pulse 3s infinite;
                }}
                
                @keyframes pulse {{
                    0% {{ transform: scale(1); opacity: 0.5; }}
                    50% {{ transform: scale(1.1); opacity: 0.3; }}
                    100% {{ transform: scale(1); opacity: 0.5; }}
                }}
                
                .header h1 {{
                    font-size: 2.5em;
                    margin-bottom: 10px;
                    position: relative;
                    z-index: 1;
                }}
                
                .header p {{
                    font-size: 1.2em;
                    opacity: 0.9;
                    position: relative;
                    z-index: 1;
                }}
                
                .alert-badge {{
                    background: #f39c12;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 0.9em;
                    font-weight: bold;
                    display: inline-block;
                    margin-top: 10px;
                    position: relative;
                    z-index: 1;
                }}
                
                .content {{
                    padding: 40px 30px;
                }}
                
                .detection-card {{
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    border-radius: 15px;
                    padding: 30px;
                    margin: 20px 0;
                    border-left: 5px solid #e74c3c;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                }}
                
                .detection-method {{
                    display: flex;
                    align-items: center;
                    margin-bottom: 20px;
                }}
                
                .method-icon {{
                    font-size: 2.5em;
                    margin-right: 15px;
                }}
                
                .method-info h3 {{
                    color: #2c3e50;
                    font-size: 1.4em;
                    margin-bottom: 5px;
                }}
                
                .method-info p {{
                    color: #7f8c8d;
                    font-size: 1em;
                }}
                
                .detection-details {{
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin: 25px 0;
                }}
                
                .detail-item {{
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.1);
                    text-align: center;
                }}
                
                .detail-item h4 {{
                    color: #34495e;
                    margin-bottom: 10px;
                    font-size: 1.1em;
                }}
                
                .detail-item p {{
                    color: #e74c3c;
                    font-weight: bold;
                    font-size: 1.2em;
                }}
                
                .coordinates {{
                    background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                    color: white;
                    padding: 25px;
                    border-radius: 15px;
                    text-align: center;
                    margin: 20px 0;
                }}
                
                .coordinates h3 {{
                    margin-bottom: 10px;
                    font-size: 1.3em;
                }}
                
                .coordinates p {{
                    font-size: 1.5em;
                    font-weight: bold;
                    font-family: 'Courier New', monospace;
                }}
                
                .mission-stats {{
                    background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
                    color: white;
                    padding: 25px;
                    border-radius: 15px;
                    margin: 20px 0;
                }}
                
                .mission-stats h3 {{
                    margin-bottom: 15px;
                    font-size: 1.3em;
                }}
                
                .stats-grid {{
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 15px;
                }}
                
                .stat-item {{
                    text-align: center;
                    padding: 15px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 10px;
                }}
                
                .stat-item h4 {{
                    font-size: 0.9em;
                    margin-bottom: 5px;
                    opacity: 0.9;
                }}
                
                .stat-item p {{
                    font-size: 1.2em;
                    font-weight: bold;
                }}
                
                .footer {{
                    background: #34495e;
                    color: white;
                    padding: 30px;
                    text-align: center;
                }}
                
                .footer p {{
                    margin-bottom: 10px;
                }}
                
                .footer .timestamp {{
                    font-size: 0.9em;
                    opacity: 0.8;
                }}
                
                .confidence-high {{
                    color: #27ae60;
                }}
                
                .confidence-medium {{
                    color: #f39c12;
                }}
                
                .confidence-low {{
                    color: #e74c3c;
                }}
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <h1>🚨 HUMAN DETECTED</h1>
                    <p>Search and Rescue Mission Alert</p>
                    <div class="alert-badge">URGENT - IMMEDIATE ACTION REQUIRED</div>
                </div>
                
                <div class="content">
                    <div class="detection-card">
                        <div class="detection-method">
                            <div class="method-icon">{method_info['icon']}</div>
                            <div class="method-info">
                                <h3>{method_info['name']}</h3>
                                <p>{method_info['description']}</p>
                            </div>
                        </div>
                        
                        <div class="detection-details">
                            <div class="detail-item">
                                <h4>Detection Confidence</h4>
                                <p class="confidence-{method_info['confidence'].lower()}">{method_info['confidence']}</p>
                            </div>
                            <div class="detail-item">
                                <h4>Detection Time</h4>
                                <p>{detection_data['timestamp']}</p>
                            </div>
                            <div class="detail-item">
                                <h4>Drone ID</h4>
                                <p>{detection_data['drone_id']}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="coordinates">
                        <h3>📍 Detection Coordinates</h3>
                        <p>X: {detection_data['position'][0]:.2f} | Y: {detection_data['position'][1]:.2f} | Z: {detection_data['position'][2]:.2f}</p>
                    </div>
                    
                    <div class="mission-stats">
                        <h3>📊 Mission Statistics</h3>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <h4>Total Detections</h4>
                                <p>{self.mission_stats['total_detections']}</p>
                            </div>
                            <div class="stat-item">
                                <h4>Thermal Detections</h4>
                                <p>{self.mission_stats['detections_by_method']['thermal']}</p>
                            </div>
                            <div class="stat-item">
                                <h4>Audio Detections</h4>
                                <p>{self.mission_stats['detections_by_method']['audio']}</p>
                            </div>
                            <div class="stat-item">
                                <h4>Visual Detections</h4>
                                <p>{self.mission_stats['detections_by_method']['visual']}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="footer">
                    <p><strong>Autonomous Search and Rescue Drone System</strong></p>
                    <p>Real-time human detection and rescue coordination</p>
                    <p class="timestamp">Email generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return html_content



    def attach_media_file(self, msg, file_path, method):
        """Attach media file to email"""
        if not file_path:
            print(f"❌ No file path provided for {method}")
            return
            
        if not os.path.exists(file_path):
            print(f"❌ File does not exist: {file_path}")
            return
        
        try:
            with open(file_path, 'rb') as f:
                file_data = f.read()
                
                if method == 'audio':
                    # Determine audio subtype based on file extension
                    file_ext = os.path.splitext(file_path)[1].lower()
                    if file_ext == '.m4a':
                        audio_subtype = 'm4a'
                    elif file_ext == '.mp3':
                        audio_subtype = 'mp3'
                    else:
                        audio_subtype = 'mpeg'  # fallback
                    
                    attachment = MIMEAudio(file_data, _subtype=audio_subtype)
                    attachment.add_header('Content-Disposition', 'attachment', 
                                        filename=os.path.basename(file_path))
                elif method == 'visual':
                    attachment = MIMEImage(file_data)
                    attachment.add_header('Content-Disposition', 'attachment', 
                                        filename=os.path.basename(file_path))
                else:  # thermal
                    attachment = MIMEImage(file_data)
                    attachment.add_header('Content-Disposition', 'attachment', 
                                        filename=os.path.basename(file_path))
                
                msg.attach(attachment)
                print(f"✅ Attached {method} file: {os.path.basename(file_path)}")
                
        except Exception as e:
            print(f"❌ Failed to attach {method} file: {str(e)}")

    def send_human_detection_email(self, detection_data):
        """Send beautiful email notification for human detection"""
        
        # Update mission statistics
        self.mission_stats['total_detections'] += 1
        self.mission_stats['detections_by_method'][detection_data['method']] += 1
        self.mission_stats['last_detection_time'] = datetime.now()
        
        # Get random detection method and media file
        detection_method = detection_data.get('method', self.get_random_detection_method())
        media_file = self.get_media_file(detection_method)
        
        # Create email message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f'🚨 HUMAN DETECTED - {detection_method.upper()} Detection #{self.mission_stats["total_detections"]}'
        msg['From'] = self.email_config['sender_email']
        msg['To'] = self.email_config['recipient_email']
        
        # Create HTML content
        html_content = self.create_beautiful_email_html({
            'method': detection_method,
            'position': detection_data['position'],
            'drone_id': detection_data.get('drone_id', 'Unknown'),
            'timestamp': detection_data.get('timestamp', datetime.now().strftime('%H:%M:%S'))
        })
        
        # Add HTML content
        msg.attach(MIMEText(html_content, 'html'))
        
        # Attach media file if available
        if media_file:
            self.attach_media_file(msg, media_file, detection_method)
        
        # Send email
        try:
            with smtplib.SMTP(self.email_config['smtp_server'], self.email_config['smtp_port']) as server:
                if self.email_config.get('use_tls', True):
                    server.starttls()
                server.login(
                    self.email_config['sender_email'],
                    self.email_config['sender_password']
                )
                server.send_message(msg)
            
            print(f"✅ Human detection email sent successfully!")
            print(f"   Method: {detection_method}")
            print(f"   Position: {detection_data['position']}")
            print(f"   Total detections: {self.mission_stats['total_detections']}")
            
        except Exception as e:
            print(f"❌ Failed to send human detection email: {str(e)}")

# Example usage
if __name__ == "__main__":
    emailer = HumanDetectionEmailer()
    
    # Example detection data
    detection_data = {
        'position': [123.45, 67.89, 10.0],
        'drone_id': 'D1',
        'timestamp': datetime.now().strftime('%H:%M:%S'),
        'method': 'thermal'  # Will be randomized if not provided
    }
    
    emailer.send_human_detection_email(detection_data)
