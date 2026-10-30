"""Scripted, visible Chrome walkthrough of Dink Lab that saves screenshots to docs/screenshots/.

Run (server must be up):  ./uvw run --group demo python scripts/demo_ui.py
"""
import json
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8000"
OUT = Path("docs/screenshots"); OUT.mkdir(parents=True, exist_ok=True)
VIDEO = str(Path("sample_videos/Pickleball_game.webm").resolve())


def shot(page, name, full=False):
    page.screenshot(path=str(OUT / name), full_page=full)
    print("saved", OUT / name)


with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=False, slow_mo=250,
                                args=["--autoplay-policy=no-user-gesture-required"])
    page = browser.new_page(viewport={"width": 1480, "height": 940}, device_scale_factor=2)

    # 1. landing / upload page
    page.goto(BASE + "/#/"); page.wait_for_selector("#upform"); time.sleep(1)
    shot(page, "01_home_upload.png")

    # 2. choose the file + team names
    page.set_input_files("#file", VIDEO)
    page.fill("input[name=team_a]", "Near (white)")
    page.fill("input[name=team_b]", "Far (red/grey)")
    page.click('.seg[data-name=scoring] button[data-v=sideout]')
    time.sleep(1.2)
    shot(page, "02_file_selected.png")

    # 3. upload -> live progress
    page.click("#go")
    page.wait_for_selector(".progress-card", timeout=60000); time.sleep(2.5)
    shot(page, "03_analyzing.png")
    job_id = page.url.split("/job/")[1]

    # 4. workspace
    page.wait_for_selector(".ws", timeout=300000); time.sleep(2)
    shot(page, "04_workspace_overview.png")

    # 5. jump to rally 1 with the navigator and play it
    page.keyboard.press("k"); time.sleep(0.8)
    page.click('[data-a="playRally"]'); time.sleep(3.2)
    page.evaluate("document.querySelector('#vid').pause()")
    shot(page, "05_rally_playing_hud.png")

    # 6. human check: confirm R1 & R2 (real rallies), reject R3/R4 (players walking between points)
    for rid, st in [(1, "ok"), (2, "ok"), (3, "rejected"), (4, "rejected")]:
        page.click(f'.rcard[data-r="{rid}"] [data-st="{st}"]'); time.sleep(0.3)
    # illustrate winners on two rallies (cleared again below: real winners need a human)
    page.click('.rcard[data-r="1"] [data-win="A"]'); page.click('.rcard[data-r="2"] [data-win="B"]')
    page.click('.rcard[data-r="1"] .rtop'); time.sleep(0.6)   # title, not the card centre (that's the ✗ button)
    page.click("#zoomBtn"); time.sleep(0.4)
    page.keyboard.press("ArrowRight"); page.keyboard.press("ArrowRight"); time.sleep(0.8)
    shot(page, "06_review_scoreboard_zoom.png")

    # 7. fix a shot label from the strip
    sel = page.locator(".shot select").nth(4)
    sel.select_option("drive"); time.sleep(0.6)
    page.locator(".shots").scroll_into_view_if_needed(); time.sleep(0.4)
    shot(page, "07_shot_editor.png")
    shot(page, "08_workspace_full_page.png", full=True)

    # 8. library
    page.goto(BASE + "/#/library"); time.sleep(2)
    shot(page, "09_library.png")
    browser.close()

# keep the verified ✓/✗ statuses, clear the illustrative winners
rv = json.load(urllib.request.urlopen(f"{BASE}/api/jobs/{job_id}"))["review"]
for pt in rv.get("points", []):
    pt["winner"] = None
req = urllib.request.Request(f"{BASE}/api/jobs/{job_id}/review", data=json.dumps(rv).encode(),
                             method="PUT", headers={"Content-Type": "application/json"})
urllib.request.urlopen(req)
print("job", job_id)
