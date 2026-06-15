import os
import cv2

VIDEO_EXTENSIONS = (".mp4", ".avi", ".mov")

class VideoManager:
    def __init__(self, root_dir):
        self.root_dir = root_dir
        self.camera_map = {}  # camera_id -> list of video paths
        self.build_index()

    def build_index(self):
        print(f"🔍 [Indexer] Scanning video folders in: {self.root_dir}", flush=True)
        # Clear map on rebuild to avoid duplicate additions
        self.camera_map = {}
        
        walk_count = 0
        match_count = 0
        
        for root, dirs, files in os.walk(self.root_dir):
            walk_count += len(files)
            for file in files:
                if file.lower().endswith(VIDEO_EXTENSIONS):
                    match_count += 1
                    filepath = os.path.join(root, file)

                    # Extract camera ID (T44F1, T44P1, etc.)
                    camera_id = file.split("-")[0].upper()

                    if camera_id not in self.camera_map:
                        self.camera_map[camera_id] = []

                    self.camera_map[camera_id].append(filepath)
                    
        print(f"📊 [Indexer] Total files seen in walk: {walk_count}, matched videos: {match_count}", flush=True)
        # Sort videos per camera (optional)
        for cam in self.camera_map:
            self.camera_map[cam].sort()

        print("✅ [Indexer] Cameras map keys:", list(self.camera_map.keys()), flush=True)

    def get_videos(self, camera_id):
        return self.camera_map.get(camera_id.upper(), [])
    
class StreamManager:
    def __init__(self, video_manager):
        self.video_manager = video_manager
        self.caps = {}  # camera_id -> VideoCapture
        self.indices = {}  # camera_id -> current video index

    def get_frame(self, camera_id):
        camera_id = camera_id.upper()

        videos = self.video_manager.get_videos(camera_id)
        if not videos:
            return None

        # Initialize if not exists
        if camera_id not in self.caps:
            self.indices[camera_id] = 0
            self.caps[camera_id] = cv2.VideoCapture(videos[0])

        cap = self.caps[camera_id]

        ret, frame = cap.read()

        # If video ends → go to next video
        if not ret:
            cap.release()

            self.indices[camera_id] += 1
            if self.indices[camera_id] >= len(videos):
                self.indices[camera_id] = 0  # loop all videos

            next_video = videos[self.indices[camera_id]]
            self.caps[camera_id] = cv2.VideoCapture(next_video)

            ret, frame = self.caps[camera_id].read()

        msec = self.caps[camera_id].get(cv2.CAP_PROP_POS_MSEC)
        return frame, videos[self.indices[camera_id]], msec

    def skip_frames(self, camera_id, num_frames):
        camera_id = camera_id.upper()
        if camera_id not in self.caps or num_frames <= 0:
            return

        videos = self.video_manager.get_videos(camera_id)
        if not videos:
            return

        cap = self.caps[camera_id]
        for _ in range(num_frames):
            ret = cap.grab()
            if not ret:
                # Video ended while skipping
                cap.release()

                self.indices[camera_id] += 1
                if self.indices[camera_id] >= len(videos):
                    self.indices[camera_id] = 0  # loop

                next_video = videos[self.indices[camera_id]]
                self.caps[camera_id] = cv2.VideoCapture(next_video)
                cap = self.caps[camera_id]
                cap.grab() # grab the first frame of new video