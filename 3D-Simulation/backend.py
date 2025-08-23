import os
import json
import cv2
import torch
import torchaudio
import asyncio
import websockets
import base64
import random
from glob import glob
from torchvision import models
from ultralytics import YOLO
import torch.nn as nn
from datetime import datetime

# ─── PATH SETUP ────────────────────────────────────────────────────────────────
ROOT = os.getcwd()
MODEL_PATHS = {
    "image":   os.path.join(ROOT, "models", "image.pt"),
    "thermal": os.path.join(ROOT, "models", "thermal.pt"),
    "audio":   os.path.join(ROOT, "models", "screaming_detector_gpu.pth"),
}
TEST_DATA_PATHS = {
    "image": {
        "Human Detected": os.path.join(ROOT, "test_data/image/human"),
        "No Human":       os.path.join(ROOT, "test_data/image/no_human"),
    },
    "thermal": {
        "Human Detected": os.path.join(ROOT, "test_data/thermal/human"),
        "No Human":       os.path.join(ROOT, "test_data/thermal/no_human"),
    },
    "audio": {
        "Human Detected": os.path.join(ROOT, "test_data/audio/human"),
        "No Human":       os.path.join(ROOT, "test_data/audio/no_human"),
    },
}

# ─── MODELS & CACHING ─────────────────────────────────────────────────────────
class AudioClassifier(nn.Module):
    def __init__(self):
        super().__init__()
        self.backbone = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        self.backbone.conv1 = nn.Conv2d(1, 64, 7, 2, 3, bias=False)
        in_f = self.backbone.fc.in_features
        self.backbone.fc = nn.Linear(in_f, 2)
    def forward(self, x):
        return self.backbone(x)

yolo_models = {}
audio_model = None

def load_yolo(mtype):
    if mtype not in yolo_models:
        yolo_models[mtype] = YOLO(MODEL_PATHS[mtype])
    return yolo_models[mtype]

def load_audio():
    global audio_model
    if audio_model is None:
        audio_model = AudioClassifier()
        audio_model.load_state_dict(torch.load(MODEL_PATHS["audio"], map_location="cpu"))
        audio_model.eval()
    return audio_model

# ─── HELPERS ───────────────────────────────────────────────────────────────────
def pick_file(mtype, status, ext="*.jpg"):
    folder = TEST_DATA_PATHS[mtype][status]
    files = glob(os.path.join(folder, ext))
    return random.choice(files) if files else None

def encode_img(path, model):
    res = model(path)
    img = res[0].plot()
    _, buf = cv2.imencode(".png", img)
    return base64.b64encode(buf).decode()

def classify_audio_file(path):
    wave, sr = torchaudio.load(path)
    target, dur = 22050, 22050 * 3
    if sr != target:
        wave = torchaudio.transforms.Resample(sr, target)(wave)
    wave = wave.mean(dim=0, keepdim=True) if wave.ndim > 1 else wave
    if wave.shape[-1] < dur:
        wave = torch.nn.functional.pad(wave, (0, dur - wave.shape[-1]))
    else:
        wave = wave[..., :dur]
    mel = torchaudio.transforms.MelSpectrogram(sample_rate=target, n_mels=64)(wave)
    spec = torch.log(mel + 1e-9).unsqueeze(0)
    out = load_audio()(spec)
    return "Human Detected" if int(out.argmax()) == 1 else "No Human"

# ─── WEBSOCKET HANDLER ─────────────────────────────────────────────────────────
# Keep previous imports and setup, modify handler:
async def handler(ws):
    print("🛰️  Client connected")
    try:
        while True:
            # Simulate random detection status every 2-5 seconds
            await asyncio.sleep(random.uniform(2, 5))
            detect = random.choice([True, False])
            status = "Human Detected" if detect else "No Human"

            # Get sample data
            img_f = pick_file("image", status)
            th_f = pick_file("thermal", status)
            aud_f = pick_file("audio", status, ext="*.wav")

            # Process data
            img_b = encode_img(img_f, load_yolo("image")) if img_f else None
            th_b = encode_img(th_f, load_yolo("thermal")) if th_f else None
            aud_r = classify_audio_file(aud_f) if aud_f else status

            payload = {
                "image": img_b,
                "thermal": th_b,
                "audio": aud_r,
                "timestamp": datetime.now().isoformat()
            }
            await ws.send(json.dumps(payload))
            print(f"↩️  Sent {status}")

    except websockets.exceptions.ConnectionClosedOK:
        print("Client disconnected")

# ─── SERVER STARTUP ────────────────────────────────────────────────────────────
async def main():
    server = await websockets.serve(handler, "localhost", 8765)
    print("✅  WS listening on ws://localhost:8765")
    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())