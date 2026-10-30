"""FastAPI backend: upload -> background analysis -> results / review / export.

Run:  ./uvw run uvicorn app.server:app --port 8000
"""
from __future__ import annotations

import json
import queue
import shutil
import subprocess
import threading
import time
import traceback
import uuid
from dataclasses import asdict
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles

from .analysis import FFMPEG, Params, analyze, browser_playable, make_playable, probe, to_csv

ROOT = Path(__file__).resolve().parent.parent
UPLOADS = ROOT / "uploads"
DIST = ROOT / "web" / "dist"
UPLOADS.mkdir(exist_ok=True)
ALLOWED = {".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi"}
MAX_BYTES = 4 * 1024 ** 3

PRESETS = {
    "strict":    dict(rally_on=1.8, rally_off=1.1, merge_gap=0.6, cand_min_db=11.0),
    "balanced":  dict(),                                   # Params defaults
    "sensitive": dict(rally_on=1.2, rally_off=0.7, merge_gap=1.0, cand_min_db=10.0),
}

app = FastAPI(title="Pickleball Analyzer")
jobs_q: "queue.Queue[str]" = queue.Queue()


# ------------------------------------------------------------------ job store (one folder per job)
def jdir(jid: str) -> Path:
    d = UPLOADS / jid
    if not d.is_dir() or "/" in jid or ".." in jid:
        raise HTTPException(404, "job not found")
    return d


def read_json(p: Path, default=None):
    try:
        return json.loads(p.read_text())
    except Exception:
        return default


def write_json(p: Path, data) -> None:
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=1))
    tmp.replace(p)


def set_status(jid: str, **kw) -> None:
    p = UPLOADS / jid / "job.json"
    j = read_json(p, {}) or {}
    j.update(kw, updated=time.time())
    write_json(p, j)


# ------------------------------------------------------------------ worker
def thumbs(src: Path, out: Path, rallies: list[dict]) -> None:
    out.mkdir(exist_ok=True)
    for r in rallies:
        t = min(r["start"] + 1.0, r["end"])
        subprocess.run([FFMPEG, "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", str(src), "-frames:v", "1",
                        "-vf", "scale=360:-2", "-q:v", "4", str(out / f"r{r['id']}.jpg")], check=False)


def worker() -> None:
    while True:
        jid = jobs_q.get()
        d = UPLOADS / jid
        try:
            job = read_json(d / "job.json", {})
            src = d / job["source"]
            set_status(jid, state="running", stage="Checking video", progress=0.01)
            info = probe(src)
            if not browser_playable(info, src):
                set_status(jid, stage="Converting video for the browser", progress=0.02)
                make_playable(src, d / "playable.mp4")
                job["playable"] = "playable.mp4"
            else:
                job["playable"] = job["source"]
            set_status(jid, playable=job["playable"], video=info)

            p = Params(**{**asdict(Params()), **PRESETS.get(job.get("preset", "balanced"), {})})
            res = analyze(src, d / "work", p,
                          progress=lambda m, f: set_status(jid, stage=m, progress=round(0.03 + 0.92 * f, 3)))
            set_status(jid, stage="Making rally thumbnails", progress=0.96)
            thumbs(d / job["playable"], d / "thumbs", res.rallies)
            write_json(d / "result.json", res.__dict__)
            set_status(jid, state="done", stage="Done", progress=1.0, summary=res.summary)
        except Exception as e:  # keep the server alive, surface the error in the UI
            set_status(jid, state="error", stage="Failed", error=str(e), trace=traceback.format_exc()[-2000:])
        finally:
            jobs_q.task_done()


threading.Thread(target=worker, daemon=True).start()
# re-queue anything interrupted by a restart
for jf in UPLOADS.glob("*/job.json"):
    j = read_json(jf, {})
    if j and j.get("state") in ("queued", "running"):
        jobs_q.put(jf.parent.name)


# ------------------------------------------------------------------ API
@app.post("/api/upload")
async def upload(file: UploadFile = File(...), preset: str = Form("balanced"),
                 team_a: str = Form("Team A"), team_b: str = Form("Team B"),
                 scoring: str = Form("sideout")):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(400, f"Unsupported file type {ext or '?'}; use {', '.join(sorted(ALLOWED))}")
    jid = time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]
    d = UPLOADS / jid
    d.mkdir(parents=True)
    dst = d / f"source{ext}"
    size = 0
    with dst.open("wb") as fh:
        while chunk := await file.read(1024 * 1024 * 4):
            size += len(chunk)
            if size > MAX_BYTES:
                fh.close(); shutil.rmtree(d)
                raise HTTPException(413, "File larger than 4 GB")
            fh.write(chunk)
    write_json(d / "job.json", {
        "id": jid, "name": file.filename, "source": dst.name, "size_bytes": size, "created": time.time(),
        "state": "queued", "stage": "Waiting in queue", "progress": 0.0,
        "preset": preset if preset in PRESETS else "balanced",
        "teams": {"A": team_a or "Team A", "B": team_b or "Team B"},
        "scoring": scoring if scoring in ("sideout", "rally") else "sideout",
    })
    jobs_q.put(jid)
    return {"id": jid}


@app.get("/api/jobs")
def list_jobs():
    out = []
    for jf in sorted(UPLOADS.glob("*/job.json"), reverse=True):
        j = read_json(jf)
        if j:
            j.pop("trace", None); out.append(j)
    return out


@app.get("/api/jobs/{jid}")
def get_job(jid: str):
    d = jdir(jid)
    return {"job": read_json(d / "job.json"), "result": read_json(d / "result.json"),
            "review": read_json(d / "review.json", {})}


@app.put("/api/jobs/{jid}/review")
def save_review(jid: str, review: dict):
    d = jdir(jid)
    review["saved"] = time.time()
    write_json(d / "review.json", review)
    return {"ok": True, "saved": review["saved"]}


@app.post("/api/jobs/{jid}/reanalyze")
def reanalyze(jid: str, body: dict):
    d = jdir(jid)
    preset = body.get("preset", "balanced")
    set_status(jid, state="queued", stage="Waiting in queue", progress=0.0,
               preset=preset if preset in PRESETS else "balanced", error=None)
    (d / "review.json").unlink(missing_ok=True)
    jobs_q.put(jid)
    return {"ok": True}


@app.delete("/api/jobs/{jid}")
def delete_job(jid: str):
    shutil.rmtree(jdir(jid))
    return {"ok": True}


@app.get("/api/jobs/{jid}/video")
def video(jid: str):
    d = jdir(jid)
    j = read_json(d / "job.json", {})
    f = d / (j.get("playable") or j["source"])
    return FileResponse(f)   # Starlette handles HTTP Range so the player can seek


@app.get("/api/jobs/{jid}/thumb/{rid}.jpg")
def thumb(jid: str, rid: int):
    f = jdir(jid) / "thumbs" / f"r{rid}.jpg"
    if not f.exists():
        raise HTTPException(404)
    return FileResponse(f, media_type="image/jpeg")


def merged(jid: str) -> dict:
    """Result with the human review applied (labels, deletions, winners)."""
    d = jdir(jid)
    res = read_json(d / "result.json")
    if not res:
        raise HTTPException(409, "analysis not finished")
    rv = read_json(d / "review.json", {}) or {}
    if rv.get("shots") is not None:
        res["shots"] = rv["shots"]
    if rv.get("rallies") is not None:
        res["rallies"] = rv["rallies"]
    if rv.get("points") is not None:
        res["points"] = rv["points"]
    return res


@app.get("/api/jobs/{jid}/export.csv")
def export_csv(jid: str):
    teams = (read_json(jdir(jid) / "job.json", {}) or {}).get("teams")
    return PlainTextResponse(to_csv(merged(jid), teams), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{jid}.csv"'})


@app.get("/api/jobs/{jid}/export.json")
def export_json(jid: str):
    return Response(json.dumps(merged(jid), indent=1), media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="{jid}.json"'})


@app.get("/api/health")
def health():
    return {"ok": True, "queue": jobs_q.qsize()}


# ------------------------------------------------------------------ frontend (built TypeScript app)
if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="web")
else:
    @app.get("/")
    def no_frontend():
        return JSONResponse({"error": "frontend not built: run ./nodew npm --prefix web run build"}, 500)
