#!/usr/bin/env bash
# Sets up the "Hey Vita" training kit: Python packages, the Kokoro voice model and voices, and openWakeWord's feature models.
# Everything comes from pip and npm (no Hugging Face needed). Run from tools/wakeword/.
set -euo pipefail
cd "$(dirname "$0")"
python3 -m venv .venv
. .venv/bin/activate
pip install -q -r requirements.txt
mkdir -p kokoro feat .npm
( cd .npm && npm pack -q kokoro-q8-shards@1.0.0 kokoro-local-runtime@0.1.0 openwakeword-wasm-browser@0.1.1 >/dev/null
  for f in *.tgz; do mkdir -p "${f%.tgz}" && tar xzf "$f" -C "${f%.tgz}"; done )
cat .npm/kokoro-q8-shards-1.0.0/package/kokoro-q8.part{0,1,2,3,4,5}.bin > kokoro/model_q8.onnx
echo "fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478  kokoro/model_q8.onnx" | sha256sum -c -
python - <<'PY'
import glob, os, numpy as np
vs = {os.path.basename(f)[:-4]: np.fromfile(f, dtype=np.float32).reshape(510, 1, 256)
      for f in glob.glob(".npm/kokoro-local-runtime-0.1.0/package/voices/*.bin")}
np.savez("kokoro/voices.npz", **vs)
print(len(vs), "Kokoro voices")
PY
cp .npm/openwakeword-wasm-browser-0.1.1/package/models/{melspectrogram,embedding_model}.onnx feat/
cmp feat/melspectrogram.onnx ../../public/wakeword/melspectrogram.onnx && cmp feat/embedding_model.onnx ../../public/wakeword/embedding_model.onnx
echo "ready: python gen.py 2 && python features.py train && python features.py val && python train.py"
