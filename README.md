# 🏓 Dink Lab: Pickleball Analyzer

Upload a match video → rallies, shots and points tagged with timestamps → check them by hand and build the score.

* **Frontend:** TypeScript + Vite (`web/`), built into `web/dist` and served by the backend
* **Backend / analysis:** Python 3.12, FastAPI, librosa/scipy (paddle-pop audio), OpenCV (court/camera gate)

## Run

```zsh
cd ~/pickleball-analyzer
./start.sh            # builds the UI if needed, starts http://localhost:8000
```
UI hot-reload while developing: `./start.sh` in one terminal, `cd web && ../nodew npm run dev` in another (http://localhost:5173).

## How a user uses it
1. **Upload**: drag a video onto the drop zone, name the teams, pick side-out/rally scoring and sensitivity → *Upload & analyze*.
2. **Watch progress**: a live step list (audio → hits → frames → rallies → shots → thumbnails).
3. **Workspace**:
   * stat cards (rallies, shots, avg/longest rally, ball-in-play %)
   * video with a HUD showing the current rally / shot / point
   * navigator ⏮ ◀ ▶ Play rally ▶ ⏭, Loop, Zoom, playback speed
   * clickable timeline: rally bars, coloured shot ticks, 🚩 point flags, hit-activity curve
   * rally cards: ✓ correct / ✗ not a rally, 🟢/🔵 who won the point → live scoreboard (`4-2-1` call)
   * shot strip: relabel (serve, return, third shot, drop, dink, drive, volley, lob, smash, reset), delete false hits, ➕ add a missed shot at the playhead
   * shot-mix chart (click to highlight that shot type everywhere)
   * keyboard: J/K rally, ←/→ shot, Space, P, Y/N, A/B, S, L, Z
4. **Export**: CSV / JSON with your review applied (rejected rallies are dropped).

Screenshots: `docs/screenshots/` (made by `scripts/demo_ui.py`, a visible Chrome walkthrough).

## Accuracy (sample video, 3:57 tournament doubles, hand-labelled from frames)
`./uvw run python scripts/evaluate.py [param=value ...]`

| preset | real rallies found | false rallies |
|---|---|---|
| balanced (default) | 6 / 7 | 6 of 11 detections (players walking between points, nearby-court pops, end-of-match paddle taps) |
| stricter thresholds (tested variant) | 5 / 7 | 4 of 9 |

Shot labels other than serve/return/third shot are rhythm/loudness heuristics; treat them as suggestions to correct.
Point **winners are not detected automatically yet**; you pick them on the rally cards.

## Everything stays in this folder
| Path | What |
|---|---|
| `.uv/python/`, `.uv/cache/` | Python 3.12 + uv cache (`./uvw` wrapper sets the paths) |
| `.venv/` | Python packages, incl. ffmpeg/ffprobe via `static-ffmpeg` |
| `.tools/node/`, `.tools/npm-cache/` | Node 22 + npm cache (`./nodew` wrapper) |
| `web/node_modules/` | TypeScript/Vite |
| `uploads/<job>/` | uploaded video, result.json, review.json, thumbnails |

Use `./uvw …` instead of `uv …` and `./nodew npm …` instead of `npm …`. Delete the folder and nothing is left behind.
