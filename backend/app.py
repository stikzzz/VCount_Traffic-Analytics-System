import cv2
import time
import os
from dotenv import load_dotenv, find_dotenv

# Load environment variables from .env file (automatically finds parent .env)
dotenv_path = find_dotenv()
if dotenv_path:
    print(f"ℹ️ Loaded environment variables from: {dotenv_path}")
    load_dotenv(dotenv_path)
else:
    print("⚠️ Warning: No .env file found in current or parent directories.")

import jwt
import datetime
import re
import threading
from functools import wraps
from flask import Flask, jsonify, Response, request
from flask_cors import CORS
from video_loader import VideoManager, StreamManager
from inference import run_inference
from models import db, User, VehicleDetection
import numpy as np
import joblib
from tensorflow.keras.models import load_model
from tensorflow.keras.layers import Dense

class CustomDense(Dense):
    def __init__(self, **kwargs):
        kwargs.pop('quantization_config', None)
        super().__init__(**kwargs)
app = Flask(__name__)
CORS(app) # Don't forget this, or Next.js won't be allowed to fetch the stats!

# Load Secret Key from environment or fallback to default
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'super-secret-key-for-fyp')

# Determine Database URI dynamically (support PostgreSQL and SQLite fallbacks)
database_url = os.environ.get('DATABASE_URL')
if not database_url:
    # If running locally on your Windows path, use your local Postgres setup
    if os.path.exists(r"D:\Users\Chin Zhen Ang\Documents\USM CS\Y4S1\CAT405 - FYP\videoFootage raw\SEPTEMBER 2023"):
        database_url = 'postgresql://postgres:admin123@localhost:5432/postgres'
    else:
        # Otherwise, fall back to SQLite to prevent startup crashes in the cloud
        database_url = 'sqlite:///' + os.path.join(os.path.dirname(__file__), 'data', 'fyp_temp.db')

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
with app.app_context():
    db.create_all()
    
    # Reset vehicle counts to 0 on every server restart
    VehicleDetection.query.delete()
    db.session.commit()
    print("🧹 Cleared old vehicle detections from the database.")
    
    # Auto-seed admin user
    if not User.query.filter_by(email='admin').first():
        admin = User(email='admin', full_name='System Admin', role='admin', status='approved')
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()

# --- AUTH DECORATORS ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1] # Bearer Token
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.filter_by(id=data['id']).first()
        except:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    @token_required
    def decorated(current_user, *args, **kwargs):
        if current_user.role != 'admin':
            return jsonify({'message': 'Admin privilege required!'}), 403
        return f(*args, **kwargs)
    return decorated

# Dynamic Video Footage Directory Setup
DEFAULT_LOCAL_PATH = r"D:\Users\Chin Zhen Ang\Documents\USM CS\Y4S1\CAT405 - FYP\videoFootage raw\SEPTEMBER 2023"
ROOT_VIDEO_DIR = os.environ.get("ROOT_VIDEO_DIR")

if not ROOT_VIDEO_DIR:
    # Bypassed local D: path temporarily to test Google Drive downloader
    # if os.path.exists(DEFAULT_LOCAL_PATH):
    #     ROOT_VIDEO_DIR = DEFAULT_LOCAL_PATH
    # else:
    ROOT_VIDEO_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), "videoFootage"))

print(f"🎬 Active Root Video Footage Directory: {ROOT_VIDEO_DIR}")

# 📥 Dynamic Google Drive Video Downloader running in the background
def download_assets_background(video_manager_instance):
    gdrive_folder = os.environ.get("GOOGLE_DRIVE_FOLDER")
    gdrive_mapping = os.environ.get("GOOGLE_DRIVE_VIDEOS")
    
    if gdrive_folder or gdrive_mapping:
        try:
            import gdown
            os.makedirs(ROOT_VIDEO_DIR, exist_ok=True)
            
            # 1. Download entire Google Drive folder recursively
            if gdrive_folder:
                existing_items = os.listdir(ROOT_VIDEO_DIR)
                if not existing_items or (len(existing_items) == 1 and existing_items[0] == ".keep"):
                    print(f"📥 [Background] Downloading Google Drive folder structure (ID: {gdrive_folder}) to: {ROOT_VIDEO_DIR}")
                    url = f"https://drive.google.com/drive/folders/{gdrive_folder}"
                    gdown.download_folder(url, output=ROOT_VIDEO_DIR, quiet=True)
                    print("✅ [Background] Google Drive folder download completed.")
                    video_manager_instance.build_index()
                else:
                    print(f"ℹ️ [Background] Active video directory is not empty, skipping download.")
            
            # 2. Alternatively, download individual files
            elif gdrive_mapping:
                print("🔗 [Background] Found GOOGLE_DRIVE_VIDEOS mapping, checking assets...")
                downloaded_any = False
                for item in gdrive_mapping.split(","):
                    if ":" in item:
                        cam_id, file_id = item.split(":", 1)
                        cam_id = cam_id.strip().upper()
                        file_id = file_id.strip()
                        
                        dest_path = os.path.join(ROOT_VIDEO_DIR, f"{cam_id}-footage.mp4")
                        if not os.path.exists(dest_path):
                            print(f"📥 [Background] Downloading video for camera {cam_id}...")
                            url = f"https://drive.google.com/uc?id={file_id}"
                            gdown.download(url, dest_path, quiet=True)
                            print(f"✅ [Background] Downloaded {cam_id} video successfully.")
                            downloaded_any = True
                if downloaded_any:
                    video_manager_instance.build_index()
        except Exception as e:
            print(f"⚠️ [Background] Error downloading Google Drive assets: {e}")

video_manager = VideoManager(ROOT_VIDEO_DIR)
stream_manager = StreamManager(video_manager)

# Trigger background downloader thread
threading.Thread(target=download_assets_background, args=(video_manager,), daemon=True).start()

# Load LSTM Model and Scaler
try:
    traffic_lstm_model = load_model(
        os.path.join(os.path.dirname(os.path.dirname(__file__)), 'lstmModel', 'traffic_lstm_model.keras'),
        custom_objects={'Dense': CustomDense},
        compile=False
    )
    y_scaler = joblib.load(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'lstmModel', 'y_scaler.pkl'))
    print("✅ Successfully loaded LSTM model and scaler.")
except Exception as e:
    import traceback
    print(f"⚠️ Warning: Failed to load LSTM model or scaler:")
    traceback.print_exc()
    traffic_lstm_model = None
    y_scaler = None

# Global dictionary to store the latest stats without re-running the model
# Example format: {"T44F1": {"counts": {"car": 4}, "detections": [...]}}
latest_camera_stats = {}

# Virtual lines set by the frontend
# Format: {"T44F1": [{"id": "lane_1", "x1": 0.2, ...}, {"id": "lane_2", ...}]}
camera_lines = {}

# Global dictionary to track the last logged 15-minute interval for CSV writing
last_logged_interval = {}


# --- 1. THE VIDEO ROUTE (MJPEG Stream) ---
def generate_mjpeg_stream(camera_id):
    fps = 30.0  # Assuming 30 FPS source video
    
    while True:
        start_time = time.time()
        
        frame_data = stream_manager.get_frame(camera_id)
        if frame_data is None:
            break
        frame, filepath, msec = frame_data
            
        # Run inference ONCE per frame
        lines = camera_lines.get(camera_id, [])
        result = run_inference(frame, camera_id, lines)
        
        # Calculate inference time and fast-forward to catch up to real-time!
        inference_time = time.time() - start_time
        frames_to_skip = int(inference_time * fps)
        
        if frames_to_skip > 0:
            stream_manager.skip_frames(camera_id, frames_to_skip)
        
        # Calculate footage date and time from metadata
        path_parts = os.path.normpath(filepath).split(os.sep)
        video_time_str = "00:00:00"
        video_time_obj = datetime.datetime.now().time() # fallback
        video_date_obj = datetime.date.today()          # fallback
        
        if "Footage" in path_parts:
            idx = path_parts.index("Footage")
            if idx >= 3:
                # 1. Extract Date
                try:
                    month_year = path_parts[idx-3] # e.g. "SEPTEMBER 2023"
                    day_str = path_parts[idx-2]    # e.g. "11 SEPT"
                    
                    # Extract just the digits for the day
                    day_match = re.search(r'\d+', day_str)
                    day = day_match.group() if day_match else "1"
                    
                    date_str = f"{day} {month_year}" # "11 SEPTEMBER 2023"
                    video_date_obj = datetime.datetime.strptime(date_str, "%d %B %Y").date()
                except (ValueError, IndexError):
                    pass

                # 2. Extract Time (e.g., "12PM-1PM")
                time_range = path_parts[idx-1]
                start_str = time_range.split("-")[0].strip()
                try:
                    # e.g., "12PM" -> 12:00:00
                    base_time = datetime.datetime.strptime(start_str, "%I%p")
                    current_video_dt = base_time + datetime.timedelta(milliseconds=msec)
                    video_time_obj = current_video_dt.time()
                    video_time_str = video_time_obj.strftime("%H:%M:%S")
                except ValueError:
                    pass

        # Check for 15-minute interval logging to inference.csv
        minute_bucket = (video_time_obj.minute // 15) * 15
        current_interval_str = f"{video_time_obj.hour:02d}:{minute_bucket:02d}:00"
        
        if camera_id not in last_logged_interval:
            last_logged_interval[camera_id] = current_interval_str
            
        if current_interval_str != last_logged_interval[camera_id]:
            prev_interval_str = last_logged_interval[camera_id]
            try:
                prev_time_obj = datetime.datetime.strptime(prev_interval_str, "%H:%M:%S").time()
                curr_time_obj = datetime.datetime.strptime(current_interval_str, "%H:%M:%S").time()
                
                with app.app_context():
                    results = db.session.query(
                        VehicleDetection.vehicle_type,
                        db.func.count(VehicleDetection.id)
                    ).filter(
                        VehicleDetection.camera_id == camera_id,
                        VehicleDetection.date == video_date_obj,
                        VehicleDetection.timestamp >= prev_time_obj,
                        VehicleDetection.timestamp < curr_time_obj
                    ).group_by(VehicleDetection.vehicle_type).all()
                    
                    counts = {"car": 0, "motorcycle": 0, "bus": 0, "truck": 0}
                    for v_type, count in results:
                        if v_type in counts:
                            counts[v_type] = count
                            
                    total = sum(counts.values())
                    
                    csv_file_path = os.path.join(os.path.dirname(__file__), 'data', 'inference.csv')
                    if not os.path.exists(csv_file_path):
                        with open(csv_file_path, 'w') as f:
                            f.write("Date,Time,Junction,Car,Motorcycle,Bus,Truck,Total\n")
                            
                    time_fmt = prev_interval_str[:5]
                    with open(csv_file_path, 'a') as f:
                        f.write(f"{video_date_obj},{time_fmt},{camera_id},{counts['car']},{counts['motorcycle']},{counts['bus']},{counts['truck']},{total}\n")
            except Exception as e:
                print(f"Error logging to inference.csv: {e}")
                
            last_logged_interval[camera_id] = current_interval_str

        # Save detections to database using footage time!
        with app.app_context():
            for event in result.get("crossing_events", []):
                v_type = event["vehicle_type"]
                new_detection = VehicleDetection(
                    vehicle_type=v_type,
                    date=video_date_obj,      # Using footage date
                    timestamp=video_time_obj, # Using footage time
                    camera_id=camera_id,
                    lane_id=event["lane_id"],
                    confidence=event["confidence"],
                    stream_track_id=event["track_id"]
                )
                db.session.add(new_detection)
            db.session.commit()

        # Save the stats globally so the React app can fetch them instantly
        latest_camera_stats[camera_id] = {
            "counts": result["counts"],
            "detections": result["detections"],
            "latency": int(inference_time * 1000),
            "fps": int(1.0 / inference_time) if inference_time > 0 else 30,
            "video_time": video_time_str, # Send footage time to frontend
            "video_date": video_date_obj.strftime("%Y-%m-%d") # Send footage date to frontend
        }
        
        # Extract the image and convert to JPEG
        annotated_frame = result["frame"]
        
        # Overlay Metadata using the calculated footage date and time
        if "Footage" in path_parts:
            # Format nicely: "15 SEPTEMBER 2023 | 12:05:30 PM"
            formatted_date = video_date_obj.strftime("%d %B %Y")
            formatted_time = video_time_obj.strftime("%I:%M:%S %p")
            meta_text = f"{formatted_date} | {formatted_time}"
        
        if meta_text:
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.8
            font_thickness = 2
            text_size = cv2.getTextSize(meta_text, font, font_scale, font_thickness)[0]
            text_x = annotated_frame.shape[1] - text_size[0] - 20
            text_y = text_size[1] + 20
            # Background box
            cv2.rectangle(annotated_frame, (text_x - 10, text_y - text_size[1] - 10), (text_x + text_size[0] + 10, text_y + 10), (0, 0, 0), -1)
            # White Text
            cv2.putText(annotated_frame, meta_text, (text_x, text_y), font, font_scale, (255, 255, 255), font_thickness)

        ret, buffer = cv2.imencode('.jpg', annotated_frame)
        frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route("/video_feed/<camera_id>")
def video_feed(camera_id):
    return Response(generate_mjpeg_stream(camera_id), mimetype='multipart/x-mixed-replace; boundary=frame')


# --- 2. THE DATA ROUTE (JSON API for Next.js) ---
@app.route("/set_line/<camera_id>", methods=["POST"])
def set_line(camera_id):
    data = request.json
    if not data:
        return jsonify({"error": "Invalid data"}), 400
    
    # We now expect either a single line or a list of lines
    lines_to_set = []
    if isinstance(data, list):
        lines_to_set = data
    else:
        lines_to_set = [data]
        
    camera_lines[camera_id] = lines_to_set
    return jsonify({"message": "Lines updated successfully", "count": len(lines_to_set)})

@app.route("/detect/<camera_id>")
def detect(camera_id):
    # Instead of running inference again, just grab the latest saved stats!
    stats = latest_camera_stats.get(camera_id)
    
    if not stats:
        return jsonify({"counts": {}, "detections": [], "video_time": "00:00:00", "video_date": ""}) 
        
    return jsonify(stats)


@app.route("/counts/<camera_id>")
def get_counts(camera_id):
    since_str = request.args.get("since", "00:00:00")
    date_str = request.args.get("date") # "YYYY-MM-DD"
    
    try:
        since_time = datetime.datetime.strptime(since_str, "%H:%M:%S").time()
    except ValueError:
        since_time = datetime.time(0, 0, 0)

    # Use the date from the query parameter if provided, otherwise fallback to guessing
    if date_str:
        try:
            target_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            target_date = datetime.date.today()
    else:
        # Fallback: Query for counts since that time on the footage date
        # Get the latest date associated with this camera to find "current" session date
        latest_detection = VehicleDetection.query.filter_by(camera_id=camera_id).order_by(VehicleDetection.date.desc(), VehicleDetection.timestamp.desc()).first()
        target_date = latest_detection.date if latest_detection else datetime.date.today()

    results = db.session.query(
        VehicleDetection.vehicle_type, 
        db.func.count(VehicleDetection.id)
    ).filter(
        VehicleDetection.camera_id == camera_id,
        VehicleDetection.date == target_date,
        VehicleDetection.timestamp >= since_time
    ).group_by(VehicleDetection.vehicle_type).all()

    counts = {
        "car": 0,
        "truck": 0,
        "bus": 0,
        "motorcycle": 0
    }

    for v_type, count in results:
        # Map DB types to display types if needed, but they should match
        if v_type in counts:
            counts[v_type] = count

    return jsonify({"counts": counts, "since": since_str})


@app.route("/timeseries/<camera_id>")
def get_timeseries(camera_id):
    date_str = request.args.get("date")
    time_str = request.args.get("time") # current video time, e.g. "12:35:00"
    
    if not date_str or not time_str:
        return jsonify([])

    try:
        video_time = datetime.datetime.strptime(time_str, "%H:%M:%S").time()
        target_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
        hour = video_time.hour
    except ValueError:
        return jsonify([])

    video_minute = video_time.minute
    start_minute = (video_minute // 15) * 15
    end_minute = start_minute + 15
    
    start_time = datetime.time(hour, start_minute, 0)
    
    # Query database for crossings within this specific 15-minute block
    if end_minute < 60:
        end_time = datetime.time(hour, end_minute, 0)
        records = db.session.query(VehicleDetection).filter(
            VehicleDetection.camera_id == camera_id,
            VehicleDetection.date == target_date,
            VehicleDetection.timestamp >= start_time,
            VehicleDetection.timestamp <= end_time
        ).order_by(VehicleDetection.timestamp).all()
    else:
        # Hour transition: e.g., 12:45 to 13:00
        if hour == 23:
            end_time = datetime.time(23, 59, 59)
            records = db.session.query(VehicleDetection).filter(
                VehicleDetection.camera_id == camera_id,
                VehicleDetection.date == target_date,
                VehicleDetection.timestamp >= start_time
            ).order_by(VehicleDetection.timestamp).all()
        else:
            end_time = datetime.time(hour + 1, 0, 0)
            records = db.session.query(VehicleDetection).filter(
                VehicleDetection.camera_id == camera_id,
                VehicleDetection.date == target_date,
                VehicleDetection.timestamp >= start_time,
                VehicleDetection.timestamp <= end_time
            ).order_by(VehicleDetection.timestamp).all()

    # Bucket them by minute
    timeseries = {}
    for r in records:
        minute_str = f"{r.timestamp.hour:02d}:{r.timestamp.minute:02d}"
        if minute_str not in timeseries:
            timeseries[minute_str] = {"car": 0, "truck": 0, "bus": 0, "motorcycle": 0}
        
        v_type = r.vehicle_type
        if v_type in timeseries[minute_str]:
            timeseries[minute_str][v_type] += 1

    result = []
    
    # Generate data from start_minute to end_minute inclusive (16 data points)
    for m in range(start_minute, end_minute + 1):
        if m == 60:
            target_hour = hour + 1 if hour < 23 else 0
            target_min = 0
        else:
            target_hour = hour
            target_min = m
            
        minute_str = f"{target_hour:02d}:{target_min:02d}"
        
        # Stop appending actual counts if the minute is in the future relative to the video time
        is_past_current = False
        if hour == 23 and m == 60:
            is_past_current = True
        elif target_hour > hour:
            is_past_current = True
        elif target_hour == hour and target_min > video_minute:
            is_past_current = True
            
        if not is_past_current:
            minute_counts = {"car": 0, "truck": 0, "bus": 0, "motorcycle": 0}
            if minute_str in timeseries:
                for v_type, count in timeseries[minute_str].items():
                    minute_counts[v_type] = count
            
            result.append({
                "time": minute_str,
                "car": minute_counts["car"],
                "truck": minute_counts["truck"],
                "bus": minute_counts["bus"],
                "motorcycle": minute_counts["motorcycle"]
            })
        else:
            # Future minute slot: we output the label only, leaving data undefined so the line cuts off
            result.append({
                "time": minute_str
            })

    return jsonify(result)


@app.route("/forecast/<camera_id>")
def get_forecast(camera_id):
    if traffic_lstm_model is None or y_scaler is None:
        return jsonify({"error": "Model not loaded"}), 500

    date_str = request.args.get("date")
    time_str = request.args.get("time") # e.g. "12:35:00"
    direction = request.args.get("direction", "Stadium") # e.g., Stadium, JalanPerak, JalanPRamlee, JalanPenang
    
    if not date_str or not time_str:
        return jsonify({"error": "Missing date or time"}), 400

    try:
        video_time = datetime.datetime.strptime(time_str, "%H:%M:%S").time()
        target_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Invalid date or time format"}), 400

    video_datetime = datetime.datetime.combine(target_date, video_time)
    
    # Round down to the nearest 15 minutes to find the START of the current bucket
    minute = video_datetime.minute
    bucket_start_minute = (minute // 15) * 15
    current_bucket_start = video_datetime.replace(minute=bucket_start_minute, second=0, microsecond=0)
    
    # Direction Dummy
    dir_ramlee = 1 if direction == "JalanPRamlee" else 0
    dir_penang = 1 if direction == "JalanPenang" else 0
    dir_perak = 1 if direction == "JalanPerak" else 0
    dir_stadium = 1 if direction == "Stadium" else 0
    
    sequences = []
    history_results = []
    
    # 1. Query past 4 intervals (60 minutes lookback)
    for i in range(4, 0, -1):
        interval_start = current_bucket_start - datetime.timedelta(minutes=15 * i)
        interval_end = current_bucket_start - datetime.timedelta(minutes=15 * (i - 1))
        
        # Query DB for counts in this interval
        query = db.session.query(
            VehicleDetection.vehicle_type,
            db.func.count(VehicleDetection.id)
        ).filter(
            VehicleDetection.camera_id == camera_id,
            VehicleDetection.date == interval_start.date(),
            VehicleDetection.timestamp >= interval_start.time()
        )
        if interval_end.time() != datetime.time(0, 0):
            query = query.filter(VehicleDetection.timestamp < interval_end.time())
            
        results = query.group_by(VehicleDetection.vehicle_type).all()
        
        counts = {"motorcycle": 0, "car": 0, "bus": 0, "truck": 0}
        for v_type, count in results:
            if v_type in counts:
                counts[v_type] = count
                
        history_results.append({
            "time": interval_start.strftime("%H:%M"),
            "car": counts["car"],
            "motorcycle": counts["motorcycle"],
            "bus": counts["bus"],
            "truck": counts["truck"],
            "is_forecast": False
        })
        
        # Time features
        interval_hour = interval_start.hour
        interval_minute = interval_start.minute
        
        is_weekend = int(interval_start.weekday() >= 5)
        sin_hour = float(np.sin(2 * np.pi * interval_hour / 23.0))
        cos_hour = float(np.cos(2 * np.pi * interval_hour / 23.0))
        sin_min = float(np.sin(2 * np.pi * interval_minute / 59.0))
        cos_min = float(np.cos(2 * np.pi * interval_minute / 59.0))
        
        # Timezone Dummy
        tz_1 = 1 if 7 <= interval_hour <= 9 else 0
        tz_2 = 1 if 12 <= interval_hour <= 14 else 0
        tz_3 = 1 if 17 <= interval_hour <= 19 else 0
        
        day_of_week = interval_start.weekday() + 1
        
        features = [
            day_of_week,
            counts["motorcycle"], counts["car"], counts["bus"], counts["truck"],
            is_weekend, sin_hour, cos_hour, sin_min, cos_min,
            tz_1, tz_2, tz_3,
            dir_ramlee, dir_penang, dir_perak, dir_stadium
        ]
        sequences.append(features)
        
    seq_array = np.array(sequences, dtype=np.float32) # shape (4, 17)
    
    # Scale vehicle counts at indices 1 to 5
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        scaled_counts = y_scaler.transform(seq_array[:, 1:5])
    seq_array[:, 1:5] = scaled_counts
    
    # 2. Query the current active interval (in progress) up to now
    curr_results = db.session.query(
        VehicleDetection.vehicle_type,
        db.func.count(VehicleDetection.id)
    ).filter(
        VehicleDetection.camera_id == camera_id,
        VehicleDetection.date == video_datetime.date(),
        VehicleDetection.timestamp >= current_bucket_start.time(),
        VehicleDetection.timestamp <= video_time
    ).group_by(VehicleDetection.vehicle_type).all()
    
    curr_counts = {"motorcycle": 0, "car": 0, "bus": 0, "truck": 0}
    for v_type, count in curr_results:
        if v_type in curr_counts:
            curr_counts[v_type] = count
            
    # Add current block to history
    now_label = current_bucket_start.strftime("%H:%M") + " (Now)"
    history_results.append({
        "time": now_label,
        "car": curr_counts["car"],
        "motorcycle": curr_counts["motorcycle"],
        "bus": curr_counts["bus"],
        "truck": curr_counts["truck"],
        "is_forecast": False
    })
    
    # 3. Auto-regressive forecast for the next 8 intervals (2 hours)
    forecast_results = []
    current_seq = seq_array.copy()
    
    # Seed the first forecast point with the current time's prediction start state.
    # To make the chart continuous, we start the forecast sequence at the exact same "Now" point, 
    # but with forecast properties.
    forecast_results.append({
        "time": now_label,
        "car_forecast": curr_counts["car"],
        "motorcycle_forecast": curr_counts["motorcycle"],
        "bus_forecast": curr_counts["bus"],
        "truck_forecast": curr_counts["truck"],
        "is_forecast": True
    })
    
    for step in range(1, 9):
        # Predict
        X = np.expand_dims(current_seq, axis=0)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            y_pred_scaled = traffic_lstm_model.predict(X, verbose=0)
            y_pred = y_scaler.inverse_transform(y_pred_scaled)[0]
            
        pred_counts = {
            "motorcycle": max(0, int(round(y_pred[0]))),
            "car": max(0, int(round(y_pred[1]))),
            "bus": max(0, int(round(y_pred[2]))),
            "truck": max(0, int(round(y_pred[3])))
        }
        
        step_start = current_bucket_start + datetime.timedelta(minutes=15 * step)
        time_label = step_start.strftime("%H:%M")
        
        forecast_results.append({
            "time": time_label,
            "car_forecast": pred_counts["car"],
            "motorcycle_forecast": pred_counts["motorcycle"],
            "bus_forecast": pred_counts["bus"],
            "truck_forecast": pred_counts["truck"],
            "is_forecast": True
        })
        
        # Prepare next input sequence
        next_interval_time = current_bucket_start + datetime.timedelta(minutes=15 * (step + 1))
        next_hour = next_interval_time.hour
        next_minute = next_interval_time.minute
        
        is_weekend = int(next_interval_time.weekday() >= 5)
        sin_hour = float(np.sin(2 * np.pi * next_hour / 23.0))
        cos_hour = float(np.cos(2 * np.pi * next_hour / 23.0))
        sin_min = float(np.sin(2 * np.pi * next_minute / 59.0))
        cos_min = float(np.cos(2 * np.pi * next_minute / 59.0))
        
        tz_1 = 1 if 7 <= next_hour <= 9 else 0
        tz_2 = 1 if 12 <= next_hour <= 14 else 0
        tz_3 = 1 if 17 <= next_hour <= 19 else 0
        
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            scaled_pred = y_scaler.transform(np.array([[pred_counts["motorcycle"], pred_counts["car"], pred_counts["bus"], pred_counts["truck"]]], dtype=np.float32))[0]
            
        day_of_week = next_interval_time.weekday() + 1
        
        new_features = [
            day_of_week,
            scaled_pred[0], scaled_pred[1], scaled_pred[2], scaled_pred[3],
            is_weekend, sin_hour, cos_hour, sin_min, cos_min,
            tz_1, tz_2, tz_3,
            dir_ramlee, dir_penang, dir_perak, dir_stadium
        ]
        current_seq = np.vstack([current_seq[1:], new_features])
        
    first_forecast_time = (current_bucket_start + datetime.timedelta(minutes=15)).strftime("%H:%M")
    last_forecast_time = (current_bucket_start + datetime.timedelta(minutes=15 * 8)).strftime("%H:%M")
    forecast_time = f"{first_forecast_time} - {last_forecast_time}"
    
    # Return single interval summary counts as before for other parts of dashboard, 
    # but include full timeline lists for the trend chart!
    return jsonify({
        "forecast_time": forecast_time,
        "counts": {
            "motorcycle": forecast_results[1]["motorcycle_forecast"],
            "car": forecast_results[1]["car_forecast"],
            "bus": forecast_results[1]["bus_forecast"],
            "truck": forecast_results[1]["truck_forecast"]
        },
        "history": history_results,
        "forecast": forecast_results
    })

@app.route("/cameras")
def list_cameras():
    return jsonify({
        "cameras": list(video_manager.camera_map.keys())
    })

# --- 3. AUTH ROUTE ---
@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.json
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Missing email or password'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'User already exists'}), 400
        
    new_user = User(
        email=data['email'], 
        full_name=data.get('full_name'),
        role='user', 
        status='pending'
    )
    new_user.set_password(data['password'])
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({'message': 'Registration successful. Waiting for admin approval.'})

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Missing email or password'}), 400
        
    user = User.query.filter_by(email=data['email']).first()
    
    if not user or not user.check_password(data['password']):
        return jsonify({'message': 'Invalid credentials'}), 401
        
    if user.role != 'admin' and user.status != 'approved':
        return jsonify({'message': f'Account is {user.status}. Please wait for admin approval.'}), 403
        
    from datetime import timezone
    token = jwt.encode({
        'id': user.id,
        'role': user.role,
        'exp': datetime.datetime.now(timezone.utc) + datetime.timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    
    return jsonify({
        'token': token, 
        'role': user.role, 
        'email': user.email,
        'full_name': user.full_name
    })

@app.route("/api/admin/users", methods=["GET"])
@admin_required
def get_users():
    users = User.query.filter(User.role != 'admin').all()
    return jsonify({'users': [user.to_dict() for user in users]})

@app.route("/api/admin/users/<int:user_id>/status", methods=["POST"])
@admin_required
def update_user_status(user_id):
    data = request.json
    new_status = data.get('status')
    if new_status not in ['approved', 'rejected']:
        return jsonify({'message': 'Invalid status'}), 400
        
    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404
        
    user.status = new_status
    db.session.commit()
    
    return jsonify({'message': f'User status updated to {new_status}'})

if __name__ == "__main__":
    app.run(debug=True, port=5000)