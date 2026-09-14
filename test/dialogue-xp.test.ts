import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Dialogue } from '../src/blocks/gameplay/Dialogue';
import { XpProgress } from '../src/blocks/progress/XpProgress';
import { SkillTree } from '../src/blocks/progress/SkillTree';
import { DialogBox } from '../src/blocks/ui/DialogBox';

test('Dialogue lines, options, flags, end', () => {
  const d = new Dialogue([
    { id: 'a', lines: ['Hello', 'Bye'], options: [{ text: 'ok', next: 'b', flag: 'met' }] },
    { id: 'b', lines: ['Done'] },
  ]);
  assert.ok(d.start('a'));
  assert.equal(d.line(), 'Hello');
  assert.ok(d.advance());
  assert.equal(d.line(), 'Bye');
  assert.equal(d.options().length, 1);
  assert.ok(d.choose(0));
  assert.ok(d.hasFlag('met'));
  assert.equal(d.line(), 'Done');
  d.advance();
  assert.ok(d.current.ended);
});

test('XpProgress levels up', () => {
  const xp = new XpProgress({ curve: (n) => n * 10 });
  let ups = 0;
  xp.onLevelUp = () => ups++;
  assert.equal(xp.addXp(5), 0);
  assert.equal(xp.addXp(10), 1);
  assert.equal(xp.level, 2);
  assert.ok(ups >= 1);
  assert.equal(xp.toNext, 20 - xp.xp);
});

test('SkillTree cost and requires', () => {
  const t = new SkillTree(
    [
      { id: 'a', cost: 1 },
      { id: 'b', cost: 2, requires: ['a'] },
    ],
    3,
  );
  assert.ok(t.unlock('b') === false);
  assert.ok(t.unlock('a'));
  assert.ok(t.unlock('b'));
  assert.equal(t.points, 0);
  assert.ok(t.isUnlocked('b'));
});

test('DialogBox safe without DOM', () => {
  const d = new Dialogue([{ id: 'x', lines: ['hi'] }]);
  const box = new DialogBox(d);
  assert.equal(box.el, null);
  box.dispose();
});
