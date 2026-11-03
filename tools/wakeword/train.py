"""Train the "Hey Vita" classifier on the feature windows (feats/train.npz), check it on held-out voices (feats/val.npz), and
export hey_vita.onnx: input [1, 16, 96] (16 embeddings) -> score [1, 1]. Plain numpy (Adam), so it runs anywhere.
  python train.py [steps]"""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(0)
H = 96


def init(n_in, n_out):
    return {"W": (rng.standard_normal((n_in, n_out)) * np.sqrt(2 / n_in)).astype(np.float32), "b": np.zeros(n_out, np.float32)}


def forward(P, x, drop=0.0):
    a1 = x @ P[0]["W"] + P[0]["b"]
    m1 = (rng.random(a1.shape) >= drop) / (1 - drop) if drop else 1.0
    h1 = np.maximum(a1, 0) * m1
    a2 = h1 @ P[1]["W"] + P[1]["b"]
    m2 = (rng.random(a2.shape) >= drop) / (1 - drop) if drop else 1.0
    h2 = np.maximum(a2, 0) * m2
    z = (h2 @ P[2]["W"] + P[2]["b"])[:, 0]
    return z, (x, a1, h1, a2, h2, m1, m2)


def sigmoid(z):
    return 1 / (1 + np.exp(-np.clip(z, -30, 30)))


def backward(P, cache, dz):
    x, a1, h1, a2, h2, m1, m2 = cache
    g = [None, None, None]
    dz = dz[:, None]
    g[2] = {"W": h2.T @ dz, "b": dz.sum(0)}
    dh2 = dz @ P[2]["W"].T
    da2 = dh2 * (a2 > 0) * m2
    g[1] = {"W": h1.T @ da2, "b": da2.sum(0)}
    dh1 = da2 @ P[1]["W"].T
    da1 = dh1 * (a1 > 0) * m1
    g[0] = {"W": x.T @ da1, "b": da1.sum(0)}
    return g


def scores(P, X, bs=8192):
    out = []
    for i in range(0, len(X), bs):
        out.append(sigmoid(forward(P, X[i:i + bs].reshape(len(X[i:i + bs]), -1).astype(np.float32))[0]))
    return np.concatenate(out) if out else np.zeros(0)


def detections(s, th, patience=2, cooldown_frames=31):
    """Frames are one stream after another (each window = 80 ms); the browser's detector on them."""
    n, above, until = 0, 0, -1
    for i, v in enumerate(s):
        if i < until:
            above = 0
            continue
        above = above + 1 if v >= th else 0
        if above >= patience:
            n += 1
            above = 0
            until = i + cooldown_frames
    return n


def recall(s, groups, th, patience=2):
    hit = 0
    for g in np.unique(groups):
        v = s[groups == g] >= th
        run = best = 0
        for b in v:
            run = run + 1 if b else 0
            best = max(best, run)
        hit += best >= patience
    return hit / max(1, len(np.unique(groups)))


def export(P, path):
    import onnx
    from onnx import TensorProto, helper, numpy_helper
    inits = [numpy_helper.from_array(np.array([1, 16 * H], np.int64), "shape")]
    nodes = [helper.make_node("Reshape", ["x", "shape"], ["f"])]
    prev = "f"
    for i, p in enumerate(P):
        inits += [numpy_helper.from_array(p["W"], f"W{i}"), numpy_helper.from_array(p["b"], f"b{i}")]
        nodes.append(helper.make_node("Gemm", [prev, f"W{i}", f"b{i}"], [f"g{i}"]))
        prev = f"g{i}"
        if i < 2:
            nodes.append(helper.make_node("Relu", [prev], [f"r{i}"]))
            prev = f"r{i}"
    nodes.append(helper.make_node("Sigmoid", [prev], ["score"]))
    graph = helper.make_graph(nodes, "hey_vita", [helper.make_tensor_value_info("x", TensorProto.FLOAT, [1, 16, H])],
                              [helper.make_tensor_value_info("score", TensorProto.FLOAT, [1, 1])], inits)
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 13)], producer_name="doctordekho-wakeword")
    model.ir_version = 8
    onnx.checker.check_model(model)
    onnx.save(model, path)


if __name__ == "__main__":
    steps = int(sys.argv[1]) if len(sys.argv) > 1 else 20000
    tr = np.load(os.path.join(HERE, "feats/train.npz"))
    va = np.load(os.path.join(HERE, "feats/val.npz"))
    pos, hard, adv, sp, nz = tr["pos"], tr["hard"], tr["adv"], tr["speech"], tr["noise"]
    print("train", len(pos), "pos", len(hard), "hard", len(adv), "adv", len(sp), "speech", len(nz), "noise", flush=True)
    P = [init(16 * H, H), init(H, H), init(H, 1)]
    m = [{k: np.zeros_like(v) for k, v in p.items()} for p in P]
    v = [{k: np.zeros_like(v) for k, v in p.items()} for p in P]
    lr, b1, b2 = 1e-3, 0.9, 0.999
    B = 512
    # each batch: 1/4 positives, 1/4 near-misses (half aligned like the positives), 3/8 speech, 1/8 noise; negatives weighted up
    # as training goes on
    for t in range(1, steps + 1):
        neg_w = 1.0 + 9.0 * min(1.0, t / (steps * 0.6))
        parts = [(pos, 1.0, B // 4, 1.0), (hard, 0.0, B // 8, neg_w * 1.5), (adv, 0.0, B // 8, neg_w * 1.5), (sp, 0.0, 3 * B // 8, neg_w),
                 (nz, 0.0, B // 8, neg_w)]
        xs, ys, ws = [], [], []
        for X, y, n, w in parts:
            idx = rng.integers(0, len(X), n)
            xs.append(X[idx].reshape(n, -1).astype(np.float32))
            ys.append(np.full(n, y, np.float32))
            ws.append(np.full(n, w, np.float32))
        x, y, w = np.concatenate(xs), np.concatenate(ys), np.concatenate(ws)
        x += rng.standard_normal(x.shape).astype(np.float32) * 0.05          # a little feature noise
        z, cache = forward(P, x, drop=0.3)
        p = sigmoid(z)
        dz = (p - y) * w / w.sum()
        g = backward(P, cache, dz)
        lr_t = lr * (0.5 * (1 + np.cos(np.pi * t / steps))) + 1e-5
        for i in range(3):
            for k in P[i]:
                gk = g[i][k] + (1e-4 * P[i][k] if k == "W" else 0)
                m[i][k] = b1 * m[i][k] + (1 - b1) * gk
                v[i][k] = b2 * v[i][k] + (1 - b2) * gk * gk
                mh = m[i][k] / (1 - b1 ** t)
                vh = v[i][k] / (1 - b2 ** t)
                P[i][k] -= lr_t * mh / (np.sqrt(vh) + 1e-8)
        if t % 2000 == 0 or t == steps:
            loss = float(np.mean(w * -(y * np.log(p + 1e-7) + (1 - y) * np.log(1 - p + 1e-7))))
            sv = scores(P, va["pos"])
            print(f"step {t} loss {loss:.4f} val recall@0.5 {recall(sv, va['pos_groups'], 0.5):.3f}", flush=True)

    sv_pos = scores(P, va["pos"])
    sv_hard = scores(P, va["hard"])
    sv_adv = scores(P, va["adv"])
    sv_sp = scores(P, va["speech"])
    sv_nz = scores(P, va["noise"])
    hours = float(va["adv_hours"]) + float(va["speech_hours"])
    report = []
    for th in (0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95):
        fa_adv = detections(sv_adv, th)
        fa_sp = detections(sv_sp, th)
        fa_nz = detections(sv_nz, th)
        row = {"threshold": th, "recall": round(recall(sv_pos, va["pos_groups"], th), 3),
               "near_misses_accepted": round(recall(sv_hard, va["hard_groups"], th), 3), "false_wakes_near_miss": fa_adv,
               "false_wakes_speech": fa_sp, "false_wakes_noise": fa_nz,
               "false_wakes_per_hour_speech": round((fa_adv + fa_sp) / max(hours, 1e-6), 2)}
        report.append(row)
        print(row, flush=True)
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    np.savez(os.path.join(HERE, "out/params.npz"), **{f"{k}{i}": p[k] for i, p in enumerate(P) for k in p})
    export(P, os.path.join(HERE, "out/hey_vita.onnx"))
    with open(os.path.join(HERE, "out/report.json"), "w") as f:
        json.dump({"val_hours": hours, "rows": report}, f, indent=1)
    print("saved out/hey_vita.onnx", flush=True)
