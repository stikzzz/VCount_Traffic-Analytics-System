import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import joblib

from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping

# =========================
# 1. LOAD DATA & CLEAN
# =========================
df = pd.read_csv("traffic_output.csv")

if 'id' in df.columns:
    df = df.drop(columns=['id'])

# Drop rows with missing values
df = df.dropna().copy()

# =========================
# 2. FEATURE ENGINEERING
# =========================
df['date'] = pd.to_datetime(df['date'])
df['time_orig'] = pd.to_datetime(df['time'], format='%H:%M')

# Keep original direction for grouping sequences later
df['direction_orig'] = df['direction']

# Extract basic time features
df['hour'] = df['time_orig'].dt.hour
df['minute'] = df['time_orig'].dt.minute

# 2A. Is Weekend?
# dayofweek: Monday=0, Sunday=6
df['is_weekend'] = (df['date'].dt.dayofweek >= 5).astype(int)

# 2B. Cyclical Time Encoding
# Using sin/cos to represent the circular nature of 24 hours and 60 minutes
df['sin_hour'] = np.sin(2 * np.pi * df['hour'] / 23.0)
df['cos_hour'] = np.cos(2 * np.pi * df['hour'] / 23.0)

df['sin_min'] = np.sin(2 * np.pi * df['minute'] / 59.0)
df['cos_min'] = np.cos(2 * np.pi * df['minute'] / 59.0)

# 2C. Categorical Encoding for Day of Week
# Monday=1, Tuesday=2, ..., Sunday=7
df['day_of_week'] = df['date'].dt.dayofweek + 1

# 2D. One-Hot Encoding
# We treat 'timezone' and 'direction' as categorical variables
df = pd.get_dummies(df, columns=['timezone', 'direction'], drop_first=False)

# Drop original intermediate columns
df = df.drop(columns=['time', 'hour', 'minute'])

# Ensure boolean columns from get_dummies are ints
for col in df.columns:
    if df[col].dtype == bool:
        df[col] = df[col].astype(int)

# =========================
# 3. TRAIN / TEST SPLIT (CHRONOLOGICAL)
# =========================
# We split by Date to prevent data leakage (predicting the past using the future)

unique_dates = df['date'].sort_values().unique()
split_idx = int(len(unique_dates) * 0.8)
split_date = unique_dates[split_idx]

train_df = df[df['date'] < split_date].copy()
test_df = df[df['date'] >= split_date].copy()

print(f"Training up to date: {split_date}")
print(f"Testing from date: {split_date} onwards")

# =========================
# 4. SCALING
# =========================
target_cols = ['motorcycle', 'car', 'bus', 'truck']

# We only fit the scaler on the TRAINING data!
y_scaler = MinMaxScaler()
train_df[target_cols] = y_scaler.fit_transform(train_df[target_cols])
test_df[target_cols] = y_scaler.transform(test_df[target_cols])

# =========================
# 5. SEQUENCE GENERATION
# =========================
sequence_length = 4

def create_sequences(data_split):
    X_seq, y_seq = [], []
    
    # Exclude non-numeric grouping columns from the X features
    feature_cols = [c for c in data_split.columns if c not in ['date', 'time_orig', 'direction_orig']]
    
    # Group by direction to ensure sequences are strictly for the same location over time
    for direction in data_split['direction_orig'].unique():
        dir_df = data_split[data_split['direction_orig'] == direction].sort_values(by=['date', 'time_orig'])
        
        dir_values = dir_df[feature_cols].values
        dir_targets = dir_df[target_cols].values
        
        for i in range(sequence_length, len(dir_values)):
            # X includes ALL features (including lag historical traffic)
            X_seq.append(dir_values[i-sequence_length:i])
            # y is the target traffic counts for the current timestep
            y_seq.append(dir_targets[i])
            
    return np.array(X_seq), np.array(y_seq)

X_train, y_train = create_sequences(train_df)
X_test, y_test = create_sequences(test_df)

print("X_train shape:", X_train.shape)
print("y_train shape:", y_train.shape)

# =========================
# 6. BUILD LSTM MODEL
# =========================
model = Sequential()

model.add(
    LSTM(
        64,
        input_shape=(X_train.shape[1], X_train.shape[2]),
        return_sequences=False
    )
)

model.add(Dropout(0.2))
model.add(Dense(32, activation='relu'))

# Output layer predicting the 4 vehicle classes
model.add(Dense(4))

model.compile(
    optimizer='adam',
    loss='mse',
    metrics=['mae']
)

# =========================
# 7. TRAIN MODEL
# =========================
early_stop = EarlyStopping(
    monitor='val_loss',
    patience=10,
    restore_best_weights=True
)

history = model.fit(
    X_train,
    y_train,
    epochs=100,
    batch_size=16,
    validation_split=0.2,
    callbacks=[early_stop]
)

# =========================
# 8. EVALUATE & PREDICT
# =========================
loss, mae = model.evaluate(X_test, y_test)
print("\nTest Loss:", loss)
print("Test MAE:", mae)

predictions = model.predict(X_test)

# Convert back to original vehicle count scale
predictions_actual = y_scaler.inverse_transform(predictions)
y_test_actual = y_scaler.inverse_transform(y_test)

model.save("traffic_lstm_model.keras")
print("\nModel saved as traffic_lstm_model.keras")

joblib.dump(y_scaler, "y_scaler.pkl")
print("Scaler saved as y_scaler.pkl")

# =========================
# 9. PLOT RESULTS (TREND ANALYSIS)
# =========================
plt.figure(figsize=(14, 10))

# Plot 1: Training vs Validation Loss
plt.subplot(2, 1, 1)
plt.plot(history.history['loss'], label='Training Loss', color='blue', linewidth=2)
plt.plot(history.history['val_loss'], label='Validation Loss', color='orange', linewidth=2)
plt.xlabel("Epoch")
plt.ylabel("MSE Loss")
plt.title("Model Convergence: Training vs Validation Loss")
plt.legend()
plt.grid(True, linestyle='--', alpha=0.7)

# Plot 2: Actual vs Predicted Trend for 'Car'
# We'll plot a subset (e.g., first 150 points) so the trend is actually readable
subset_len = min(150, len(y_test_actual))

plt.subplot(2, 1, 2)
plt.plot(y_test_actual[:subset_len, 1], label='Actual Car Traffic', color='green', marker='o', markersize=4, linestyle='-', linewidth=2)
plt.plot(predictions_actual[:subset_len, 1], label='Predicted Car Traffic', color='red', marker='x', markersize=4, linestyle='--', linewidth=2)
plt.xlabel("Time Sequence (Test Set)")
plt.ylabel("Number of Cars")
plt.title(f"Traffic Trend Analysis (Cars): Actual vs Predicted (First {subset_len} samples)")
plt.legend()
plt.grid(True, linestyle='--', alpha=0.7)

plt.tight_layout()
plt.show()