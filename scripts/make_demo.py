"""Export one finished analysis into web/demo-public/demo/ for the static GitHub Pages demo.

    ./uvw run python scripts/make_demo.py                 # newest finished job in uploads/
    ./uvw run python scripts/make_demo.py <job-id>        # a specific job
    ./uvw run python scripts/make_demo.py <job-id> --skip-video

Writes job.json, result.json, review.json (your current review is the demo's starting state),
thumbs/r<N>.jpg and video.mp4 (720p H.264 + AAC, faststart, so it plays and seeks in every browser
and stays well under GitHub's 100 MB file limit). Then: cd web && ../nodew npm run build:demo
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.analysis import FFMPEG  # noqa: E402

UPLOADS = ROOT / "uploads"
OUT = ROOT / "web" / "demo-public" / "demo"


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    skip_video = "--skip-video" in sys.argv
    if args:
        src = UPLOADS / args[0]
    else:
        done = [p.parent for p in sorted(UPLOADS.glob("*/job.json"), reverse=True)
                if json.loads(p.read_text()).get("state") == "done"]
        if not done:
            sys.exit("No finished analysis in uploads/. Run ./start.sh and analyse a video first.")
        src = done[0]
    job = json.loads((src / "job.json").read_text())
    if job.get("state") != "done" or not (src / "result.json").exists():
        sys.exit(f"{src.name} has not finished analysing.")

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "thumbs").mkdir(exist_ok=True)
    for old in (OUT / "thumbs").glob("*.jpg"):
        old.unlink()
    for f in (src / "thumbs").glob("*.jpg"):
        shutil.copy2(f, OUT / "thumbs" / f.name)
    shutil.copy2(src / "result.json", OUT / "result.json")
    review = json.loads((src / "review.json").read_text()) if (src / "review.json").exists() else {}
    (OUT / "review.json").write_text(json.dumps(review))

    video = OUT / "video.mp4"
    if not skip_video:
        playable = src / (job.get("playable") or job["source"])
        print(f"Encoding {playable.name} -> {video.relative_to(ROOT)} …")
        subprocess.run([FFMPEG, "-v", "error", "-y", "-i", str(playable), "-vf", "scale=-2:'min(720,ih)'",
                        "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(video)], check=True)
    if not video.exists():
        sys.exit("video.mp4 is missing; run again without --skip-video.")
    size = video.stat().st_size
    if size > 95 * 1024 ** 2:
        print(f"⚠️  video.mp4 is {size / 1024 ** 2:.0f} MB; GitHub rejects files over 100 MB. Trim or raise -crf.")

    keep = ("id", "name", "created", "state", "stage", "progress", "preset", "teams", "scoring", "summary")
    demo_job = {k: job[k] for k in keep if k in job}
    demo_job.update(id="demo", size_bytes=size)
    (OUT / "job.json").write_text(json.dumps(demo_job, indent=1))
    print(f"✅ Demo data from {src.name} written to {OUT.relative_to(ROOT)} ({size / 1024 ** 2:.1f} MB video)")


if __name__ == "__main__":
    main()
