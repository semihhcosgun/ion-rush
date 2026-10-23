import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {Race,type Gate} from '../src/game';
import {COMBAT,ENEMY_TYPES} from '../src/config';
import {enemyPoint,trackPoint} from '../src/combat-space';
import {TITAN,titanEnabled} from '../src/titan';
import {TitanView} from '../src/titan-view';
import {titanHud,titanStatus} from '../src/titan-ui';
import {garageMarkup} from '../src/garage';
import {BikeProgressTracker,cleanBikeProgress} from '../src/bike-progress';
import {setLocale,t} from '../src/i18n';
import {SFX_DURATION,synthEffect} from '../src/sfx-bank';
function run(tier=5){const r=new Race(2249,tier);r.gates=[];r.rifts=[];r.stream.nextZ=r.riftStream.nextZ=r.ship.nextZ=r.meteors.nextZ=1e6;return r;}
function pickup(r:Race,id:number,lane=0){const g:Gate={id,z:r.z+13,safe:0,blocked:[1,2,3],kind:'barrier',phase:0,cluster:0,checkpoint:false,energyLane:lane};r.gates=[g];r.step(.06);}
function charge(r:Race,n=8,start=0){for(let i=0;i<n;i++)pickup(r,start+i);r.gates=[];}
function enemy(r:Race,index=0,hp=6){const e=r.combat.enemies[index];Object.assign(e,{active:true,training:false,pursuing:false,kind:'manta',flight:'level',motion:undefined,defense:undefined,id:100+index,gateId:-1,z:r.z+80,surface:0,visualSurface:0,lane:0,hp,maxHp:hp,age:3,fired:true,dead:0});return e;}
function fire(r:Race,e=enemy(r)){r.combat.aimWorld=enemyPoint(e);r.firing=true;r.combat.update(r,1/120);r.firing=false;}
function tick(r:Race,n:number){for(let i=0;i<Math.round(n*120);i++)r.combat.update(r,1/120);}
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('eight real road energy pickups prepare one beam, preserving energy score and turbo charge',()=>{
 const r=run(),base=run(0);for(let i=0;i<8;i++){pickup(r,i);pickup(base,i);assert.equal(r.combat.titan.ready,i===7);assert.equal(r.score,base.score);assert.equal(r.energy,base.energy);assert.equal(r.boostCharge,base.boostCharge);near(r.z,base.z);}
 assert.equal(r.events.filter(e=>e.type==='siegeReady').length,1);charge(r,5,20);assert.equal(r.combat.titan.energy,8);assert.equal(r.events.filter(e=>e.type==='siegeReady').length,1);
});
test('missing, duplicate, health and shield pickups cannot charge the beam',()=>{
 const r=run();pickup(r,1,1);assert.equal(r.combat.titan.energy,0);pickup(r,2);pickup(r,2);assert.equal(r.combat.titan.energy,1);for(const kind of ['health','shield'] as const)r.collectPickup({id:20+(kind==='shield'?1:0),z:r.z,safe:0,blocked:[],kind:'barrier',phase:0,cluster:0,checkpoint:false,pickup:{kind,lane:0}});assert.equal(r.combat.titan.energy,1);
});
test('next fire replaces normal shots for two seconds, adds thirty heat once and delivers spaced damage',()=>{
 const r=run();charge(r);const e=enemy(r);fire(r,e);const beam=r.combat.titan;assert.equal(beam.active,true);assert.equal(beam.energy,0);assert.equal(beam.remaining,25);assert.equal(r.combat.heat,30);assert.equal(r.combat.shots,0);assert.equal(r.combat.bolts.some(b=>b.active&&!b.hostile),false);assert.equal(e.hp,6);
 tick(r,.6);assert.equal(e.hp,6);tick(r,.075);assert.equal(e.hp,5);tick(r,1.325);assert.equal(e.hp,3);assert.equal(beam.active,false);assert.equal(r.combat.hits,0);assert.equal(r.events.filter(e=>e.type==='enemyHit').length,3);assert.equal(r.events.filter(e=>e.type==='siegeBeam').length,1);assert.ok(r.combat.heat<=30);
 r.firing=true;r.combat.update(r,1/120);assert.equal(r.combat.shots,1);
});
test('pierces only three distinct targets with three total damage each and ordinary kill rewards once',()=>{
 const r=run();charge(r);const before=r.score,enemies=[0,1,2,3].map(i=>enemy(r,i,3));fire(r,enemies[0]);tick(r,2.1);assert.deepEqual(enemies.map(e=>e.hp),[0,0,0,3]);assert.equal(r.combat.kills,3);assert.equal(r.events.filter(e=>e.type==='kill').length,3);assert.equal(r.score,before+3*ENEMY_TYPES.manta.points);assert.equal(r.combat.titan.damage.size,3);assert.ok([...r.combat.titan.damage.values()].every(v=>v===3));tick(r,2);assert.equal(r.combat.kills,3);
});
test('beam requires alignment and range, cannot home or hit behind the muzzle or training targets',()=>{
 for(const mode of ['wide','range','behind','training'] as const){const r=run();charge(r);const aimed=enemy(r,0,6),other=enemy(r,1,6);if(mode==='wide')other.lane=5;if(mode==='range')other.z=r.z+300;if(mode==='behind')other.z=r.z-10;if(mode==='training')other.training=true;fire(r,aimed);tick(r,2);assert.equal(other.hp,6,mode);assert.equal(aimed.hp,3,mode);}
 const r=run();charge(r);const e=enemy(r);fire(r,e);e.lane=5;tick(r,2);assert.equal(e.hp,6);
});
test('sweeping aim cannot replace already reserved target IDs with a fourth enemy',()=>{
 const r=run();charge(r);const targets=[0,1,2,3].map(i=>enemy(r,i,8));for(let i=0;i<4;i++)targets[i].lane=i*4;fire(r,targets[0]);tick(r,.66);r.combat.aimWorld=enemyPoint(targets[1]);tick(r,.67);r.combat.aimWorld=enemyPoint(targets[2]);tick(r,.67);assert.equal(r.combat.titan.damage.size,3);assert.deepEqual(targets.map(e=>e.hp),[7,7,7,8]);assert.equal(r.combat.hits,0);
});
test('twenty-five simulation seconds AND eight fresh energy are required; full charge caps at one',()=>{
 const r=run();charge(r);fire(r);tick(r,2);for(const e of r.combat.enemies)e.active=false;charge(r,20,100);assert.equal(r.combat.titan.energy,8);assert.equal(r.combat.titan.ready,false);const remaining=r.combat.titan.remaining;for(let i=0;i<Math.floor((remaining-.02)*120);i++)r.step(1/120);assert.equal(r.combat.titan.ready,false);r.step(.03);assert.equal(r.combat.titan.ready,true);assert.equal(r.events.filter(e=>e.type==='siegeReady').length,2);r.step(.1);assert.equal(r.events.filter(e=>e.type==='siegeReady').length,2);
 const x=run();charge(x);fire(x);tick(x,2);for(const e of x.combat.enemies)e.active=false;for(let i=0;i<25*120;i++)x.step(1/120);assert.equal(x.combat.titan.ready,false);assert.equal(x.combat.titan.energy,0);charge(x,8,100);assert.equal(x.combat.titan.ready,true);
});
test('locked guns retain prepared charge; starting near maximum heat locks normally but finishes the beam',()=>{
 const r=run();charge(r);r.combat.locked=true;r.combat.heat=90;r.firing=true;r.combat.update(r,1/120);assert.equal(r.combat.titan.ready,true);assert.equal(r.combat.titan.active,false);assert.equal(r.events.some(e=>e.type==='siegeBeam'),false);
 r.combat.locked=false;r.combat.heat=90;const e=enemy(r);r.combat.aimWorld=enemyPoint(e);r.combat.update(r,1/120);assert.equal(r.combat.heat,100);assert.equal(r.combat.locked,true);assert.equal(r.combat.titan.active,true);r.firing=false;tick(r,2);assert.equal(e.hp,3);assert.equal(r.combat.locked,true);
});
test('beam bypasses full ordinary bolt pool without enlarging it or blocking hostile bullets',()=>{
 const r=run();charge(r);for(const b of r.combat.bolts)Object.assign(b,{active:true,hostile:true,z:r.z+40,wx:100,wy:100,wz:-r.z-40,vx:0,vy:0,vz:10,life:3,surface:0});const e=enemy(r);fire(r,e);tick(r,2);assert.equal(e.hp,3);assert.equal(r.combat.bolts.length,COMBAT.bolts);assert.equal(r.combat.shots,0);
 const x=run();charge(x);fire(x);const p=trackPoint(x.z,x.surface,x.laneX,x.playerHeight);Object.assign(x.combat.bolts[0],{active:true,hostile:true,z:x.z,wx:p.x,wy:p.y,wz:p.z-.2,vx:0,vy:0,vz:20,life:1,surface:x.surface});x.combat.update(x,1/120);assert.equal(x.health,2);
});
test('only equipped Titan can charge or start; training, flight, portal, failure and shifts exclude beam',()=>{
 for(let tier=0;tier<8;tier++){const r=run(tier);charge(r);assert.equal(r.combat.titan.ready,tier===5);}
 for(const mode of ['training','ship','transit','failed','shift'] as const){const r=run();charge(r);if(mode==='training')r.training={step:0,limit:100};if(mode==='ship')r.ship.active=true;if(mode==='transit')r.riftTransit={rift:{id:1,z:100,kind:'blue',surface:0,lane:0,jump:650,points:400},elapsed:0,jumped:false,mode:'enter'};if(mode==='failed')r.failed=true;if(mode==='shift')r.shiftLeft=.2;r.firing=true;r.combat.update(r,.01);assert.equal(r.combat.titan.active,false,mode);assert.equal(r.combat.titan.energy,8,mode);}
});
test('flight, portal and shifts cancel active beam without refund; revive preserves pending charge and cooldown',()=>{
 for(const mode of ['ship','transit','shift'] as const){const r=run();charge(r);fire(r);const remaining=r.combat.titan.remaining;if(mode==='ship')r.ship.active=true;if(mode==='transit')r.combat.clearTransit();if(mode==='shift')r.shiftLeft=.2;r.combat.update(r,.01);assert.equal(r.combat.titan.active,false,mode);assert.equal(r.combat.titan.energy,0,mode);assert.equal(r.combat.titan.remaining,remaining,mode);}
 const r=run();charge(r);fire(r);tick(r,.4);r.combat.titan.energy=2;const snapshot=[r.combat.titan.remaining,r.combat.titan.elapsed];r.failed=true;r.health=0;r.step(1);assert.deepEqual([r.combat.titan.remaining,r.combat.titan.elapsed],snapshot);assert.equal(r.revive(),true);assert.equal(r.combat.titan.active,false);assert.equal(r.combat.titan.energy,2);assert.equal(r.combat.titan.remaining,snapshot[0]);assert.equal(run().combat.titan.energy,0);
});
test('beam follows current manual aim, finishes after release and never consumes energy during its burst',()=>{
 const r=run();charge(r);const a=enemy(r),b=enemy(r,1);b.lane=5;fire(r,a);tick(r,.67);assert.equal(a.hp,5);r.combat.aimWorld=enemyPoint(b);r.combat.update(r,.01);for(let i=0;i<8;i++)r.combat.titan.collect(true);assert.equal(r.combat.titan.energy,0);tick(r,1.32);assert.equal(a.hp,5);assert.equal(b.hp,4);assert.equal(r.combat.titan.active,false);
});
test('mid-run Titan unlock affects the next run only',()=>{
 const r=run(4),p=cleanBikeProgress({version:1,legacyXp:5000,best:7000,unlocked:4,selected:4}),tracker=new BikeProgressTracker();tracker.start(r);r.z=14000;assert.equal(tracker.record(p,r).unlocked,true);assert.equal(p.selected,5);charge(r);assert.equal(r.combat.titan.energy,0);const next=run(p.selected);charge(next);assert.equal(next.combat.titan.ready,true);
});
test('six locale Garage/HUD and a bounded golden beam model reflect live and locked states',()=>{
 const r=run(),p=cleanBikeProgress({version:1,legacyXp:5000,best:14000,unlocked:5,selected:5});for(const locale of ['en','tr','de','es','fr','pt-BR']){setLocale(locale);const html=garageMarkup(p,5);assert.match(html,/titan-ability/);assert.ok(html.includes(t('ability.titan.short')));assert.doesNotMatch(t('ability.titan.damage',{targets:3,damage:3}),/\{/);assert.ok(t('ability.description5').includes('30'));}setLocale('en');assert.equal(titanStatus(r),'Beam · 0/8 ENERGY');assert.match(titanHud(r),/titan-status/);assert.equal(titanHud(run(4)),'');charge(r);assert.equal(titanStatus(r),'Beam · FIRE TO USE');fire(r);const view=new TitanView(),origin={x:1,y:2,z:-3};view.render(r,origin);assert.equal(view.root.visible,true);assert.equal(view.root.children.length,3);near(view.core.scale.y,TITAN.range);assert.ok(view.core.position.distanceTo(r.combat.titan.from.clone().add(r.combat.titan.to).multiplyScalar(.5).sub(new THREE.Vector3(1,2,-3)))<1e-7);assert.equal(titanStatus(r),'Beam · FIRING');r.ship.active=true;view.render(r,origin);assert.equal(view.root.visible,false);
 const locked=garageMarkup(cleanBikeProgress({version:1,unlocked:4,selected:4}),5);assert.match(locked,/Siege Beam/);assert.match(locked,/data-action="garageEquip" data-tier="5" disabled/);
});
test('beam and ready cues are finite, fade cleanly and are present in both native audio banks',()=>{
 assert.equal(SFX_DURATION.siegeBeam,TITAN.duration);
 for(const kind of ['siegeReady','siegeBeam'] as const){const samples=synthEffect(kind,44100);assert.ok(samples.every(Number.isFinite));assert.ok(samples.some(x=>Math.abs(x)>.05));assert.ok(Math.abs(samples.at(-1)!)<1e-5);for(const mode of ['game-effects','music-mode']){const wav=readFileSync(new URL(`../public/audio/${mode}/${kind}.wav`,import.meta.url));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.length-44,wav.readUInt32LE(40));assert.ok(wav.length>10000);if(kind==='siegeBeam'&&mode==='game-effects')assert.equal(wav.readUInt32LE(40)/2/44100,TITAN.duration);}}
});

test('a forward beam does not auto-aim at an elevated enemy and can be redirected after the old one-second limit',()=>{
 const r=run();charge(r);const e=enemy(r);r.firing=true;r.combat.update(r,1/120);r.firing=false;tick(r,1.1);assert.equal(e.hp,6);assert.equal(r.combat.titan.active,true);r.combat.aimWorld=enemyPoint(e);tick(r,.9);assert.equal(e.hp,4);assert.equal(r.combat.titan.active,false);assert.equal(r.combat.shots,0);assert.equal(r.combat.titan.damage.get(e.id),2);
});
test('the beam remains visibly lit after one second and fades only at the new end',()=>{
 const r=run();charge(r);fire(r);tick(r,1.5);const view=new TitanView();view.render(r,{x:0,y:0,z:0});assert.equal(view.root.visible,true);assert.ok(view.core.scale.x>.1);assert.ok(view.halo.scale.x>.4);tick(r,.5);view.render(r,{x:0,y:0,z:0});assert.equal(view.root.visible,false);
});
