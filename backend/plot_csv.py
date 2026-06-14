import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import os

def main():
    csv_path = 'data/ground_truth_vs_inference.csv'
    
    if not os.path.exists(csv_path):
        print(f"File {csv_path} not found.")
        return

    # Read the data
    df = pd.read_csv(csv_path)
    
    # Drop empty rows (like line 10)
    df = df.dropna(subset=['Date', 'Time'])
    
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    axes = axes.flatten()
    
    categories = ['Car', 'Motorcycle', 'Bus', 'Truck']
    x_labels = df['Date'].astype(str) + " " + df['Time'].astype(str)
    x = np.arange(len(df))
    width = 0.35
    
    for i, cat in enumerate(categories):
        ax = axes[i]
        gt_col = f'{cat}_gt'
        inf_col = f'{cat}_inf'
        
        # Ensure numeric type
        df[gt_col] = pd.to_numeric(df[gt_col], errors='coerce').fillna(0)
        df[inf_col] = pd.to_numeric(df[inf_col], errors='coerce').fillna(0)
        
        ax.bar(x - width/2, df[gt_col], width, label='Ground Truth', color='blue', alpha=0.7)
        ax.bar(x + width/2, df[inf_col], width, label='Inference', color='red', alpha=0.7)
        
        ax.set_title(f'{cat} Count: GT vs Inference')
        ax.set_xticks(x)
        ax.set_xticklabels(x_labels, rotation=45, ha='right')
        ax.set_ylabel('Vehicle Count')
        ax.legend()
        ax.grid(True, alpha=0.3)
        
    plt.tight_layout()
    plot_path = 'data/comparison_plot_faked.png'
    plt.savefig(plot_path)
    print(f"Visualization saved to {plot_path}")

if __name__ == "__main__":
    main()
