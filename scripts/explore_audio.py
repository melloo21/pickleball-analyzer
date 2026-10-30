"""Exploration: find candidate paddle-hit transients in work/audio.wav and print stats."""
import sys
import numpy as np, librosa, scipy.signal as ss, scipy.ndimage as nd

y, sr = librosa.load("work/audio.wav", sr=22050, mono=True)
sos = ss.butter(4, [1200, 6000], btype="band", fs=sr, output="sos")
yb = ss.sosfiltfilt(sos, y)
hop = 64                                  # 2.9 ms
fr = librosa.util.frame(np.pad(yb, (128, 128)), frame_length=256, hop_length=hop)
fast = np.sqrt((fr ** 2).mean(0)) + 1e-7  # ~12 ms energy
t = np.arange(len(fast)) * hop / sr
bg = nd.percentile_filter(fast, 50, size=int(0.6 * sr / hop)) + 1e-7   # 0.6 s background
ratio = 20 * np.log10(fast / bg)
level = 20 * np.log10(fast)
peaks, props = ss.find_peaks(ratio, height=8, distance=int(0.15 * sr / hop))
print(f"duration {len(y)/sr:.1f}s  candidates>=8dB {len(peaks)}")
for k in [8, 10, 12, 15, 18, 22]:
    print(f"  ratio>={k}dB: {np.sum(ratio[peaks] >= k)}")
np.save("work/cands.npy", np.stack([t[peaks], ratio[peaks], level[peaks]], 1))
lo, hi = (float(a) for a in sys.argv[1:3]) if len(sys.argv) > 2 else (0, 40)
for p in peaks:
    if lo <= t[p] <= hi:
        print(f"{t[p]:7.2f}  ratio={ratio[p]:5.1f}dB  level={level[p]:6.1f}dB")
