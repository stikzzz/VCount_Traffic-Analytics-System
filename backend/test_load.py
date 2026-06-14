import os
from tensorflow.keras.models import load_model
from tensorflow.keras.layers import Dense

class CustomDense(Dense):
    def __init__(self, **kwargs):
        kwargs.pop('quantization_config', None)
        super().__init__(**kwargs)

model = load_model(r'd:\Users\Chin Zhen Ang\Documents\USM CS\Y4S2\FYPProject\lstmModel\traffic_lstm_model.h5', custom_objects={'Dense': CustomDense}, compile=False)
print('Success')
print('Input shape:', model.input_shape)
