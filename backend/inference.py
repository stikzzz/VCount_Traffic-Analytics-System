import cv2
import numpy as np
import os
import random

# Global settings with fallback capabilities
DETECTION_DEVICE = os.environ.get("DETECTION_DEVICE", "intel:gpu")
MODEL_PATH = os.environ.get("MODEL_PATH", "model/best_openvino_model")

MOCK_MODE = os.environ.get("MOCK_MODE", "").lower() == "true" or os.environ.get("RENDER") is not None

# Persistent mock tracks state: {camera_id: [dict]}
mock_tracks = {}
# Global counter to assign new track IDs
mock_next_track_id = 1

# A dictionary to store multi-camera tracker state
models = {}
# To store previous centroid positions for tracking: {camera_id: {track_id: (x, y)}}
track_history = {}
# To track which IDs have already crossed the line to prevent double-counting
counted_ids = {}
# To track when an ID was last seen to clear up memory
track_age = {}
# Persistent counts per camera: {camera_id: {"car": 0, "truck": 0, "bus": 0, "motorcycle": 0}}
global_counts = {}

def get_model(camera_id):
    global MODEL_PATH, DETECTION_DEVICE
    if camera_id not in models:
        from ultralytics import YOLO
        import torch
        print(f"Attempting to load YOLOv8 model from '{MODEL_PATH}' for camera {camera_id}...")
        try:
            models[camera_id] = YOLO(MODEL_PATH)
            print(f"✅ Successfully loaded model from '{MODEL_PATH}'")
        except Exception as e:
            print(f"⚠️ Failed to load model from '{MODEL_PATH}'. Error: {e}")
            if MODEL_PATH != "model/best.pt":
                print("Falling back to PyTorch best.pt model...")
                MODEL_PATH = "model/best.pt"
                if DETECTION_DEVICE == "intel:gpu":
                    DETECTION_DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
                models[camera_id] = YOLO(MODEL_PATH)
                print(f"✅ Loaded fallback PyTorch model from '{MODEL_PATH}' on device '{DETECTION_DEVICE}'")
            else:
                raise e
        track_history[camera_id] = {}
        counted_ids[camera_id] = set() # track_id set to prevent double counting
        track_age[camera_id] = {}
        # Pre-populate designated classes
        global_counts[camera_id] = {} # {lane_id: {"car": 0, ...}}
    return models[camera_id]

# Helper function to check if a point crosses a directed line segment
def is_crossing_line(p1, p2, line_p1, line_p2):
    # This uses cross products to see if the segment crosses the line and the direction of crossing.
    def ccw(A, B, C):
        return (C[1]-A[1]) * (B[0]-A[0]) > (B[1]-A[1]) * (C[0]-A[0])
    
    # Check if they intersect
    intersect = ccw(line_p1, p1, p2) != ccw(line_p2, p1, p2) and ccw(line_p1, line_p2, p1) != ccw(line_p1, line_p2, p2)
    
    if not intersect:
        return False
        
    # Check direction: moving from side False to side True relative to the drawn line
    side1 = ccw(line_p1, line_p2, p1)
    side2 = ccw(line_p1, line_p2, p2)
    
    # Crosses in a specific direction only
    if not side1 and side2:
        return True
    return False

def run_inference(frame, camera_id, virtual_lines=None):
    global DETECTION_DEVICE, MODEL_PATH
    
    if MOCK_MODE:
        # Ensure collections are initialized
        if camera_id not in counted_ids:
            counted_ids[camera_id] = set()
        if camera_id not in track_history:
            track_history[camera_id] = {}
        if camera_id not in track_age:
            track_age[camera_id] = {}
        if camera_id not in global_counts:
            global_counts[camera_id] = {}

        history = track_history[camera_id]
        counted = counted_ids[camera_id]
        age = track_age[camera_id]
        counts = global_counts[camera_id]
        crossing_events = []
        detections = []
        
        # Process virtual_lines (list of line dicts)
        # Ensure every lane has a count dict initialized
        if virtual_lines:
            for v_line in virtual_lines:
                lane_id = v_line.get("id", "default")
                if lane_id not in counts:
                    counts[lane_id] = {"car": 0, "truck": 0, "bus": 0, "motorcycle": 0}

        annotated_frame = frame.copy()
        height, width = annotated_frame.shape[:2]

        # Render virtual lines (same logic as real)
        processed_lines = []
        if virtual_lines:
            for idx, v_line in enumerate(virtual_lines):
                px1, py1 = int(v_line["x1"] * width), int(v_line["y1"] * height)
                px2, py2 = int(v_line["x2"] * width), int(v_line["y2"] * height)
                lane_id = v_line.get("id", f"lane_{idx}")
                processed_lines.append(((px1, py1), (px2, py2), lane_id))
                
                if v_line.get("show", True):
                    color = (255, 100 + (idx*40)%155, 0)
                    cv2.line(annotated_frame, (px1, py1), (px2, py2), color, 2)
                    cv2.putText(annotated_frame, lane_id, (px1, py1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
                    mx, my = (px1+px2)//2, (py1+py2)//2
                    dx, dy = px2 - px1, py2 - py1
                    length = (dx**2 + dy**2)**0.5
                    if length > 0:
                        nx, ny = int(-dy/length * 20), int(dx/length * 20)
                        cv2.arrowedLine(annotated_frame, (mx, my), (mx+nx, my+ny), (0, 255, 255), 2)

        # Initialize mock_tracks for this camera
        global mock_tracks, mock_next_track_id
        if camera_id not in mock_tracks:
            mock_tracks[camera_id] = []

        # Update age for tracking cleanup
        for tid in list(age.keys()):
            age[tid] += 1
            if age[tid] > 60:
                age.pop(tid, None)
                history.pop(tid, None)
                counted.discard(tid)

        # Update existing tracks and filter out active ones
        active_tracks = []
        for track in mock_tracks[camera_id]:
            # Move vehicle
            track["x"] += track["speed_x"]
            track["y"] += track["speed_y"]
            
            # Check if off-screen (with margin)
            if track["y"] > height + 50 or track["x"] < -50 or track["x"] > width + 50:
                continue
            
            track_id = track["id"]
            label = track["class"]
            conf = track["confidence"]
            w, h = track["w"], track["h"]
            
            x1, y1 = int(track["x"] - w/2), int(track["y"] - h)
            x2, y2 = int(track["x"] + w/2), int(track["y"])
            
            # Center for tracking trail
            cx, cy = int(track["x"]), int(track["y"])
            
            # Trail drawing
            if track_id in history:
                prev_cx, prev_cy = history[track_id]
                cv2.line(annotated_frame, (prev_cx, prev_cy), (cx, cy), (0, 255, 0), 2)
                cv2.circle(annotated_frame, (cx, cy), 5, (0, 0, 255), -1)
            
            # Count logic
            if track_id not in counted:
                counted.add(track_id)
                lane_id = "camera_view"
                if lane_id not in counts:
                    counts[lane_id] = {"car": 0, "truck": 0, "bus": 0, "motorcycle": 0}
                counts[lane_id][label] = counts[lane_id].get(label, 0) + 1
                
                crossing_events.append({
                    "lane_id": lane_id,
                    "vehicle_type": label,
                    "confidence": conf,
                    "track_id": track_id
                })
            
            history[track_id] = (cx, cy)
            age[track_id] = 0
            
            # Draw bounding box
            color = (255, 0, 0)  # blue
            if label == "car": color = (255, 180, 0)
            elif label == "motorcycle": color = (0, 200, 255)
            elif label == "bus": color = (0, 255, 100)
            elif label == "truck": color = (100, 100, 255)
            
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
            label_text = f"{label} {conf:.2f} (ID: {track_id})"
            cv2.putText(annotated_frame, label_text, (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            
            detections.append({
                "class": label,
                "confidence": conf,
                "track_id": track_id
            })
            active_tracks.append(track)
            
        mock_tracks[camera_id] = active_tracks

        # Spawn a new mock vehicle if needed
        if len(mock_tracks[camera_id]) < 4 and random.random() < 0.15:
            label = random.choices(
                ["car", "motorcycle", "bus", "truck"],
                weights=[0.60, 0.25, 0.05, 0.10],
                k=1
            )[0]
            
            w_factor = 0.12 if label == "car" else (0.05 if label == "motorcycle" else (0.20 if label == "bus" else 0.18))
            h_factor = 0.10 if label == "car" else (0.07 if label == "motorcycle" else (0.16 if label == "bus" else 0.14))
            
            w = int(width * w_factor)
            h = int(height * h_factor)
            
            # Spawn at top with random X
            spawn_x = random.uniform(0.15 * width, 0.85 * width)
            spawn_y = int(0.15 * height)
            
            speed_y = random.uniform(3.0, 6.0)
            speed_x = random.uniform(-1.0, 1.0)
            
            new_track = {
                "id": mock_next_track_id,
                "class": label,
                "x": spawn_x,
                "y": spawn_y,
                "speed_x": speed_x,
                "speed_y": speed_y,
                "w": w,
                "h": h,
                "confidence": random.uniform(0.82, 0.97)
            }
            mock_next_track_id += 1
            mock_tracks[camera_id].append(new_track)

        return {
            "detections": detections,
            "counts": counts,
            "crossing_events": crossing_events,
            "frame": annotated_frame
        }

    model = get_model(camera_id)
    history = track_history[camera_id]
    counted = counted_ids[camera_id]
    age = track_age[camera_id]
    counts = global_counts[camera_id]
    crossing_events = []
    
    # Process virtual_lines (list of line dicts)
    # Ensure every lane has a count dict initialized
    if virtual_lines:
        for v_line in virtual_lines:
            lane_id = v_line.get("id", "default")
            if lane_id not in counts:
                counts[lane_id] = {"car": 0, "truck": 0, "bus": 0, "motorcycle": 0}

    # Increment age for all tracked IDs to handle cleanup
    for tid in list(age.keys()):
        age[tid] += 1
        # If an ID hasn't been seen in 60 frames (approx 2s in 30fps), forget it
        if age[tid] > 60:
            age.pop(tid, None)
            history.pop(tid, None)
            counted.discard(tid)

    # Run tracking model with automatic device/model fallback
    # persist=True ensures the model remembers object IDs between frames
    try:
        results = model.track(frame, persist=True, verbose=False, device=DETECTION_DEVICE)[0]
    except Exception as e:
        print(f"⚠️ Warning: Inference failed on device '{DETECTION_DEVICE}'. Error: {e}")
        if DETECTION_DEVICE != "cpu":
            print("Falling back to CPU device for inference...")
            DETECTION_DEVICE = "cpu"
            if MODEL_PATH == "model/best_openvino_model":
                print("Loading PyTorch best.pt for CPU fallback...")
                MODEL_PATH = "model/best.pt"
                from ultralytics import YOLO
                models[camera_id] = YOLO(MODEL_PATH)
                model = models[camera_id]
            results = model.track(frame, persist=True, verbose=False, device="cpu")[0]
        else:
            raise e
    
    detections = []
    
    # Output visualizations on the YOLO plot
    annotated_frame = results.plot()
    height, width = annotated_frame.shape[:2]
    
    # Render all virtual lines
    processed_lines = []
    if virtual_lines:
        for idx, v_line in enumerate(virtual_lines):
            px1, py1 = int(v_line["x1"] * width), int(v_line["y1"] * height)
            px2, py2 = int(v_line["x2"] * width), int(v_line["y2"] * height)
            lane_id = v_line.get("id", f"lane_{idx}")
            
            processed_lines.append(((px1, py1), (px2, py2), lane_id))
            
            if v_line.get("show", True):
                # Unique colors (just cycling or could be passed)
                color = (255, 100 + (idx*40)%155, 0)
                cv2.line(annotated_frame, (px1, py1), (px2, py2), color, 2)
                cv2.putText(annotated_frame, lane_id, (px1, py1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
                
                # Direction vector
                mx, my = (px1+px2)//2, (py1+py2)//2
                dx, dy = px2 - px1, py2 - py1
                length = (dx**2 + dy**2)**0.5
                if length > 0:
                    nx, ny = int(-dy/length * 20), int(dx/length * 20)
                    cv2.arrowedLine(annotated_frame, (mx, my), (mx+nx, my+ny), (0, 255, 255), 2)

    if results.boxes.id is not None:
        for box, track_id in zip(results.boxes, results.boxes.id):
            track_id = int(track_id.item())
            cls = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            label = model.names[cls].lower()
            if label == "cars": label = "car"
            elif label == "trucks": label = "truck"
            elif label == "buses": label = "bus"
            elif label in ["motorcycles", "motor", "motorbike"]: label = "motorcycle"
            
            # Use the bottom center of the bounding box
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            cx, cy = int((x1 + x2) / 2), int(y2)
            
            # Check previous history for speed/direction/crossing
            if track_id in history:
                prev_cx, prev_cy = history[track_id]
                
                # Draw the trail (Green)
                cv2.line(annotated_frame, (prev_cx, prev_cy), (cx, cy), (0, 255, 0), 2)
                cv2.circle(annotated_frame, (cx, cy), 5, (0, 0, 255), -1)
                
            # Log the vehicle immediately when it is first tracked
            if track_id not in counted:
                counted.add(track_id)
                
                # Default lane_id since we are not using virtual lines for counts anymore
                lane_id = "camera_view"
                if lane_id not in counts:
                    counts[lane_id] = {"car": 0, "truck": 0, "bus": 0, "motorcycle": 0}
                counts[lane_id][label] = counts[lane_id].get(label, 0) + 1
                
                # Add a "crossing event" (now just a detection event)
                crossing_events.append({
                    "lane_id": lane_id,
                    "vehicle_type": label,
                    "confidence": conf,
                    "track_id": track_id
                })
            
            history[track_id] = (cx, cy)
            age[track_id] = 0 # Reset age since it was just seen
            
            detections.append({
                "class": label,
                "confidence": conf,
                "track_id": track_id
            })
            
    return {
        "detections": detections,
        "counts": counts,
        "crossing_events": crossing_events,
        "frame": annotated_frame
    }