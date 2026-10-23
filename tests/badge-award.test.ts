import test from 'node:test';
import assert from 'node:assert/strict';
import {BadgeAwardSession,BADGE_AWARD_DURATION} from '../src/badge-award';
import {BikeProgressTracker,cleanBikeProgress} from '../src/bike-progress';
import {unlockEventHorizon} from '../src/event-horizon';

test('an earned badge starts once; duplicate progress snapshots never repeat it',()=>{
 const p=cleanBikeProgress(undefined),tracker=new BikeProgressTracker(),award=new BadgeAwardSession();
 const run={z:500,cleared:0,combat:{kills:3}};
 assert.equal(tracker.record(p,run).unlocked,true);award.enqueue(p.unlocked);
 assert.equal(award.advance(0,true),1);
 for(let i=0;i<70;i++){
  if(tracker.record(p,run).unlocked)award.enqueue(p.unlocked);
  assert.equal(award.advance(.1,true),undefined);
 }
 assert.equal(award.current,undefined);award.enqueue(1);assert.equal(award.advance(0,true),undefined);
});
test('pause, background and countdown do not consume or present an achievement',()=>{
 const award=new BadgeAwardSession();award.enqueue(3);
 assert.equal(award.advance(.1,false),undefined);assert.equal(award.current,undefined);
 assert.equal(award.advance(0,true),3);award.advance(.1,true);
 for(let i=0;i<100;i++)award.advance(.1,false);
 assert.equal(award.current,3);assert.equal(award.elapsed,.1);
 for(let i=0;i<49;i++)award.advance(.1,true);
 assert.ok(award.elapsed<=BADGE_AWARD_DURATION+.001);award.advance(.1,true);assert.equal(award.current,undefined);
});
test('multi-rank jumps coalesce to the highest new badge and wait for the current card',()=>{
 const award=new BadgeAwardSession();award.enqueue(1);award.enqueue(2);award.enqueue(3);
 assert.equal(award.advance(0,true),3);
 award.enqueue(4);award.enqueue(5);award.enqueue(7);award.enqueue(6);
 for(let i=0;i<49;i++)assert.equal(award.advance(.1,true),undefined);
 const starts=[];for(let i=0;i<3;i++){const level=award.advance(.1,true);if(level!==undefined)starts.push(level);}
 assert.deepEqual(starts,[7]);assert.equal(award.current,7);
});
test('final distance-only Event Horizon and ordinary rank tracking celebrate the same badge once',()=>{
 const p=cleanBikeProgress(undefined),tracker=new BikeProgressTracker(),award=new BadgeAwardSession();
 const save={eventHorizonUnlocked:false,livery:'classic' as 'classic'|'event-horizon',journey:{distance:0}};
 assert.equal(unlockEventHorizon(save,50000),true);p.unlocked=7;p.selected=7;award.enqueue(7);
 assert.equal(tracker.record(p,{z:50000,cleared:0,combat:{kills:0}}).unlocked,false);
 assert.equal(award.advance(0,true),7);assert.equal(unlockEventHorizon(save,50001),false);
 award.enqueue(7);for(let i=0;i<80;i++)assert.equal(award.advance(.1,true),undefined);
});
test('reset discards the previous run queue and rejects invalid levels',()=>{
 const award=new BadgeAwardSession();for(const value of [-1,0,8,NaN,Infinity,2.5])award.enqueue(value);
 assert.equal(award.advance(0,true),undefined);award.enqueue(4);award.advance(0,true);award.enqueue(5);
 award.reset();assert.equal(award.current,undefined);assert.equal(award.advance(0,true),undefined);
 award.enqueue(1);assert.equal(award.advance(0,true),1);
});
