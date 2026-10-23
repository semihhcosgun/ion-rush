import test from 'node:test';
import assert from 'node:assert/strict';
import {Race} from '../src/game';
import type {Save} from '../src/storage';
import {saveRunProgress} from '../src/run-summary';
const save=()=>({journey:{distance:100,score:0,energy:0,runs:0,nova:3}} as Save);
test('reopening a death summary saves the run and rewards only once',()=>{const s=save(),r=new Race();r.z=1300;r.energy=7;r.score=900;assert.equal(saveRunProgress(s,r),true);assert.equal(saveRunProgress(s,r),true);assert.deepEqual(s.journey,{distance:1300,score:900,energy:7,runs:1,nova:3});});
test('recovery grants only new progress and does not refund a spent NOVA',()=>{const s=save(),r=new Race();r.z=1300;r.energy=7;saveRunProgress(s,r);s.journey.nova--;r.z=6100;r.energy=12;r.score=3000;saveRunProgress(s,r);saveRunProgress(s,r);assert.deepEqual(s.journey,{distance:6100,score:3000,energy:12,runs:1,nova:2});const next=new Race();next.z=200;saveRunProgress(s,next);assert.equal(s.journey.runs,2);assert.equal(s.journey.distance,6100);});

test('distance milestones never mint NOVA',()=>{const s=save(),r=new Race();for(const z of [1200,6000,16000,30000,50000,100000]){r.z=z;saveRunProgress(s,r);assert.equal(s.journey.nova,3);}});
