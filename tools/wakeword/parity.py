"""Writes the browser parity fixture: one "Hey Vita" clip and the score the trained model gives after every 80 ms frame, computed
the way the browser does. src/lib/wakeword/core.test.ts checks the TypeScript engine gives the same scores.
  python parity.py out/hey_vita.onnx ../../src/lib/wakeword/parity.fixture.json"""
import base64
import json
import sys

import numpy as np
import onnxruntime as ort
import soxr

import oww

model, out = sys.argv[1], sys.argv[2]
from kokoro_onnx import Kokoro
k = Kokoro("kokoro/model_q8.onnx", "kokoro/voices.npz")
a, sr = k.create("hˈeɪ vˈiːtə", voice="af_nova", speed=1.0, is_phonemes=True)
a = soxr.resample(a, sr, 16000).astype(np.float32)
x = np.concatenate([np.zeros(16000, np.float32), a / np.abs(a).max() * 0.7, np.zeros(8000, np.float32)])
x = x[: len(x) // oww.FRAME * oww.FRAME]
pcm = (x * 32767).astype(np.int16)
x = pcm.astype(np.float32) / 32767
emb = oww.stream_embeddings(x)
w = oww.windows16(emb)
s = ort.InferenceSession(model)
scores = [None] * 15 + [float(s.run(None, {"x": w[i:i + 1]})[0][0, 0]) for i in range(len(w))]
json.dump({"pcm16": base64.b64encode(pcm.tobytes()).decode(), "scores": scores}, open(out, "w"))
print(len(pcm) / 16000, "s, max score", max(v for v in scores if v is not None))
