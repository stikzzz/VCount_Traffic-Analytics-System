import os
import psycopg2
import pandas as pd

def generate_inference_csv():
    try:
        conn = psycopg2.connect("dbname='postgres' user='postgres' host='localhost' password='admin123' port='5432'")
        query = "SELECT date, timestamp, camera_id, vehicle_type FROM vehicle_detections"
        df = pd.read_sql_query(query, conn)
        
        output_path = os.path.join("data", "inference.csv")
        
        if df.empty:
            print("No data in vehicle_detections. Creating empty CSV.")
            # Create empty df with specified columns
            final_df = pd.DataFrame(columns=['Date', 'Time', 'Junction', 'Car', 'Motorcycle', 'Bus', 'Truck', 'Total'])
            final_df.to_csv(output_path, index=False)
            return

        # Group by 15-minute intervals
        def format_time(t):
            minute = (t.minute // 15) * 15
            return f"{t.hour:02d}:{minute:02d}"
        
        df['Time'] = df['timestamp'].apply(format_time)
        df['Date'] = df['date'].astype(str)
        df['Junction'] = df['camera_id']
        
        # Group by Date, Time, Junction, vehicle_type
        grouped = df.groupby(['Date', 'Time', 'Junction', 'vehicle_type']).size().unstack(fill_value=0).reset_index()
        
        # Ensure all columns exist
        for col in ['car', 'motorcycle', 'bus', 'truck']:
            if col not in grouped.columns:
                grouped[col] = 0
                
        grouped['Car'] = grouped['car']
        grouped['Motorcycle'] = grouped['motorcycle']
        grouped['Bus'] = grouped['bus']
        grouped['Truck'] = grouped['truck']
        
        grouped['Total'] = grouped['Car'] + grouped['Motorcycle'] + grouped['Bus'] + grouped['Truck']
        
        final_df = grouped[['Date', 'Time', 'Junction', 'Car', 'Motorcycle', 'Bus', 'Truck', 'Total']]
        final_df = final_df.sort_values(['Date', 'Time', 'Junction'])
        
        final_df.to_csv(output_path, index=False)
        print(f"Successfully generated {output_path} with {len(final_df)} aggregated rows.")

        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    generate_inference_csv()
