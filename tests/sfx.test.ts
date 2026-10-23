import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OVERDRIVE_AUDIO_GAIN,SFX_DURATION,synthEffect,type SfxKind} from '../src/sfx-bank';

test('every effect has finite, bounded samples and click-free edges at device sample rates',()=>{
 for(const rate of [44100,48000])for(const kind of Object.keys(SFX_DURATION) as SfxKind[]){
  const data=synthEffect(kind,rate);
  assert.equal(data.length,Math.ceil(SFX_DURATION[kind]*rate));
  assert.equal(Math.abs(data[0]),0);
  assert.ok(Math.abs(data.at(-1)!)<.001);
  let peak=0;for(const sample of data){assert.ok(Number.isFinite(sample));peak=Math.max(peak,Math.abs(sample));}
  assert.ok(peak>.01&&peak<=(kind==='overdrive'?.48*OVERDRIVE_AUDIO_GAIN:.48),`${kind}: ${peak}`);
 }
});
test('weapon variants and hostile fire have distinct waveforms',()=>{
 const shot=synthEffect('shot',48000,0);
 assert.deepEqual(shot,synthEffect('shot',48000,0));
 assert.notDeepEqual(shot,synthEffect('shot',48000,1));
 assert.notDeepEqual(shot.slice(0,4800),synthEffect('enemyShot',48000).slice(0,4800));
});

test('Overdrive preserves the original turbo waveform and timing, only increasing amplitude',()=>{
 for(const rate of [44100,48000]){const boost=synthEffect('boost',rate),overdrive=synthEffect('overdrive',rate);assert.equal(overdrive.length,boost.length);for(let i=0;i<boost.length;i++)assert.ok(Math.abs(overdrive[i]-boost[i]*OVERDRIVE_AUDIO_GAIN)<1e-7);}
});
