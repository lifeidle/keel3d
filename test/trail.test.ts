import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Trail } from '../src/blocks/fx/Trail';

/**
 * R84 — Trail (fading position history for projectile arcs).
 */

test('distance gating: near samples skip, far samples record', () => {
  const tr = new Trail({ capacity: 8, minStep: 0.5, life: 1 });
  tr.add(0, 0, 0, 0);
  tr.add(0.1, 0, 0, 0.1); // closer than 0.5 → skipped
  tr.add(0.2, 0, 0, 0.2); // still < 0.5 from last ACCEPTED (0,0,0) → skipped
  assert.equal(tr.size, 1, 'near samples skipped');
  tr.add(0.6, 0, 0, 0.3); // >= 0.5 → accepted
  tr.add(1.2, 0, 0, 0.4);
  assert.equal(tr.size, 3);
});

test('fraction decays 1 → 0 over life; expired points prune', () => {
  const tr = new Trail({ capacity: 8, minStep: 0, life: 1 });
  tr.add(0, 0, 0, 0);
  const mid = tr.active(0.5)[0];
  assert.ok(Math.abs(mid.fraction - 0.5) < 1e-9, 'half life = 0.5 fraction');
  assert.equal(tr.active(1.001).length, 0, 'expired → pruned');
  assert.equal(tr.size, 0);
});

test('capacity cap evicts the oldest', () => {
  const tr = new Trail({ capacity: 3, minStep: 1, life: 10 });
  for (let i = 0; i < 5; i++) tr.add(i, 0, 0, i * 0.1);
  assert.equal(tr.size, 3);
  const live = tr.active(0.4);
  assert.deepEqual(live.map((p) => p.x), [2, 3, 4], 'newest 3 kept');
});

test('clear + validation', () => {
  const tr = new Trail({ capacity: 4, minStep: 0.1, life: 1 });
  tr.add(0, 0, 0, 0);
  tr.add(1, 0, 0, 0.1);
  tr.clear();
  assert.equal(tr.size, 0);
  assert.equal(tr.active(1).length, 0);
  assert.throws(() => new Trail({ capacity: 0 }), /capacity/);
  assert.throws(() => new Trail({ minStep: -1 }), /minStep/);
  assert.throws(() => new Trail({ life: 0 }), /life/);
});
