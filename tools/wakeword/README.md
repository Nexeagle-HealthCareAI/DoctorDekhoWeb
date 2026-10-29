# "Hey Vita" wake word: training kit

Vita can listen for **"Hey Vita"** on the patient's device (Doctor Dekho, off unless the patient turns it on in the chat menu).
Detection runs entirely in the browser: `public/wakeword/` holds the models, `src/lib/wakeword/` the engine. Nothing is sent
anywhere until the wake word is heard; then the normal voice conversation starts.

This folder builds `public/wakeword/hey_vita.onnx`. It follows [openWakeWord](https://github.com/dscripka/openWakeWord)'s
design: its melspectrogram and speech-embedding models (Apache-2.0) turn audio into features, and a small classifier of our own
decides "Hey Vita or not". Only the classifier is trained here.

## How the model is made

1. `gen.py`: synthetic speech, all from pip / npm (no Hugging Face):
   - **Kokoro-82M** (Apache-2.0, from the npm packages `kokoro-q8-shards` and `kokoro-local-runtime`): 28 US / UK voices,
     plus 56 new "speakers" made by mixing voice styles, at speeds 0.8 to 1.25x.
   - **espeak-ng** (from the `espeakng-loader` wheel): English (US, UK, Caribbean, Scottish, Welsh), Hindi, Marathi and Nepali
     voices in 26 variants.
   - Positives: "Hey Vita" / "Hi Vita" written in phonemes as Indian, American and British speakers say it (ʋ for v, retroflex ʈ,
     long aː), and in Devanagari for the Hindi voices.
   - Negatives: near-misses that must not wake Vita (`text/adversarial.txt`: Hey Rita, Kavita, Savita, Babita, vitamin,
     Hey Siri...), everyday English, Hindi and Hinglish sentences (`text/*.txt`), and random word strings.
   - Four Kokoro voices and five espeak variants are never used for training; they are the test set.
2. `features.py`: each clip is put in a simulated room (pyroomacoustics), mixed with noise (white, pink, brown, mains hum,
   fan, babble made of other speech) at 0 to 30 dB SNR, band-limited like a phone mic or a 48 kHz browser mic, with speech
   before and after. Then it runs through the exact streaming pipeline the browser uses (`oww.py`).
3. `train.py`: a small network (1536 -> 96 -> 96 -> 1), numpy only. It prints, for each threshold, the share of held-out
   "Hey Vita"s detected and the false wakes on held-out speech and noise, and writes `out/hey_vita.onnx` and `out/report.json`.
4. `parity.py`: writes `src/lib/wakeword/parity.fixture.json`; the Vitest test checks the browser engine gives the same scores
   as this pipeline.

## Improving it with real voices (recommended)

Synthetic voices get the model started; real people are what make it reliable. The more speakers (men, women, older people,
different languages and accents), phones and rooms, the better.

1. Open `recorder.html` in Chrome on a laptop or phone (it can be opened straight from the file). Each person enters a code
   (no names), presses Start and follows the prompts: 30 x "Hey Vita" and 15 other phrases, about 4 minutes. "Save .tar" saves
   the clips; nothing is uploaded.
2. Put all the .tar files in one folder and unpack them: `for f in *.tar; do tar xf "$f" -C real/; done` gives
   `real/pos/*.wav` and `real/neg/*.wav`.
3. Keep a few speakers aside for testing: move their files to `real-val/pos` and `real-val/neg`.
4. Retrain:

```bash
./setup.sh                       # once: Python packages, Kokoro, feature models (from pip and npm)
. .venv/bin/activate
python gen.py 2                  # synthetic clips (about an hour on 2 CPUs; resumable)
python features.py train 3 real
python features.py val 2 real-val
python train.py 20000
python parity.py out/hey_vita.onnx ../../src/lib/wakeword/parity.fixture.json
cp out/hey_vita.onnx ../../public/wakeword/hey_vita.onnx
```

5. Pick the threshold from `out/report.json`: the lowest threshold whose false wakes on speech stay near zero, and put it in
   `public/wakeword/hey_vita.json`. Then run `npm test` (the parity test) and try it with `?wakedebug=1` on the site,
   which shows the live score in the corner.

## Licences

- openWakeWord's feature models (`melspectrogram.onnx`, `embedding_model.onnx`): Apache-2.0. Its ready-made wake-word models
  are CC BY-NC-SA and are **not** used.
- Kokoro-82M: Apache-2.0. espeak-ng: GPL-3.0, used only to make training audio, not shipped.
- `hey_vita.onnx` is trained here and is ours.
