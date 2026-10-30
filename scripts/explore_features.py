"""Compare spectral/temporal features of transients in rally vs. dead-time windows."""
import numpy as np, librosa, scipy.signal as ss

y, sr = librosa.load("work/audio.wav", sr=22050, mono=True)
c = np.load("work/cands.npy")
W = {"rally": [(1, 12.5), (24, 47)], "dead": [(13.5, 23)]}

def feats(t):
    i = int(t * sr)
    seg = y[max(0, i - 220): i + 1100]                     # -10ms .. +50ms
    if len(seg) < 1320: return None
    win = seg[220 - 64: 220 + 384] * np.hanning(448)
    sp = np.abs(np.fft.rfft(win, 2048)); f = np.fft.rfftfreq(2048, 1 / sr)
    band = (f > 500) & (f < 8000)
    peak = f[band][np.argmax(sp[band])]
    cen = (f * sp).sum() / sp.sum()
    env = np.abs(ss.hilbert(seg))
    env = np.convolve(env, np.ones(44) / 44, "same")          # 2 ms smooth
    pk = 220 + np.argmax(env[220:330])
    after = env[pk:]
    dec = np.argmax(after < env[pk] * 0.316) / sr * 1000      # ms to -10 dB
    pre = env[:200].mean() + 1e-9
    attack = 20 * np.log10(env[pk] / pre)
    return peak, cen, dec, attack

for name, wins in W.items():
    rows = []
    for t, r, l in c:
        if any(a <= t <= b for a, b in wins):
            fv = feats(t)
            if fv: rows.append((t, r, l) + fv)
    rows = np.array(rows)
    print(f"\n== {name}: n={len(rows)}  per-sec={len(rows)/sum(b-a for a,b in wins):.2f}")
    print("        t   ratio level  peakHz  centHz decay_ms attack_dB")
    for row in rows:
        print("  %6.2f  %5.1f %6.1f  %6.0f  %6.0f  %6.1f  %6.1f" % tuple(row))
