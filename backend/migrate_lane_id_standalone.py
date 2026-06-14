from sqlalchemy import create_engine, text
import sys

# Connection string from app.py
DB_URI = 'postgresql://postgres:admin123@localhost:5432/postgres'

def migrate():
    engine = create_engine(DB_URI)
    with engine.connect() as connection:
        try:
            # Check if column exists
            result = connection.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='vehicle_detections' AND column_name='lane_id'"))
            if result.fetchone():
                print("Column lane_id already exists.")
                return

            connection.execute(text('ALTER TABLE vehicle_detections ADD COLUMN lane_id VARCHAR(50)'))
            connection.commit()
            print("Successfully added lane_id column.")
        except Exception as e:
            print(f"Error during migration: {e}")
            sys.exit(1)

if __name__ == "__main__":
    migrate()
