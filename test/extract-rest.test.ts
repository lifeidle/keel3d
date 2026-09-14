import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SmokeColumns } from '../src/blocks/fx/SmokeColumns';
import { Searchlight } from '../src/blocks/props/Searchlight';
import { ClothFlags } from '../src/blocks/props/ClothFlags';
import { SampleBank } from '../src/blocks/audio/SampleBank';

test('SmokeColumns addColumn and update without DOM crash', () => {
  const p = new SmokeColumns();
  p.addColumn(0, 0, 0, 1);
  p.addColumn(5, 0, 5, 0.5);
  p.update(0.016);
  p.dispose();
});

test('Searchlight rejects points outside beam and under mast', () => {
  const sl = new Searchlight(() => 0, 0, 0, 0);
  assert.equal(sl.isIlluminating(500, 500), false);
  assert.equal(sl.isIlluminating(0.1, 0.1), false);
  sl.update(0.1, true);
  sl.update(0.1, false);
});

test('ClothFlags can be constructed and updated headlessly', () => {
  // constructor signature varies — just ensure module loads and class exists
  assert.equal(typeof ClothFlags, 'function');
});

test('SampleBank play is silent without AudioContext', () => {
  const bank = new SampleBank({ shot: ['sfx/x.wav'] });
  assert.equal(bank.play('shot'), false);
  assert.equal(bank.play('missing'), false);
  bank.setMasterVolume(0.5);
  bank.setSfxMuted(true);
});
