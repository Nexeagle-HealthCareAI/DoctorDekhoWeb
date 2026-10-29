"""openWakeWord feature pipeline, streaming exactly as the browser runtime does it (src/lib/wakeword/engine.ts):
16 kHz audio in 1280-sample frames -> melspectrogram on the last 1280+480 samples -> mel/10+2 appended to a mel buffer
-> one embedding (96) from the last 76 mel frames per frame -> the wake model reads the last 16 embeddings."""
import os
import numpy as np
import onnxruntime as ort

HERE = os.path.dirname(os.path.abspath(__file__))
FRAME = 1280
_opts = ort.SessionOptions()
_opts.intra_op_num_threads = 1
_opts.inter_op_num_threads = 1
MEL = ort.InferenceSession(os.path.join(HERE, "feat/melspectrogram.onnx"), _opts)
EMB = ort.InferenceSession(os.path.join(HERE, "feat/embedding_model.onnx"), _opts)


def mel(samples_int16_scale: np.ndarray) -> np.ndarray:
    out = MEL.run(None, {"input": samples_int16_scale[None, :].astype(np.float32)})[0]
    return np.squeeze(out) / 10.0 + 2.0          # (frames, 32)


def stream_embeddings(audio: np.ndarray) -> np.ndarray:
    """audio: float32 in [-1, 1] at 16 kHz. Returns (n_frames, 96): the embedding after each 1280-sample frame."""
    x = (np.clip(audio, -1, 1) * 32767).astype(np.float32)
    n = len(x) // FRAME
    raw = np.zeros(480, dtype=np.float32)
    mels = np.ones((76, 32), dtype=np.float32)
    windows = []
    for i in range(n):
        chunk = x[i * FRAME:(i + 1) * FRAME]
        raw = np.concatenate([raw, chunk])[-(FRAME + 480):]
        mels = np.vstack([mels, mel(raw)])[-(76 + 200):]
        windows.append(mels[-76:])
    if not windows:
        return np.zeros((0, 96), dtype=np.float32)
    w = np.stack(windows)[:, :, :, None].astype(np.float32)
    out = []
    for b in range(0, len(w), 256):
        out.append(EMB.run(None, {"input_1": w[b:b + 256]})[0].reshape(-1, 96))
    return np.concatenate(out)


def windows16(emb: np.ndarray) -> np.ndarray:
    """(n, 96) -> (n-15, 16, 96): what the wake model sees after each frame."""
    if len(emb) < 16:
        return np.zeros((0, 16, 96), dtype=np.float32)
    idx = np.arange(16)[None, :] + np.arange(len(emb) - 15)[:, None]
    return emb[idx]
