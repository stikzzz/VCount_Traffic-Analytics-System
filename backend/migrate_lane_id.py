from app import app, db
from sqlalchemy import text
import sys

with app.app_context():
    try:
        db.session.execute(text('ALTER TABLE vehicle_detections ADD COLUMN lane_id VARCHAR(50)'))
        db.session.commit()
        print("Successfully added lane_id column.")
    except Exception as e:
        db.session.rollback()
        if "already exists" in str(e):
            print("Column lane_id already exists.")
        else:
            print(f"Error during migration: {e}")
            sys.exit(1)
