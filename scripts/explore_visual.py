"""Per-0.2s visual features vs. hand-labelled rally windows from the frame strips."""
import cv2, numpy as np

RALLIES = [(1, 12.5), (23.5, 48), (92, 98), (112, 136), (144, 156), (164, 176), (188, 202)]
cap = cv2.VideoCapture("sample_videos/Pickleball_game.webm")
fps = cap.get(cv2.CAP_PROP_FPS); step = int(fps / 5)
rows, prev, i = [], None, 0
while True:
    ok = cap.grab()
    if not ok: break
    if i % step == 0:
        _, f = cap.retrieve()
        s = cv2.resize(f, (320, 180)); hsv = cv2.cvtColor(s, cv2.COLOR_BGR2HSV)
        low = hsv[90:]                                     # lower half = court surface
        court = cv2.inRange(low, (85, 40, 50), (110, 255, 200)).mean() / 255
        g = cv2.cvtColor(s, cv2.COLOR_BGR2GRAY).astype(np.float32)
        if prev is not None:
            (dx, dy), _ = cv2.phaseCorrelate(prev, g)
            M = np.float32([[1, 0, dx], [0, 1, dy]])
            comp = cv2.warpAffine(prev, M, (320, 180))
            resid = np.abs(g - comp)[10:-10, 10:-10].mean()   # motion after camera compensation
            rows.append((i / fps, court, float(np.hypot(dx, dy)), resid))
        prev = g
    i += 1
a = np.array(rows); np.save("work/visual.npy", a)
lab = np.array([any(s <= t <= e for s, e in RALLIES) for t in a[:, 0]])
for k, n in [(1, "court"), (2, "cam_shift"), (3, "resid")]:
    print(f"{n:9s} rally med={np.median(a[lab,k]):.3f} p10={np.percentile(a[lab,k],10):.3f} p90={np.percentile(a[lab,k],90):.3f}"
          f" | dead med={np.median(a[~lab,k]):.3f} p10={np.percentile(a[~lab,k],10):.3f} p90={np.percentile(a[~lab,k],90):.3f}")
