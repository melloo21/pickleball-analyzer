"""Pickleball video analysis: rallies, shots and points with timestamps.

Pipeline
  1. audio   -> paddle-pop candidates (impulse-to-background ratio, 1.2-6 kHz band)
  2. video   -> per-0.2 s "court in view & camera steady" gate (court colour, camera shift)
  3. fuse    -> rally activity curve = density of strong pops x visual gate
  4. segment -> rallies (hysteresis, min length, merge short gaps)
  5. hits    -> pops inside each rally, min spacing between shots
  6. labels  -> serve / return / third shot / dink / drive / volley / lob (rhythm + loudness heuristics)
  7. points  -> rally end = last hit + ball flight; one point (or side-out) per rally
Everything is deterministic: same video + same params -> same result.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Callable

import cv2
import numpy as np
import scipy.ndimage as nd
import scipy.signal as ss
import soundfile as sf

try:
    import static_ffmpeg
    static_ffmpeg.add_paths(weak=True)   # binaries live inside .venv
except Exception:  # pragma: no cover
    pass

FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
FFPROBE = shutil.which("ffprobe") or "ffprobe"
SR = 22050

Progress = Callable[[str, float], None]


@dataclass
class Params:
    cand_min_db: float = 10.0        # transient must be this far above 0.6 s background
    hit_min_db: float = 13.0         # transient strength to count as a shot inside a rally
    min_shot_gap: float = 0.45       # s; two shots can't be closer than this
    activity_sigma: float = 0.6      # s; smoothing of hit density
    rally_on: float = 1.5            # activity to start a rally
    rally_off: float = 1.0           # activity to keep a rally going
    merge_gap: float = 0.8           # s; join rally pieces separated by less
    min_rally_len: float = 2.5       # s
    min_rally_hits: int = 3
    court_min: float = 0.22          # share of court colour in lower half of frame
    max_cam_shift: float = 1.2       # px/frame at 320 px width (smoothed); above = camera panning
    flight_after_last: float = 0.8   # s added after the last hit for the point timestamp
    use_visual: bool = True


@dataclass
class Shot:
    id: str
    rally: int
    index: int          # 1-based within rally
    t: float
    label: str
    strength_db: float
    confidence: float


@dataclass
class Rally:
    id: int
    start: float
    end: float
    n_shots: int
    point_t: float
    rally_type: str     # "rally" or "fault/ace" (<3 shots)


@dataclass
class Result:
    video: dict
    params: dict
    rallies: list = field(default_factory=list)
    shots: list = field(default_factory=list)
    points: list = field(default_factory=list)
    curves: dict = field(default_factory=dict)   # down-sampled signals for the timeline UI
    summary: dict = field(default_factory=dict)


# ---------------------------------------------------------------- media helpers
def probe(path: str | Path) -> dict:
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    v = next((s for s in j["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in j["streams"] if s["codec_type"] == "audio"), None)
    fps = 0.0
    if v and v.get("avg_frame_rate", "0/0") != "0/0":
        n, d = v["avg_frame_rate"].split("/"); fps = float(n) / float(d)
    return {
        "duration": float(j["format"].get("duration", 0)),
        "size_bytes": int(j["format"].get("size", 0)),
        "video_codec": v.get("codec_name") if v else None,
        "width": v.get("width") if v else None,
        "height": v.get("height") if v else None,
        "fps": round(fps, 3),
        "audio_codec": a.get("codec_name") if a else None,
        "has_audio": a is not None,
        "format": j["format"].get("format_name"),
    }


def browser_playable(info: dict, path: Path) -> bool:
    ext = path.suffix.lower()
    if ext in (".webm",) and info["video_codec"] in ("vp8", "vp9", "av1"):
        return True
    if ext in (".mp4", ".m4v", ".mov") and info["video_codec"] == "h264":
        return True
    return False


def make_playable(src: Path, dst: Path) -> None:
    subprocess.run([FFMPEG, "-v", "error", "-y", "-i", str(src), "-c:v", "libx264", "-preset", "veryfast",
                    "-crf", "23", "-pix_fmt", "yuv420p", "-vf", "scale='min(1920,iw)':-2",
                    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(dst)], check=True)


def extract_audio(src: Path, dst: Path) -> np.ndarray:
    subprocess.run([FFMPEG, "-v", "error", "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", str(SR), str(dst)],
                   check=True)
    y, _ = sf.read(str(dst), dtype="float32")
    return y


# ---------------------------------------------------------------- 1. audio
def audio_candidates(y: np.ndarray, p: Params) -> np.ndarray:
    """Return array [t, ratio_db, level_db] of impulsive 1.2-6 kHz transients."""
    sos = ss.butter(4, [1200, 6000], btype="band", fs=SR, output="sos")
    yb = ss.sosfiltfilt(sos, y)
    hop, n = 64, 256
    pad = np.pad(yb, (n // 2, n // 2))
    frames = np.lib.stride_tricks.sliding_window_view(pad, n)[::hop]
    fast = np.sqrt((frames.astype(np.float64) ** 2).mean(1)) + 1e-7
    bg = nd.percentile_filter(fast, 50, size=int(0.6 * SR / hop)) + 1e-7
    ratio = 20 * np.log10(fast / bg)
    level = 20 * np.log10(fast)
    pk, _ = ss.find_peaks(ratio, height=p.cand_min_db, distance=int(0.15 * SR / hop))
    t = pk * hop / SR
    return np.stack([t, ratio[pk], level[pk]], 1) if len(pk) else np.zeros((0, 3))


# ---------------------------------------------------------------- 2. video
def visual_gate(path: Path, duration: float, p: Params, progress: Progress | None = None) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return (t, court_share, cam_shift) sampled at ~5 Hz."""
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    step = max(1, int(round(fps / 5)))
    ts, court, shift = [], [], []
    prev, i = None, 0
    while True:
        if not cap.grab():
            break
        if i % step == 0:
            ok, f = cap.retrieve()
            if not ok:
                break
            s = cv2.resize(f, (320, 180))
            hsv = cv2.cvtColor(s, cv2.COLOR_BGR2HSV)
            # blue/teal or green court surfaces in the lower half of the frame
            low = hsv[90:]
            m = cv2.inRange(low, (35, 35, 40), (115, 255, 230))
            g = cv2.cvtColor(s, cv2.COLOR_BGR2GRAY).astype(np.float32)
            dxy = 0.0
            if prev is not None:
                (dx, dy), _ = cv2.phaseCorrelate(prev, g)
                dxy = float(np.hypot(dx, dy)) / step
            ts.append(i / fps); court.append(m.mean() / 255); shift.append(dxy)
            prev = g
            if progress and len(ts) % 50 == 0 and duration:
                progress("Scanning video frames", min(0.99, (i / fps) / duration))
        i += 1
    cap.release()
    return np.array(ts), np.array(court), np.array(shift)


# ---------------------------------------------------------------- 3-7
def label_shots(times: np.ndarray, strengths: np.ndarray) -> list[tuple[str, float]]:
    out = []
    med = float(np.median(strengths)) if len(strengths) else 0.0
    for k, (t, s) in enumerate(zip(times, strengths)):
        gap_before = times[k] - times[k - 1] if k > 0 else None
        gap_after = times[k + 1] - times[k] if k + 1 < len(times) else None
        if k == 0:
            out.append(("serve", 0.8)); continue
        if k == 1:
            out.append(("return", 0.75)); continue
        if k == 2:
            out.append(("third shot", 0.7)); continue
        g = gap_after if gap_after is not None else gap_before
        if g is not None and g >= 2.0:
            out.append(("lob", 0.45))
        elif gap_before is not None and gap_before < 0.75:
            out.append(("volley", 0.5))
        elif s < med - 1.5 and g is not None and 0.75 <= g < 2.0:
            out.append(("dink", 0.55))
        elif s >= med + 2.0:
            out.append(("drive", 0.5))
        else:
            out.append(("dink" if (g or 1.0) >= 1.0 else "drive", 0.4))
    if out and len(times) >= 2:
        out[-1] = (out[-1][0] + " (rally end)", out[-1][1])
    return out


def analyze(video_path: str | Path, workdir: str | Path, params: Params | None = None,
            progress: Progress | None = None) -> Result:
    p = params or Params()
    video_path, workdir = Path(video_path), Path(workdir)
    workdir.mkdir(parents=True, exist_ok=True)
    say = progress or (lambda *_: None)

    say("Reading video info", 0.02)
    info = probe(video_path)
    if not info["has_audio"]:
        raise ValueError("This video has no audio track; hit detection needs the sound of the paddle.")
    dur = info["duration"]

    say("Extracting audio", 0.05)
    y = extract_audio(video_path, workdir / "audio.wav")
    say("Detecting paddle hits", 0.12)
    cand = audio_candidates(y, p)

    # visual gate on a 10 Hz grid
    grid = np.arange(0, dur, 0.1)
    if p.use_visual:
        vt, court, shift = visual_gate(video_path, dur, p, lambda m, f: say(m, 0.15 + 0.6 * f))
        court_s = nd.median_filter(court, size=9)                 # ~1.8 s
        shift_s = nd.median_filter(shift, size=9)
        ok = (court_s >= p.court_min) & (shift_s <= p.max_cam_shift)
        gate = np.interp(grid, vt, ok.astype(float)) if len(vt) else np.ones_like(grid)
        court_g = np.interp(grid, vt, court_s) if len(vt) else np.ones_like(grid)
        shift_g = np.interp(grid, vt, shift_s) if len(vt) else np.zeros_like(grid)
    else:
        gate = np.ones_like(grid); court_g = np.ones_like(grid); shift_g = np.zeros_like(grid)

    say("Finding rallies", 0.8)
    w = np.clip((cand[:, 1] - p.cand_min_db) / 8.0, 0, 1.25) if len(cand) else np.array([])
    dens = np.zeros_like(grid)
    if len(cand):
        idx = np.clip((cand[:, 0] / 0.1).astype(int), 0, len(grid) - 1)
        np.add.at(dens, idx, w)
        dens = nd.gaussian_filter1d(dens, p.activity_sigma / 0.1) * (p.activity_sigma / 0.1) * 2.5066 / 1.0
        dens = dens / (p.activity_sigma * 2.5066)   # -> weighted pops per second
    activity = dens * gate

    # hysteresis segmentation
    segs, on, s0 = [], False, 0.0
    for t, a in zip(grid, activity):
        if not on and a >= p.rally_on:
            on, s0 = True, t
        elif on and a < p.rally_off:
            on = False; segs.append([s0, t])
    if on:
        segs.append([s0, grid[-1]])
    merged: list[list[float]] = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < p.merge_gap:
            merged[-1][1] = s[1]
        else:
            merged.append(s)

    say("Tagging shots", 0.9)
    rallies, shots, points = [], [], []
    for s, e in merged:
        if e - s < p.min_rally_len:
            continue
        m = (cand[:, 0] >= s - 0.6) & (cand[:, 0] <= e + 0.3) & (cand[:, 1] >= p.hit_min_db)
        c = cand[m]
        # enforce min spacing: keep strongest within each cluster
        keep: list[np.ndarray] = []
        for row in c[np.argsort(-c[:, 1])]:
            if all(abs(row[0] - k[0]) >= p.min_shot_gap for k in keep):
                keep.append(row)
        if len(keep) < p.min_rally_hits:
            continue
        c = np.array(sorted(keep, key=lambda r: r[0]))
        rid = len(rallies) + 1
        labels = label_shots(c[:, 0], c[:, 1])
        for k, (row, (lab, conf)) in enumerate(zip(c, labels)):
            conf2 = float(np.clip(conf * (0.6 + 0.4 * min(1, (row[1] - p.hit_min_db) / 8)), 0.05, 0.95))
            shots.append(Shot(id=f"r{rid}s{k+1}", rally=rid, index=k + 1, t=round(float(row[0]), 2),
                              label=lab, strength_db=round(float(row[1]), 1), confidence=round(conf2, 2)))
        start, last = float(c[0, 0]), float(c[-1, 0])
        pt = round(min(dur, last + p.flight_after_last), 2)
        rallies.append(Rally(id=rid, start=round(start, 2), end=round(pt, 2), n_shots=len(c), point_t=pt,
                             rally_type="rally" if len(c) >= 3 else "fault/ace"))
        points.append({"id": f"p{rid}", "rally": rid, "t": pt, "label": f"Point / side-out #{rid}",
                       "winner": None, "note": ""})

    # curves for the UI (2 Hz)
    ds = slice(None, None, 5)
    res = Result(
        video=info, params=asdict(p),
        rallies=[asdict(r) for r in rallies], shots=[asdict(s) for s in shots], points=points,
        curves={"t": np.round(grid[ds], 1).tolist(), "activity": np.round(activity[ds], 3).tolist(),
                "gate": np.round(gate[ds], 2).tolist(), "court": np.round(court_g[ds], 3).tolist(),
                "cam_shift": np.round(shift_g[ds], 3).tolist()},
        summary={
            "rallies": len(rallies), "shots": len(shots), "points": len(points),
            "avg_shots_per_rally": round(len(shots) / len(rallies), 1) if rallies else 0,
            "longest_rally_shots": max((r.n_shots for r in rallies), default=0),
            "longest_rally_s": round(max((r.end - r.start for r in rallies), default=0), 1),
            "play_time_s": round(sum(r.end - r.start for r in rallies), 1),
            "duration_s": round(dur, 1),
            "audio_candidates": int(len(cand)),
        })
    say("Done", 1.0)
    return res


def to_csv(result: dict, teams: dict | None = None) -> str:
    """Flat event list. Rallies a reviewer marked 'rejected' are left out."""
    teams = teams or {"A": "Team A", "B": "Team B"}
    lines = ["type,id,rally,shot_index,timestamp_s,timestamp,label,review_status,winner,strength_db,confidence"]
    def hms(t): m, s = divmod(float(t), 60); return f"{int(m):02d}:{s:05.2f}"
    def q(x): return '"' + str(x).replace('"', '""') + '"'
    for r in sorted(result["rallies"], key=lambda r: r["start"]):
        st = r.get("status", "unchecked")
        if st == "rejected":
            continue
        shots = sorted([s for s in result["shots"] if s["rally"] == r["id"]], key=lambda s: s["t"])
        lines.append(f"rally_start,R{r['id']},{r['id']},,{r['start']},{hms(r['start'])},{q(f'rally ({len(shots)} shots)')},{st},,,")
        for s in shots:
            lab = s["label"].replace(" (rally end)", "")
            lines.append(f"shot,{s['id']},{s['rally']},{s['index']},{s['t']},{hms(s['t'])},{q(lab)},{st},,{s['strength_db']},{s['confidence']}")
        for pt in [p for p in result["points"] if p["rally"] == r["id"]]:
            w = teams.get(pt.get("winner") or "", "")
            lines.append(f"point,{pt['id']},{pt['rally']},,{pt['t']},{hms(pt['t'])},{q(pt['label'])},{st},{q(w)},,")
    return "\n".join(lines) + "\n"
