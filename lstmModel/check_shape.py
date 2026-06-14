from tensorflow.keras.models import load_model
from tensorflow.keras.layers import Dense

class CustomDense(Dense):
    def __init__(self, *args, **kwargs):
        kwargs.pop('quantization_config', None)
        super().__init__(*args, **kwargs)

try:
    m = load_model('traffic_lstm_model.keras', custom_objects={'Dense': CustomDense}, compile=False)
except:
    m = load_model('traffic_lstm_model.h5', custom_objects={'Dense': CustomDense}, compile=False)

print('Input shape:', m.input_shape)
