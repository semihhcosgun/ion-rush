import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Race,CourseStream,type Gate} from '../src/game';
import {TUNE} from '../src/config';
import {OVERDRIVE as RUNNER,overdriveSurge as runnerSurge} from '../src/overdrive';
import {TurboFX} from '../src/turbo-fx';
import {MeteorField,meteorTuning} from '../src/meteors';
import {garageMarkup} from '../src/garage';
import {runnerStatus,runnerHud} from '../src/runner-ui';
import {BikeProgressTracker,cleanBikeProgress} from '../src/bike-progress';
import {setLocale,t} from '../src/i18n';
import {synthEffect} from '../src/sfx-bank';
function run(tier=2){const r=new Race(2249,tier);r.gates=[];r.rifts=[];r.stream.nextZ=r.riftStream.nextZ=r.ship.nextZ=r.meteors.nextZ=1e6;return r;}
function start(r:Race){r.boostCharge=1;assert.equal(r.activateTurbo(),true);}
function pickup(r:Race,id:number,lane=0){const g:Gate={id,z:r.z+13,safe:0,blocked:[1,2,3],kind:'barrier',phase:0,cluster:0,checkpoint:false,energyLane:lane};r.gates=[g];r.step(.06);return g;}
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('real energy collection strengthens shared turbo thrust and time, preserving scoring and next-turbo charge',()=>{
 const base=run(0),r=run();start(base);start(r);
 for(let i=0;i<5;i++){
  pickup(base,i);pickup(r,i);const bonus=Math.min(i+1,4)*RUNNER.perEnergy;
  near(r.overdrive.earned,bonus);near(r.boost,base.boost);near(r.speed-r.cruise,TUNE.boostExtra*(1+bonus));
  assert.equal(r.score,base.score);assert.equal(r.energy,base.energy);assert.equal(r.turboEnergy,base.turboEnergy);assert.equal(r.boostCharge,base.boostCharge);
 }
 near(r.z,base.z);assert.equal(r.overdrive.earned,2);assert.equal(r.boostCharge,1);
 assert.equal(r.events.filter(e=>e.type==='overdrive').length,4);assert.ok(r.events.filter(e=>e.type==='overdrive').every(e=>e.value===.5));
});
test('extended turbo expires at six seconds and resets thrust and duration budget for a new activation',()=>{
 const r=run();start(r);for(let i=0;i<5;i++)pickup(r,i);near(r.boost,6-.3);assert.equal(r.overdrive.earned,2);
 assert.equal(r.activateTurbo(),false);assert.equal(r.overdrive.earned,2);r.gates=[];
 for(let i=0;i<683;i++)r.step(1/120);assert.ok(r.boost>0);assert.equal(r.overdrive.earned,2);
 r.step(1/120);near(r.boost,0);assert.equal(r.overdrive.earned,0);near(r.speed,r.cruise);
 assert.equal(r.activateTurbo(),true);assert.equal(r.overdrive.earned,0);near(r.boost,3);pickup(r,99);assert.equal(r.overdrive.earned,.5);
});
test('missed or duplicate energy and health/shield pickups cannot build thrust',()=>{
 const r=run();start(r);pickup(r,1,1);assert.equal(r.overdrive.earned,0);pickup(r,2);pickup(r,2);assert.equal(r.energy,1);assert.equal(r.overdrive.earned,.5);
 for(const kind of ['health','shield'] as const)r.collectPickup({id:100+(kind==='shield'?1:0),z:r.z,safe:0,blocked:[],kind:'barrier',phase:0,cluster:0,checkpoint:false,pickup:{kind,lane:0}});
 assert.equal(r.overdrive.earned,.5);assert.equal(r.events.filter(e=>e.type==='overdrive').length,1);
});
test('expired turbo cannot restart, but a live last-moment pickup extends it',()=>{
 const r=run();pickup(r,1);assert.equal(r.overdrive.earned,0);assert.equal(r.boost,0);
 start(r);r.boost=.04;pickup(r,2);assert.equal(r.boost,0);assert.equal(r.overdrive.earned,0);
 start(r);r.boost=.061;pickup(r,3);near(r.boost,.751);assert.equal(r.overdrive.earned,.5);r.gates=[];r.step(.76);assert.equal(r.overdrive.earned,0);near(r.speed,r.cruise);
});
test('all eight bikes build thrust outside training, flight, transit and failed runs',()=>{
 for(let tier=0;tier<8;tier++){const r=run(tier);start(r);pickup(r,1);assert.equal(r.overdrive.earned,.5);}
 for(const mode of ['training','ship','transit','failed'] as const){
  const r=run();start(r);r.overdrive.earned=2;
  if(mode==='training')r.training={step:0,limit:100};if(mode==='ship'){r.ship.active=true;r.ship.elapsed=2;}if(mode==='failed')r.failed=true;
  if(mode==='transit')r.riftTransit={rift:{id:1,z:100,kind:'blue',surface:0,lane:0,jump:650,points:400},elapsed:0,jumped:false,mode:'enter'};
  const base=run(0);base.z=r.z;base.boost=r.boost;base.training=r.training;base.ship.active=r.ship.active;base.ship.elapsed=r.ship.elapsed;base.riftTransit=r.riftTransit;base.failed=r.failed;near(r.speed,base.speed);
  r.overdrive.earned=0;pickup(r,1);assert.equal(r.overdrive.earned,0,mode);assert.equal(r.events.some(e=>e.type==='overdrive'),false,mode);
 }
});
test('late Runner turbo has a bounded extra sixteen units of speed and course gaps retain reaction time',()=>{
 const r=run();r.z=100000;start(r);r.overdrive.earned=2;near(r.speed,82);r.boost=0;near(r.speed,58);
 const required=TUNE.recharge+TUNE.shiftDuration+TUNE.reactionTime;
 for(let seed=0;seed<50;seed++){const stream=new Race(seed,2).stream;let prev=0;for(let i=0;i<100;i++){const g=stream.next();assert.ok((g.z-prev-2*TUNE.collisionHalfWidth)/82>=required);prev=g.z;}}
});
test('meteor landing projection includes earned thrust and the remaining three-second turbo timer',()=>{
 let direct=0;for(let seed=0;seed<40;seed++){
  const r=run();r.z=6000;r.boost=.7;r.overdrive.earned=2;r.meteors=new MeteorField(seed);r.meteors.spawn(r);const m=r.meteors.items[0];if(!m.targeted)continue;direct++;const warning=meteorTuning(r.z).warning;near(m.z-r.z,r.cruise*warning+(r.speed-r.cruise)*Math.min(r.boost,warning));
 }assert.ok(direct>0);
});
test('pause freezes earned thrust and flash; revive preserves an active budget; a fresh run has none',()=>{
 const r=run();start(r);for(let i=0;i<4;i++)pickup(r,i);const state={boost:r.boost,earned:r.overdrive.earned,flash:r.overdrive.flash};r.failed=true;r.health=0;r.step(1);assert.deepEqual({boost:r.boost,earned:r.overdrive.earned,flash:r.overdrive.flash},state);assert.equal(r.revive(),true);pickup(r,90);assert.equal(r.overdrive.earned,2);near(r.boost,state.boost-.06);assert.equal(run().overdrive.earned,0);
});
test('unlocking Runner does not change the shared overdrive mechanic',()=>{
 const r=run(1),p=cleanBikeProgress({version:1,legacyXp:450,best:500,unlocked:1,selected:1}),tracker=new BikeProgressTracker();tracker.start(r);r.z=1500;assert.equal(tracker.record(p,r).unlocked,true);assert.equal(p.selected,2);start(r);pickup(r,1);assert.equal(r.overdrive.earned,.5);const next=run(p.selected);start(next);pickup(next,1);assert.equal(next.overdrive.earned,.5);
});
test('six localized Runner descriptions and the shared HUD expose the new ability and thrust',()=>{
 const p=cleanBikeProgress({version:1,legacyXp:450,best:1500,unlocked:2,selected:2}),r=run();
 for(const locale of ['en','tr','de','es','fr','pt-BR']){setLocale(locale);const html=garageMarkup(p,2);assert.match(html,/Momentum/);assert.ok(html.includes(t('ability.runner.short')));assert.doesNotMatch(t('ability.runner.perPass',{count:1}),/\{/);assert.ok(t('ability.description2').includes('1'));}
 setLocale('en');const locked=garageMarkup(cleanBikeProgress({version:1,unlocked:1,selected:1}),2);assert.match(locked,/data-action="garageEquip" data-tier="2" disabled/);assert.match(runnerHud(r),/runner-status/);assert.match(runnerHud(run(1)),/runner-status/);assert.equal(runnerStatus(r),'Momentum · CLEAN PASS');start(r);pickup(r,1);assert.equal(runnerStatus(r),'Overdrive · +50% THRUST');for(let i=2;i<=4;i++)pickup(r,i);assert.equal(runnerStatus(r),'Overdrive · +200% MAX');
});
test('turbo jets show a sustained thrust accent plus pickup flash, cleared when turbo ends',()=>{
 const fx=new TurboFX();fx.update(.1,true,1,RUNNER.flashDuration,2);const plume=fx.root.children[0] as any;assert.equal(fx.root.visible,true);assert.equal(plume.material.uniforms.overdrive.value,1);fx.update(.1,true,1,0,2);near(plume.material.uniforms.overdrive.value,.8);fx.update(.1,false,1,.36,2);assert.equal(plume.material.uniforms.overdrive.value,0);
});
test('the original turbo reused for Overdrive remains finite, ends cleanly and ships in both native sound banks',()=>{
 const samples=synthEffect('overdrive',44100);assert.ok(samples.every(Number.isFinite));assert.ok(samples.some(x=>Math.abs(x)>.05));assert.ok(Math.abs(samples.at(-1)!)<.001);for(const mode of ['game-effects','music-mode']){const wav=readFileSync(new URL(`../public/audio/${mode}/overdrive.wav`,import.meta.url));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.length-44,wav.readUInt32LE(40));assert.ok(wav.length>10000);}
});

test('every thrust step expands the view; pickup pulse subsides without losing earned speed feedback',()=>{
 let previous=0,previousKick=0;for(let energy=1;energy<=4;energy++){const earned=energy*RUNNER.perEnergy,hit=runnerSurge(earned,RUNNER.flashDuration),steady=runnerSurge(earned,0),kick=hit.fov-steady.fov;assert.ok(hit.fov>steady.fov);assert.ok(steady.fov>previous);assert.ok(kick>previousKick,'successive pickups produce a stronger pull pulse');previous=steady.fov;previousKick=kick;}near(runnerSurge(0,RUNNER.flashDuration).fov,0);near(runnerSurge(RUNNER.maxExtra,0).fov,10);near(runnerSurge(RUNNER.maxExtra,RUNNER.flashDuration).fov,14);
});
test('all bikes earn at most three extra seconds from real orbs, and duplicates or Momentum cannot extend it',()=>{
 for(let tier=0;tier<8;tier++){
  const r=run(tier);r.bonusEnergy=[];start(r);let elapsed=0;
  for(let i=0;i<12;i++){
   r.gates=[];r.bonusEnergy=[{id:i,z:r.z+1,surface:r.surface,lane:r.lane}];r.step(.06);elapsed+=.06;
   near(r.overdrive.extended,Math.min(i+1,4)*RUNNER.perEnergyDuration);
   near(r.boost,3+Math.min(i+1,4)*RUNNER.perEnergyDuration-elapsed);
   const before=r.boost;r.z-=1;r.step(.06);elapsed+=.06;near(r.boost,before-.06);
  }
  near(r.overdrive.extended,3);r.gates=[];r.bonusEnergy=[];
  if(tier===6)near(r.phase.remaining,0);
  for(let n=0;n<800&&r.boost>0;n++)r.step(1/120);
  near(r.boost,0);near(r.overdrive.extended,0);assert.ok(r.activateTurbo());near(r.boost,3);near(r.overdrive.extended,0);
 }
 const runner=run(2);start(runner);runner.z=12;runner.gates=[{id:88,z:10,safe:0,blocked:[1,2,3],kind:'barrier',phase:0,cluster:0,checkpoint:false}];runner.step(.1);near(runner.boost,2.9);near(runner.overdrive.extended,0);
});
