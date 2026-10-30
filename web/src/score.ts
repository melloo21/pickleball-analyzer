import type { Point, Rally, Team } from "./api";

export interface ScoreState {
  score: Record<Team, number>;
  serving: Team;
  server: 1 | 2;           // doubles server number (side-out scoring)
}
export interface ScoreStep { rally: number; winner: Team; scored: boolean; after: ScoreState; call: string }

const other = (t: Team): Team => (t === "A" ? "B" : "A");

/**
 * Replay the point winners in rally order.
 *  - rally scoring: every rally gives the winner a point.
 *  - side-out (traditional doubles): only the serving team scores; losing a rally passes the serve
 *    to the partner (server 2) or, after server 2, to the other team. The game starts at 0-0-2.
 */
export function replay(rallies: Rally[], points: Point[], scoring: "sideout" | "rally", firstServer: Team = "A"): ScoreStep[] {
  const st: ScoreState = { score: { A: 0, B: 0 }, serving: firstServer, server: 2 };
  const steps: ScoreStep[] = [];
  const byRally = new Map(points.map((p) => [p.rally, p]));
  for (const r of [...rallies].sort((a, b) => a.start - b.start)) {
    if (r.status === "rejected") continue;
    const w = byRally.get(r.id)?.winner;
    if (!w) continue;
    let scored = false;
    if (scoring === "rally") {
      st.score[w] += 1; scored = true; st.serving = w;
    } else if (w === st.serving) {
      st.score[w] += 1; scored = true;
    } else if (st.server === 1) {
      st.server = 2;
    } else {
      st.serving = other(st.serving); st.server = 1;
    }
    const s = st.score;
    const call = scoring === "rally"
      ? `${s[st.serving]}-${s[other(st.serving)]}`
      : `${s[st.serving]}-${s[other(st.serving)]}-${st.server}`;
    steps.push({ rally: r.id, winner: w, scored, after: structuredClone(st), call });
  }
  return steps;
}
