"""Augmented feature windows for training: positives ("Hey Vita" with room echo, noise, mic colouring, speech before and after)
and negative streams (other speech, near-misses, noise). Writes feats/<split>.npz.
  python features.py [train|val] [copies] [extra wav dir with real recordings: <dir>/pos/*.wav, <dir>/neg/*.wav]"""
import glob
import os
import sys

import numpy as np
import soxr
from scipy.signal import fftconvolve, butter, sosfilt

import oww

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 16000


# Said like "Hey Vita" by some speakers (v/w merge): neither positive nor negative, so not used.
AMBIGUOUS = {"hey we tah", "hey with a"}


def load_dir(split, kind):
    import json
    texts = {}
    jobs = os.path.join(HERE, "jobs.json")
    if os.path.exists(jobs):
        with open(jobs) as f:
            texts = {j["id"]: (j.get("text") or "").lower() for j in json.load(f)}
    files = sorted(glob.glob(os.path.join(HERE, "data", split, kind, "*.npy")))
    return [np.load(f) for f in files if texts.get(os.path.basename(f)[:-4], "") not in AMBIGUOUS]


def load_wavs(d):
    import soundfile as sf
    out = []
    for f in sorted(glob.glob(os.path.join(d, "*.wav"))):
        a, sr = sf.read(f, dtype="float32", always_2d=True)
        a = a.mean(axis=1)
        if sr != SR:
            a = soxr.resample(a, sr, SR).astype(np.float32)
        out.append(a / max(1e-4, float(np.abs(a).max())) * 0.8)
    return out


def make_rirs(n, seed):
    import pyroomacoustics as pra
    r = np.random.default_rng(seed)
    rirs = []
    while len(rirs) < n:
        dims = r.uniform([2.5, 2.5, 2.4], [9, 8, 3.5])
        rt60 = r.uniform(0.15, 0.8)
        try:
            absorption, max_order = pra.inverse_sabine(rt60, dims)
        except ValueError:
            continue
        room = pra.ShoeBox(dims, fs=SR, materials=pra.Material(absorption), max_order=min(max_order, 12))
        src = r.uniform([0.5, 0.5, 1.0], dims - [0.5, 0.5, 0.4])
        mic = r.uniform([0.5, 0.5, 0.7], dims - [0.5, 0.5, 0.6])
        room.add_source(src)
        room.add_microphone(mic)
        room.compute_rir()
        h = np.asarray(room.rir[0][0], dtype=np.float32)
        rirs.append(h / max(1e-6, float(np.abs(h).max())))
    return rirs


class Aug:
    def __init__(self, seed, rirs, babble_pool):
        self.r = np.random.default_rng(seed)
        self.rirs = rirs
        self.babble = babble_pool

    def noise(self, n):
        r = self.r
        kind = r.choice(["white", "pink", "brown", "hum", "babble", "fan"], p=[0.15, 0.2, 0.15, 0.1, 0.3, 0.1])
        if kind == "babble" and self.babble:
            out = np.zeros(n, np.float32)
            for _ in range(r.integers(3, 7)):
                c = self.babble[r.integers(len(self.babble))]
                c = np.tile(c, int(np.ceil(n / len(c))) + 1)
                s = r.integers(0, len(c) - n)
                out += c[s:s + n] * r.uniform(0.3, 1.0)
            return out
        w = r.standard_normal(n).astype(np.float32)
        if kind == "white":
            return w
        if kind in ("pink", "brown", "fan"):
            spec = np.fft.rfft(w)
            f = np.arange(len(spec)) + 1.0
            spec /= np.sqrt(f) if kind == "pink" else f if kind == "brown" else (1 + (f / (len(f) * 0.05)) ** 2)
            return np.fft.irfft(spec, n).astype(np.float32)
        t = np.arange(n) / SR
        base = r.choice([50.0, 100.0])
        return sum(np.sin(2 * np.pi * base * k * t + r.uniform(0, 6)) / k for k in range(1, 6)).astype(np.float32) + 0.05 * w

    def room(self, x):
        if self.r.random() < 0.55:
            h = self.rirs[self.r.integers(len(self.rirs))]
            y = fftconvolve(x, h)[: len(x)].astype(np.float32)
            return y / max(1e-4, float(np.abs(y).max())) * float(np.abs(x).max() or 1)
        return x

    def colour(self, x):
        r = self.r
        if r.random() < 0.35:                       # phone / cheap mic: band-limited
            lo, hi = r.uniform(80, 300), r.uniform(3400, 7600)
            x = sosfilt(butter(4, [lo, hi], btype="band", fs=SR, output="sos"), x).astype(np.float32)
        if r.random() < 0.2:                       # browser 48k -> 16k path (box average), mimicking the worklet
            up = soxr.resample(x, SR, 48000)
            x = up[: len(up) // 3 * 3].reshape(-1, 3).mean(axis=1).astype(np.float32)
        return x

    def mix(self, x, snr_lo=0, snr_hi=30, p=0.85):
        if self.r.random() < p:
            nz = self.noise(len(x))
            ps = float(np.mean(x ** 2)) + 1e-9
            pn = float(np.mean(nz ** 2)) + 1e-9
            snr = self.r.uniform(snr_lo, snr_hi)
            x = x + nz * np.sqrt(ps / (pn * 10 ** (snr / 10)))
        g = 10 ** (self.r.uniform(-30, 0) / 20)     # quiet to loud
        return np.clip(x / max(1e-4, float(np.abs(x).max())) * g, -1, 1).astype(np.float32)


def positive_windows(clips, aug: Aug, copies, fillers):
    """Each clip placed after 1-2 s of noise or other speech; the windows ending 0-320 ms after it are positives."""
    X = []
    groups = []                                     # which stream each window came from (for recall per utterance)
    g = 0
    r = aug.r
    for c in clips:
        for _ in range(copies):
            c2 = aug.colour(aug.room(c * r.uniform(0.5, 1.0)))
            pre_n = int(r.uniform(1.0, 2.0) * SR)
            if r.random() < 0.35 and fillers:
                f = fillers[r.integers(len(fillers))]
                pre = np.concatenate([np.zeros(max(0, pre_n - len(f)), np.float32), f[-pre_n:] * r.uniform(0.3, 1.0)])
                pre = pre[-pre_n:]
                gap = np.zeros(int(r.uniform(0.05, 0.5) * SR), np.float32)
                pre = np.concatenate([pre, gap])
            else:
                pre = np.zeros(pre_n, np.float32)
            post_n = int(0.4 * SR)
            if r.random() < 0.3 and fillers:
                f = fillers[r.integers(len(fillers))]
                post = np.concatenate([np.zeros(int(r.uniform(0.0, 0.25) * SR), np.float32), f])[:post_n]
                post = np.pad(post, (0, post_n - len(post)))
            else:
                post = np.zeros(post_n, np.float32)
            # end of speech in the clip (trim TTS silence)
            env = np.abs(c2) > 0.02 * np.abs(c2).max()
            end = int(np.nonzero(env)[0][-1]) + 1 if env.any() else len(c2)
            x = np.concatenate([pre, c2[:end], post])
            x = aug.mix(x)
            emb = oww.stream_embeddings(x)
            w = oww.windows16(emb)
            end_frame = (len(pre) + end) / oww.FRAME          # window i ends after frame i+15
            idx = [i for i in range(len(w)) if end_frame - 0.5 <= i + 16 <= end_frame + 4.5]
            if idx:
                X.append(w[idx])
                groups += [g] * len(idx)
                g += 1
    return np.concatenate(X).astype(np.float16), np.array(groups)


def negative_streams(clips, aug: Aug, seconds, copies):
    """Other speech and near-misses one after another, with pauses, in a room, with noise: every window is a negative."""
    X = []
    r = aug.r
    total = 0.0
    order = []
    for _ in range(copies):
        order += list(r.permutation(len(clips)))
    i = 0
    while i < len(order):
        parts = []
        n = 0
        while n < seconds * SR and i < len(order):
            c = aug.colour(aug.room(clips[order[i]] * r.uniform(0.4, 1.0)))
            parts += [c, np.zeros(int(r.uniform(0.1, 1.0) * SR), np.float32)]
            n += len(c) + len(parts[-1])
            i += 1
        x = aug.mix(np.concatenate(parts), snr_lo=-5, snr_hi=30, p=0.9)
        total += len(x) / SR
        X.append(oww.windows16(oww.stream_embeddings(x)))
    return np.concatenate(X).astype(np.float16), total


def noise_streams(aug: Aug, minutes):
    X = []
    for _ in range(int(minutes * 2)):
        x = aug.noise(30 * SR)
        x = aug.mix(x * 0.1, p=0.0)
        X.append(oww.windows16(oww.stream_embeddings(x)))
    return np.concatenate(X).astype(np.float16)


if __name__ == "__main__":
    split = sys.argv[1] if len(sys.argv) > 1 else "train"
    copies = int(sys.argv[2]) if len(sys.argv) > 2 else (3 if split == "train" else 2)
    extra = sys.argv[3] if len(sys.argv) > 3 else None
    seed = 1 if split == "train" else 2
    pos = load_dir(split, "pos")
    adv = load_dir(split, "adv")
    speech = load_dir(split, "speech")
    if extra:
        pos += load_wavs(os.path.join(extra, "pos"))
        speech += load_wavs(os.path.join(extra, "neg"))
    print(split, len(pos), "pos", len(adv), "adv", len(speech), "speech", flush=True)
    rirs = make_rirs(150 if split == "train" else 40, seed)
    aug = Aug(seed, rirs, speech)
    Xp, gp = positive_windows(pos, aug, copies, speech + adv)
    print("pos windows", Xp.shape, flush=True)
    # near-misses placed exactly like the positives ("Hey Neeta" ending where "Hey Vita" would): the windows that matter most
    Xh, gh = positive_windows(adv, aug, copies, speech)
    print("hard negative windows", Xh.shape, flush=True)
    Xa, ta = negative_streams(adv, aug, 20, 3 if split == "train" else 2)
    print("adv windows", Xa.shape, round(ta / 3600, 2), "h", flush=True)
    Xs, ts = negative_streams(speech, aug, 30, 2 if split == "train" else 1)
    print("speech windows", Xs.shape, round(ts / 3600, 2), "h", flush=True)
    Xn = noise_streams(aug, 20 if split == "train" else 5)
    print("noise windows", Xn.shape, flush=True)
    os.makedirs(os.path.join(HERE, "feats"), exist_ok=True)
    np.savez(os.path.join(HERE, "feats", f"{split}.npz"), pos=Xp, pos_groups=gp, hard=Xh, hard_groups=gh, adv=Xa, adv_hours=ta / 3600, speech=Xs,
             speech_hours=ts / 3600, noise=Xn)
