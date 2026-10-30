"""Evaluate rally detection on the sample against hand labels (from 1-2 s frame strips, ±1 s)."""
import json, sys, time
sys.path.insert(0, ".")
from app.analysis import analyze, Params

TRUTH = [(1, 12.5), (23.5, 48), (92, 98), (112, 136), (144, 156), (164, 176), (188, 202)]
kw = {k: float(v) for k, v in (a.split("=") for a in sys.argv[1:])}
p = Params(**kw)
t0 = time.time()
r = analyze("sample_videos/Pickleball_game.webm", "work/eval", p)
print(f"analysis {time.time()-t0:.1f}s  summary {json.dumps(r.summary)}")
det = [(x["start"], x["end"]) for x in r.rallies]
def ov(a, b): return max(0, min(a[1], b[1]) - max(a[0], b[0]))
hit = sum(1 for t in TRUTH if any(ov(t, d) > 0.5 * (t[1] - t[0]) or ov(t, d) > 3 for d in det))
fp = [d for d in det if not any(ov(t, d) > 0.5 * (d[1] - d[0]) for t in TRUTH)]
print(f"truth rallies found: {hit}/{len(TRUTH)}   false rallies: {len(fp)}")
for x in r.rallies:
    match = any(ov(t, (x['start'], x['end'])) > 0.5 * (x['end'] - x['start']) for t in TRUTH)
    print(f"  R{x['id']:<2} {x['start']:7.2f} -> {x['end']:7.2f}  shots={x['n_shots']:<3} {'OK' if match else 'FALSE'}")
json.dump(r.__dict__, open("work/eval/result.json", "w"), default=str)
