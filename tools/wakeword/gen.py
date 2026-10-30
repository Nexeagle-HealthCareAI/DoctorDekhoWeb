"""Synthetic training audio for "Hey Vita": positives and negatives from Kokoro (neural, 28 voices + blends) and espeak-ng
(Indian English, Hindi, Marathi, Nepali voices and variants). 16 kHz float32 .npy per clip under data/<split>/<kind>/.
Resumable: existing clips are skipped.  python gen.py [jobs]"""
import json
import os
import random
import sys
from multiprocessing import Pool

import numpy as np
import soxr

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data")
rng = random.Random(7)

POS_PHONEMES = [
    "hˈeɪ vˈiːɾə", "hˈeɪ vˈiːtə", "hˈeɪ vˈiːʈə", "hˈeː ʋˈiːʈaː", "hˈeː ʋˈiːʈa", "hˈeɪ ʋˈiːtaː", "hˈeɪ wˈiːʈaː",
    "hˈɛ vˈiːtə", "hˈeɪ, vˈiːtə!", "hˈeɪ vˈiːtɑː", "hˈeɪ vˈiːɾə?", "hˈeɪ ʋˈiːʈə", "hˈeː vˈiːʈaː",
    "hˈaɪ vˈiːtə", "hˈaɪ ʋˈiːʈaː", "hˈaɪ vˈiːɾə",
]
POS_TEXT_EN = ["Hey Vita", "Hey Vita!", "Hey, Vita.", "Hi Vita", "Hey Veeta", "Hey Veetah", "Hey Vita?"]
POS_TEXT_HI = ["हे वीटा", "हे विटा", "हाय वीटा", "हेय वीटा", "हे वीटा!", "हाय विटा"]

VAL_VOICES = {"af_nova", "am_echo", "bf_lily", "bm_lewis"}
ESPEAK_EN = ["en-us", "en", "en-029", "en-gb-x-rp", "en-gb-scotland", "en-gb-x-gbclan", "en-gb-x-gbcwmd"]
ESPEAK_IN = ["hi", "mr", "ne"]
VARIANTS = ["", "+m1", "+m2", "+m3", "+m4", "+m5", "+m6", "+m7", "+f1", "+f2", "+f3", "+f4", "+f5", "+klatt", "+klatt2",
            "+klatt3", "+croak", "+whisper", "+Andy", "+anika", "+aunty", "+david", "+edward", "+grandma", "+Mike", "+steph"]
VAL_VARIANTS = {"+m6", "+f4", "+klatt3", "+aunty", "+steph"}


def lines(name):
    with open(os.path.join(HERE, "text", name), encoding="utf-8") as f:
        return [l.strip() for l in f if l.strip()]


def random_words(n):
    with open(os.path.join(os.path.dirname(__import__("misaki").__file__), "data", "us_gold.json"), encoding="utf-8") as f:
        words = [w for w in json.load(f) if w.isalpha() and w.islower() and 2 < len(w) < 11]
    r = random.Random(11)
    return [" ".join(r.choice(words) for _ in range(r.randint(4, 12))) for _ in range(n)]


def jobs():
    import numpy as _np
    voices = sorted(_np.load(os.path.join(HERE, "kokoro/voices.npz")).files)
    train_v = [v for v in voices if v not in VAL_VOICES]
    val_v = sorted(VAL_VOICES)

    def blends(pool, n, seed):
        r = random.Random(seed)
        out = []
        for _ in range(n):
            k = r.choice([2, 2, 3])
            names = r.sample(pool, k)
            w = [r.random() + 0.2 for _ in names]
            s = sum(w)
            out.append(tuple((nm, wi / s) for nm, wi in zip(names, w)))
        return out

    spk = {"train": [((v, 1.0),) for v in train_v] + blends(train_v, 48, 1),
           "val": [((v, 1.0),) for v in val_v] + blends(val_v, 8, 2)}
    J = []

    def k(split, kind, i, text, phon, lang=None):
        sp = rng.choice(spk[split])
        J.append(dict(engine="kokoro", split=split, kind=kind, id=f"k{i:05d}", text=text, phonemes=phon, lang=lang or rng.choice(["en-us", "en-gb"]),
                      speaker=sp, speed=round(rng.uniform(0.8, 1.25), 2)))

    def e(split, kind, i, text, langs, variants):
        J.append(dict(engine="espeak", split=split, kind=kind, id=f"e{i:05d}", text=text, voice=rng.choice(langs) + rng.choice(variants),
                      rate=rng.randint(120, 210), pitch=rng.randint(25, 80), range=rng.randint(20, 90)))

    tv = [v for v in VARIANTS if v not in VAL_VARIANTS]
    vv = sorted(VAL_VARIANTS)
    i = 0
    for split, n in (("train", 1500), ("val", 200)):
        for _ in range(n):
            i += 1
            if rng.random() < 0.65:
                k(split, "pos", i, None, rng.choice(POS_PHONEMES))
            else:
                k(split, "pos", i, rng.choice(POS_TEXT_EN), None)
        for _ in range(n // 3):
            i += 1
            if rng.random() < 0.5:
                e(split, "pos", i, rng.choice(POS_TEXT_EN), ESPEAK_EN, tv if split == "train" else vv)
            else:
                e(split, "pos", i, rng.choice(POS_TEXT_HI), ESPEAK_IN, tv if split == "train" else vv)
    adv, en, hi, hing = lines("adversarial.txt"), lines("english.txt"), lines("hindi.txt"), lines("hinglish.txt")
    rnd = random_words(500)
    for split, reps in (("train", 1.0), ("val", 0.2)):
        def n(x):
            return max(1, int(x * reps))
        for t in adv:
            for _ in range(n(14)):
                i += 1
                k(split, "adv", i, t, None)
            for _ in range(n(10)):
                i += 1
                e(split, "adv", i, t, ESPEAK_EN, tv if split == "train" else vv)
        for t in en:
            for _ in range(n(5)):
                i += 1
                k(split, "speech", i, t, None)
            for _ in range(n(3)):
                i += 1
                e(split, "speech", i, t, ESPEAK_EN, tv if split == "train" else vv)
        for t in hing:
            for _ in range(n(5)):
                i += 1
                k(split, "speech", i, t, None)
        for t in hi:
            for _ in range(n(10)):
                i += 1
                e(split, "speech", i, t, ESPEAK_IN, tv if split == "train" else vv)
        for t in (rnd[:400] if split == "train" else rnd[400:]):
            i += 1
            if rng.random() < 0.5:
                k(split, "speech", i, t, None)
            else:
                e(split, "speech", i, t, ESPEAK_EN, tv if split == "train" else vv)
    return J


_kokoro = None


def run(job):
    global _kokoro
    d = os.path.join(OUT, job["split"], job["kind"])
    path = os.path.join(d, job["id"] + ".npy")
    if os.path.exists(path):
        return 0
    os.makedirs(d, exist_ok=True)
    try:
        if job["engine"] == "kokoro":
            if _kokoro is None:
                from kokoro_onnx import Kokoro
                import onnxruntime as ort
                so = ort.SessionOptions()
                so.intra_op_num_threads = 1
                so.inter_op_num_threads = 1
                _kokoro = Kokoro.from_session(ort.InferenceSession("kokoro/model_q8.onnx", so), "kokoro/voices.npz")
                _kokoro.voices = dict(np.load("kokoro/voices.npz"))
            style = sum(w * _kokoro.voices[n] for n, w in job["speaker"])
            if job["phonemes"]:
                a, sr = _kokoro.create(job["phonemes"], voice=style, speed=job["speed"], is_phonemes=True)
            else:
                a, sr = _kokoro.create(job["text"], voice=style, speed=job["speed"], lang=job["lang"])
        else:
            import espeak
            a = espeak.say(job["text"], job["voice"], job["rate"], job["pitch"], job["range"])
            sr = espeak.SAMPLE_RATE
    except Exception as ex:                                   # an unknown espeak variant, an odd phoneme: skip the clip
        print("skip", job["id"], job.get("voice"), type(ex).__name__, ex, flush=True)
        return 0
    if len(a) < sr * 0.2:
        return 0
    a16 = soxr.resample(np.asarray(a, dtype=np.float32), sr, 16000).astype(np.float32)
    a16 /= max(1e-4, float(np.abs(a16).max()))
    np.save(path, a16 * 0.8)
    return 1


if __name__ == "__main__":
    os.chdir(HERE)
    J = jobs()
    rng2 = random.Random(3)
    rng2.shuffle(J)
    print(len(J), "clips;", sum(j["engine"] == "kokoro" for j in J), "kokoro", flush=True)
    with open(os.path.join(HERE, "jobs.json"), "w") as f:
        json.dump(J, f)
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    done = 0
    with Pool(n) as p:
        for k_, r in enumerate(p.imap_unordered(run, J, chunksize=8)):
            done += r
            if k_ % 200 == 0:
                print(k_, done, flush=True)
    print("done", done)
