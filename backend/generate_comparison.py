import pandas as pd
import matplotlib.pyplot as plt
import os
import numpy as np

def main():
    # Load data
    gt_path = 'data/ground_truth.csv'
    inf_path = 'data/inference.csv'
    
    if not os.path.exists(gt_path) or not os.path.exists(inf_path):
        print("Required CSV files not found in 'data/' directory.")
        return

    gt_df = pd.read_csv(gt_path)
    inf_df = pd.read_csv(inf_path)

    # Clean ground truth
    gt_df = gt_df.dropna(subset=['motorcycle', 'car', 'bus', 'truck'])
    
    # Filter for the specific direction matching T44F1
    gt_df = gt_df[gt_df['direction'] == 'JalanPRamlee']
    
    # Group by date and time
    gt_grouped = gt_df.groupby(['date', 'time'])[['car', 'motorcycle', 'bus', 'truck']].sum().reset_index()
    
    # Rename columns to match
    gt_grouped.rename(columns={
        'date': 'Date',
        'time': 'Time',
        'car': 'Car_gt',
        'motorcycle': 'Motorcycle_gt',
        'bus': 'Bus_gt',
        'truck': 'Truck_gt'
    }, inplace=True)
    
    # Calculate Total_gt
    gt_grouped['Total_gt'] = gt_grouped['Car_gt'] + gt_grouped['Motorcycle_gt'] + gt_grouped['Bus_gt'] + gt_grouped['Truck_gt']

    # Filter inference for T44F1
    inf_df = inf_df[inf_df['Junction'] == 'T44F1']

    # Group inference data
    inf_grouped = inf_df.groupby(['Date', 'Time'])[['Car', 'Motorcycle', 'Bus', 'Truck', 'Total']].sum().reset_index()
    inf_grouped.rename(columns={
        'Car': 'Car_inf',
        'Motorcycle': 'Motorcycle_inf',
        'Bus': 'Bus_inf',
        'Truck': 'Truck_inf',
        'Total': 'Total_inf'
    }, inplace=True)

    # Merge
    merged_df = pd.merge(gt_grouped, inf_grouped, on=['Date', 'Time'], how='inner')
    
    # Check if empty
    if merged_df.empty:
        print("No overlapping data found between ground truth and inference.")
        return

    # Calculate errors
    merged_df['Total_Error'] = merged_df['Total_inf'] - merged_df['Total_gt']
    merged_df['Total_Absolute_Error'] = abs(merged_df['Total_Error'])

    # Save to CSV
    output_csv = 'data/ground_truth_vs_inference.csv'
    merged_df.to_csv(output_csv, index=False)
    print(f"Comparison data saved to {output_csv}")

    # Visualization
    plot_comparison(merged_df)

def plot_comparison(df):
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    axes = axes.flatten()
    
    categories = ['Car', 'Motorcycle', 'Bus', 'Truck']
    x_labels = df['Date'] + " " + df['Time']
    x = np.arange(len(df))
    width = 0.35
    
    for i, cat in enumerate(categories):
        ax = axes[i]
        gt_col = f'{cat}_gt'
        inf_col = f'{cat}_inf'
        
        ax.bar(x - width/2, df[gt_col], width, label='Ground Truth', color='blue', alpha=0.7)
        ax.bar(x + width/2, df[inf_col], width, label='Inference', color='red', alpha=0.7)
        
        ax.set_title(f'{cat} Count: GT vs Inference')
        ax.set_xticks(x)
        ax.set_xticklabels(x_labels, rotation=45, ha='right')
        ax.set_ylabel('Vehicle Count')
        ax.legend()
        ax.grid(True, alpha=0.3)
        
    plt.tight_layout()
    
    plot_path = 'data/comparison_plot.png'
    plt.savefig(plot_path)
    print(f"Visualization saved to {plot_path}")

if __name__ == "__main__":
    main()
