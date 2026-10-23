import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Race,type Gate} from '../src/game';
import {COMBAT,ENEMY_TYPES} from '../src/config';
import {trackPoint} from '../src/combat-space';
import {OrbitalGuard,vanguardEnabled} from '../src/vanguard';
import {VanguardView} from '../src/vanguard-view';
import {vanguardStatus,vanguardHud} from '../src/vanguard-ui';
import {garageMarkup} from '../src/garage';
import {BikeProgressTracker,cleanBikeProgress} from '../src/bike-progress';
import {setLocale,t} from '../src/i18n';
import {synthEffect} from '../src/sfx-bank';
function run(tier=4){const r=new Race(2249,tier);r.gates=[];r.rifts=[];r.stream.nextZ=r.riftStream.nextZ=r.ship.nextZ=r.meteors.nextZ=1e6;return r;}
function pickup(r:Race,id:number,lane=0){const g:Gate={id,z:r.z+13,safe:0,blocked:[1,2,3],kind:'barrier',phase:0,cluster:0,checkpoint:false,energyLane:lane};r.gates=[g];r.step(.06);}
function charge(r:Race,n=5,start=0){for(let i=0;i<n;i++)pickup(r,start+i);r.gates=[];}
function target(r:Race,hp=2){const e=r.combat.enemies[0];Object.assign(e,{active:true,training:false,pursuing:false,kind:'manta',flight:'level',motion:undefined,defense:undefined,id:100,gateId:-1,z:r.z+60,surface:0,visualSurface:0,lane:0,hp,maxHp:hp,age:3,fired:true,dead:0});return e;}
function bullet(r:Race,index=0,lane=r.laneX){const p=trackPoint(r.z,r.surface,lane,r.playerHeight);const b=r.combat.bolts[index];Object.assign(b,{active:true,hostile:true,z:r.z,surface:r.surface,lane,wx:p.x,wy:p.y,wz:p.z-.2,vx:0,vy:0,vz:24,life:2,enemyId:100,kind:'manta',targetSupport:undefined});return b;}
function tick(r:Race,seconds:number){for(let i=0;i<Math.round(seconds*120);i++)r.combat.update(r,1/120);}
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('five actual energy pickups deploy one guard without changing road rewards or turbo charge',()=>{
 const r=run(),base=run(0);for(let i=0;i<5;i++){pickup(r,i);pickup(base,i);assert.equal(r.combat.vanguard.count,i===4?1:0);assert.equal(r.score,base.score);assert.equal(r.energy,base.energy);assert.equal(r.boostCharge,base.boostCharge);near(r.z,base.z);}
 assert.equal(r.combat.vanguard.energy,0);near(r.combat.vanguard.remaining,20);assert.equal(r.events.filter(e=>e.type==='guardReady').length,1);
});
test('missed, duplicate, health and shield pickups do not charge a satellite',()=>{
 const r=run();pickup(r,1,1);assert.equal(r.combat.vanguard.energy,0);pickup(r,2);pickup(r,2);assert.equal(r.combat.vanguard.energy,1);
 for(const kind of ['health','shield'] as const)r.collectPickup({id:20+(kind==='shield'?1:0),z:r.z,safe:0,blocked:[],kind:'barrier',phase:0,cluster:0,checkpoint:false,pickup:{kind,lane:0}});
 assert.equal(r.combat.vanguard.energy,1);
});
test('twenty simulation seconds gate production; waiting charge caps at five and full stock cannot bank a third',()=>{
 const g=new OrbitalGuard();for(let i=0;i<5;i++)g.collect(true);assert.equal(g.count,1);for(let i=0;i<20;i++)g.collect(true);assert.equal(g.energy,5);assert.equal(g.count,1);
 assert.equal(g.update(19.99,true),false);assert.equal(g.count,1);assert.equal(g.update(.01,true),true);assert.equal(g.count,2);assert.equal(g.energy,0);
 for(let i=0;i<20;i++)g.collect(true);assert.equal(g.energy,0);g.update(20,true);assert.equal(g.count,2);assert.equal(g.intercept(),true);assert.equal(g.update(1,true),false);for(let i=0;i<4;i++)assert.equal(g.collect(true),false);assert.equal(g.collect(true),true);assert.equal(g.count,2);
});
test('a real hostile collision preserves shield, health and combo and physically returns exactly one damage',()=>{
 const r=run();charge(r);const e=target(r,1);r.shield=1;r.combo=4;const health=r.health;bullet(r);r.combat.update(r,1/120);
 assert.equal(r.combat.vanguard.count,0);assert.equal(r.shield,1);assert.equal(r.health,health);assert.equal(r.combo,4);assert.equal(r.combat.vanguard.counters.filter(s=>s.active).length,1);assert.equal(r.events.filter(e=>e.type==='guardBlock').length,1);
 tick(r,.7);assert.equal(e.hp,0);assert.equal(r.combat.kills,1);assert.equal(r.events.filter(e=>e.type==='enemyHit').length,1);assert.equal(r.events.filter(e=>e.type==='kill').length,1);assert.equal(r.combat.hits,0);assert.equal(r.combat.shots,0);assert.equal(r.combat.heat,0);assert.ok(r.score>=ENEMY_TYPES.manta.points);tick(r,1);assert.equal(r.combat.kills,1);
});
test('two satellites block two simultaneous bullets; the third damages the rider',()=>{
 const r=run(),g=r.combat.vanguard;g.satellites.fill(true);const health=r.health;bullet(r,0);bullet(r,1);bullet(r,2);r.combat.update(r,1/120);
 assert.equal(g.count,0);assert.equal(g.counters.filter(s=>s.active).length,2);assert.equal(r.events.filter(e=>e.type==='guardBlock').length,2);assert.equal(r.health,health-1);
});
test('normal projectile pool saturation cannot consume the countershot reserve',()=>{
 const r=run(),g=r.combat.vanguard;g.satellites.fill(true);for(let i=0;i<COMBAT.bolts;i++)bullet(r,i,4);bullet(r,0);bullet(r,1);r.combat.update(r,1/120);assert.equal(g.counters.filter(s=>s.active).length,2);assert.equal(r.combat.bolts.length,COMBAT.bolts);assert.equal(r.health,3);
});
test('obstacles are not blocked; near misses, other surfaces, support targets and invulnerability spend no satellite',()=>{
 for(const mode of ['obstacle','miss','surface','support','invulnerable'] as const){const r=run();charge(r);const health=r.health;
  if(mode==='obstacle')r.damage('obstacle');else{const b=bullet(r,0,mode==='miss'?4:0);if(mode==='surface')b.surface=1;if(mode==='support')b.targetSupport=0;if(mode==='invulnerable')r.invulnerable=1;r.combat.update(r,1/120);}
  assert.equal(r.combat.vanguard.count,1,mode);assert.equal(r.health,mode==='obstacle'?health-1:health,mode);assert.equal(r.events.some(e=>e.type==='guardBlock'),false,mode);
 }
});
test('only equipped Vanguard outside training, flight, portals and failed runs activates guard',()=>{
 for(let tier=0;tier<8;tier++){const r=run(tier);charge(r);assert.equal(r.combat.vanguard.count,tier===4?1:0);}
 for(const mode of ['training','ship','transit','failed'] as const){const r=run();r.combat.vanguard.satellites[0]=true;if(mode==='training')r.training={step:0,limit:100};if(mode==='ship')r.ship.active=true;if(mode==='failed')r.failed=true;if(mode==='transit')r.riftTransit={rift:{id:1,z:100,kind:'blue',surface:0,lane:0,jump:650,points:400},elapsed:0,jumped:false,mode:'enter'};assert.ok(!vanguardEnabled(r));for(let i=0;i<5;i++)r.combat.vanguard.collect(!!vanguardEnabled(r));assert.equal(r.combat.vanguard.energy,0);assert.equal(r.combat.vanguard.count,1);}
 const r=run(3);r.combat.vanguard.satellites[0]=true;const health=r.health;bullet(r);r.combat.update(r,1/120);assert.equal(r.health,health-1);assert.equal(r.combat.vanguard.count,1);
});
test('pending production waits until valid ground mode, while transit clears shots and keeps charge and stock',()=>{
 const g=new OrbitalGuard();g.satellites[0]=true;g.energy=5;g.remaining=1;g.counters[0].active=true;assert.equal(g.update(2,false),false);assert.equal(g.count,1);g.clearShots();assert.equal(g.counters[0].active,false);assert.equal(g.energy,5);assert.equal(g.count,1);assert.equal(g.update(.01,true),true);assert.equal(g.count,2);
});
test('failed steps freeze guard, revive preserves its earned state, new runs start empty',()=>{
 const r=run();charge(r);const g=r.combat.vanguard;g.energy=3;g.counters[0].active=true;const remaining=g.remaining;r.failed=true;r.health=0;r.step(2);assert.equal(g.remaining,remaining);assert.equal(r.revive(),true);assert.equal(g.count,1);assert.equal(g.energy,3);assert.equal(g.remaining,remaining);assert.ok(g.counters.every(s=>!s.active));assert.equal(run().combat.vanguard.count,0);
});
test('countershots have finite lifetime, do not award accuracy and cannot hit training targets',()=>{
 const r=run();charge(r);const e=target(r,3);e.training=true;bullet(r);r.combat.update(r,1/120);tick(r,3);assert.equal(e.hp,3);assert.ok(r.combat.vanguard.counters.every(s=>!s.active));assert.equal(r.combat.hits,0);assert.equal(r.combat.shots,0);
});
test('Vanguard unlocked during a Hunter run applies only to the next run',()=>{
 const r=run(3),p=cleanBikeProgress({version:1,legacyXp:2400,best:3500,unlocked:3,selected:3}),tracker=new BikeProgressTracker();tracker.start(r);r.z=7000;assert.equal(tracker.record(p,r).unlocked,true);assert.equal(p.selected,4);assert.equal(r.bikeTier,3);charge(r);assert.equal(r.combat.vanguard.count,0);const next=run(p.selected);charge(next);assert.equal(next.combat.vanguard.count,1);
});
test('six locale garage descriptions, compact HUD and bounded models follow actual guard state',()=>{
 const r=run(),p=cleanBikeProgress({version:1,legacyXp:2400,best:7000,unlocked:4,selected:4});for(const locale of ['en','tr','de','es','fr','pt-BR']){setLocale(locale);const html=garageMarkup(p,4);assert.match(html,/vanguard-ability/);assert.ok(html.includes(t('ability.vanguard.short')));assert.doesNotMatch(t('ability.vanguard.energy',{count:5}),/\{/);}
 setLocale('en');assert.equal(vanguardStatus(r),'Guard · 0/2 · 0/5 ENERGY');assert.match(vanguardHud(r),/vanguard-status/);assert.equal(vanguardHud(run(3)),'');const view=new VanguardView(),origin={x:1,y:2,z:-3};charge(r);view.render(r,origin);assert.equal(view.satellites.filter(s=>s.visible).length,1);bullet(r);r.combat.update(r,1/120);view.render(r,origin);assert.equal(view.satellites.filter(s=>s.visible).length,0);assert.equal(view.pulses.filter(s=>s.visible).length,1);assert.equal(view.counters.filter(s=>s.visible).length,1);near(view.counters[0].position.x,r.combat.vanguard.counters[0].position.x-1);assert.match(vanguardStatus(r),/BLOCKED/);r.ship.active=true;view.render(r,origin);assert.equal(view.root.visible,false);assert.equal(view.root.children.length,6);
 const locked=garageMarkup(cleanBikeProgress({version:1,unlocked:3,selected:3}),4);assert.match(locked,/Orbital Guard/);assert.match(locked,/data-action="garageEquip" data-tier="4" disabled/);
});
test('deployment and block sounds are finite, end cleanly and ship in both native banks',()=>{
 for(const kind of ['guardReady','guardBlock'] as const){const samples=synthEffect(kind,44100);assert.ok(samples.every(Number.isFinite));assert.ok(samples.some(x=>Math.abs(x)>.05));assert.ok(Math.abs(samples.at(-1)!)<1e-5);for(const mode of ['game-effects','music-mode']){const wav=readFileSync(new URL(`../public/audio/${mode}/${kind}.wav`,import.meta.url));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.length-44,wav.readUInt32LE(40));assert.ok(wav.length>10000);}}
});
