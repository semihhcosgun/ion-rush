import test from 'node:test';
import assert from 'node:assert/strict';
import {BIKE_TIERS,BikeProgressTracker,cleanBikeProgress,masteryXp} from '../src/bike-progress';

test('fresh riders start with no invented rewards; old records migrate only once',()=>{
 const fresh=cleanBikeProgress(undefined);assert.equal(fresh.unlocked,0);assert.equal(masteryXp(fresh),0);
 const legacy={journey:{distance:7400,energy:20},alienLog:{drone:{kills:12}}};
 const p=cleanBikeProgress(undefined,legacy);assert.equal(p.unlocked,4);assert.equal(p.distance,0);assert.equal(p.kills,0);assert.ok(masteryXp(p)>=2400);
 assert.deepEqual(cleanBikeProgress(JSON.parse(JSON.stringify(p)),legacy),p);
});
test('legacy Event Horizon and the chosen form survive migration',()=>{
 const p=cleanBikeProgress(undefined,{eventHorizonUnlocked:true,livery:'event-horizon',journey:{distance:50000}});assert.equal(p.unlocked,7);assert.equal(p.selected,7);assert.equal(p.celebrated,7);
 p.selected=2;assert.equal(cleanBikeProgress(p,{eventHorizonUnlocked:true}).selected,2);
});
test('revive, pause, duplicate results and backwards snapshots cannot double-credit a run',()=>{
 const p=cleanBikeProgress(undefined),tracker=new BikeProgressTracker(),run={z:0,cleared:0,combat:{kills:0}};
 tracker.start(run);Object.assign(run,{z:1500,cleared:12});run.combat.kills=2;tracker.record(p,run);
 const xp=masteryXp(p);for(let i=0;i<5;i++)tracker.record(p,run);assert.equal(masteryXp(p),xp);
 run.z=400;run.combat.kills=1;tracker.record(p,run);assert.equal(masteryXp(p),xp);
 run.z=2000;run.combat.kills=3;run.cleared=15;tracker.record(p,run);assert.equal(masteryXp(p),xp+50+25+9);assert.equal(p.distance,2000);
 tracker.record(p,{z:300,cleared:1,combat:{kills:0}});assert.equal(p.distance,2300);assert.equal(p.best,2000);
});
test('mastery cannot bypass the distance gate and unlocked choices remain permanent',()=>{
 const p=cleanBikeProgress(undefined),tracker=new BikeProgressTracker();
 tracker.record(p,{z:500,cleared:0,combat:{kills:1000}});assert.equal(p.unlocked,1);assert.equal(p.selected,1);
 p.selected=0;tracker.record(p,{z:1500,cleared:0,combat:{kills:0}});assert.equal(p.unlocked,2);assert.equal(p.selected,0);
 const loaded=cleanBikeProgress(p);assert.equal(loaded.unlocked,2);assert.equal(loaded.selected,0);
});
test('all seven badges can be earned and invalid saved values are bounded',()=>{
 const p=cleanBikeProgress(undefined),tracker=new BikeProgressTracker();
 for(const tier of BIKE_TIERS.slice(1)){p.legacyXp=tier.xp;tracker.record(p,{z:tier.distance,cleared:0,combat:{kills:0}});assert.ok(p.unlocked>=BIKE_TIERS.indexOf(tier));}
 assert.equal(p.unlocked,7);
 const bad=cleanBikeProgress({version:1,distance:Infinity,kills:-3,cleared:NaN,selected:99,unlocked:3,celebrated:100});assert.equal(bad.distance,0);assert.equal(bad.kills,0);assert.equal(bad.cleared,0);assert.equal(bad.selected,3);assert.equal(bad.celebrated,3);
});
test('preview starts cannot award the skipped distance',()=>{
 const p=cleanBikeProgress(undefined),tracker=new BikeProgressTracker(),run={z:30000,cleared:0,combat:{kills:0}};tracker.start(run);run.z+=100;tracker.record(p,run);assert.equal(p.distance,100);assert.equal(masteryXp(p),10);
});

test('the original 50 km Horizon achievement does not acquire an extra XP gate',()=>{const p=cleanBikeProgress(undefined);new BikeProgressTracker().record(p,{z:50000,cleared:0,combat:{kills:0}});assert.equal(p.unlocked,7);assert.equal(p.selected,7);});
