/**
 * ClusteredDots — overlap resolution for dot lists (R101). Pure.
 *
 * Gap: minimap-style dot layers (enemies, pings) draw overlapping points
 * on top of each other — five enemies standing together read as ONE dot.
 * Content needs "spread a tight cluster into a small ring" math but has
 * no shared, testable form. One pure function: greedy clusters (a point
 * gathers unassigned neighbors within `clusterR`), each cluster of
 * 2+ is laid out on a ring of `ringR` around its centroid (members
 * ordered by (x, y) for determinism); single points stay put.
 */
export interface SpreadPoint {
  x: number;
  y: number;
}

/**
 * Spread overlapping points. `clusterR`: points within this distance of
 * a seed point join its cluster. `ringR`: radius each cluster member is
 * placed at (from the cluster centroid). Input is not mutated; the
 * output is in the same order as the input (position replaced by the
 * ring layout for clustered members, unchanged otherwise).
 *
 * Validation: clusterR/ringR must be positive and finite; points must be
 * finite.
 */
export function spreadDots(
  points: readonly SpreadPoint[],
  clusterR: number,
  ringR: number,
): SpreadPoint[] {
  if (!Number.isFinite(clusterR) || clusterR <= 0) {
    throw new Error('spreadDots: clusterR must be positive and finite');
  }
  if (!Number.isFinite(ringR) || ringR < 0) {
    throw new Error('spreadDots: ringR must be non-negative and finite');
  }
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      throw new Error('spreadDots: points must be finite');
    }
  }
  const out: SpreadPoint[] = points.map((p) => ({ x: p.x, y: p.y }));
  const assigned = new Array<boolean>(points.length).fill(false);
  for (let i = 0; i < points.length; i++) {
    if (assigned[i]) continue;
    // seed i, gather unassigned neighbors within clusterR of the seed
    const members: number[] = [i];
    assigned[i] = true;
    for (let j = i + 1; j < points.length; j++) {
      if (assigned[j]) continue;
      const d = Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y);
      if (d < clusterR) {
        assigned[j] = true;
        members.push(j);
      }
    }
    if (members.length < 2) continue; // single point stays put
    // centroid
    let cx = 0;
    let cy = 0;
    for (const m of members) {
      cx += points[m].x;
      cy += points[m].y;
    }
    cx /= members.length;
    cy /= members.length;
    // deterministic member order: by (x, y)
    const ordered = [...members].sort((a, b) => {
      const dx = points[a].x - points[b].x;
      return dx !== 0 ? dx : points[a].y - points[b].y;
    });
    const n = ordered.length;
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * Math.PI * 2 + Math.PI / 2; // start at "up"
      out[ordered[k]] = {
        x: cx + Math.cos(ang) * ringR,
        y: cy + Math.sin(ang) * ringR,
      };
    }
  }
  return out;
}
