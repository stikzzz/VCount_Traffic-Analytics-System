from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    full_name = db.Column(db.String(100), nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user') # 'admin' or 'user'
    status = db.Column(db.String(20), nullable=False, default='pending') # 'pending', 'approved', 'rejected'
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'full_name': self.full_name,
            'role': self.role,
            'status': self.status
        }

class VehicleDetection(db.Model):
    __tablename__ = 'vehicle_detections'
    
    # Unique ID for the database record
    id = db.Column(db.Integer, primary_key=True)
    
    # Either 'car', 'motorcycle', 'bus', or 'truck'
    vehicle_type = db.Column(db.String(50), nullable=False)
    
    # Date and Time components
    date = db.Column(db.Date, nullable=False)
    timestamp = db.Column(db.Time, nullable=False)
    
    # Which camera recorded it
    camera_id = db.Column(db.String(50), nullable=False)
    
    # Suggested highly recommended additions:
    direction = db.Column(db.String(50), nullable=True)     # "incoming" or "outgoing"
    lane_id = db.Column(db.String(50), nullable=True)       # e.g., "Lane_1", "North_Lane"
    confidence = db.Column(db.Float, nullable=True)         # Model prediction confidence (e.g., 0.92)
    stream_track_id = db.Column(db.Integer, nullable=True)  # Keeping original YOLO track_id for debugging

    def to_dict(self):
        return {
            'id': self.id,
            'vehicle_type': self.vehicle_type,
            'date': self.date.isoformat() if self.date else None,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'camera_id': self.camera_id,
            'lane_id': self.lane_id,
            'direction': self.direction,
            'confidence': self.confidence,
            'stream_track_id': self.stream_track_id
        }
