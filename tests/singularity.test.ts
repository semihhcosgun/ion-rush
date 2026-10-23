import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {Race,type Gate} from '../src/game';
import {COMBAT,ENEMY_TYPES} from '../src/config';
import {trackPoint} from '../src/combat-space';
import {SINGULARITY,singularityEnabled} from '../src/singularity';
import {SingularityView} from '../src/singularity-view';
import {singularityHud,singularityStatus} from '../src/singularity-ui';
import {garageMarkup} from '../src/garage';
import {BikeProgressTracker,cleanBikeProgress} from '../src/bike-progress';
import {setLocale,t} from '../src/i18n';
import {synthEffect} from '../src/sfx-bank';
function run(tier=7){const r=new Race(2249,tier);r.gates=[];r.rifts=[];r.stream.nextZ=r.riftStream.nextZ=r.ship.nextZ=r.meteors.nextZ=1e6;return r;}
function pickup(r:Race,id:number,lane=0){const g:Gate={id,z:r.z+13,safe:0,blocked:[1,2,3],kind:'barrier',phase:0,cluster:0,checkpoint:false,energyLane:lane};r.gates=[g];r.step(.06);}
function charge(r:Race,n=12,start=0){for(let i=0;i<n;i++)pickup(r,start+i);r.gates=[];}
function wait(r:Race,seconds:number){for(let i=0;i<Math.floor(seconds*120);i++)r.step(1/120);}
function prepared(){const r=run();charge(r);wait(r,40);return r;}
function open(r:Race){assert.equal(r.activateSingularity(),true);r.combat.update(r,SINGULARITY.launchDuration);assert.equal(r.combat.singularity.active,true);}
function enemy(r:Race,index=0,hp=6,offset=40){const e=r.combat.enemies[index];Object.assign(e,{active:true,training:false,pursuing:false,kind:'manta',flight:'level',motion:undefined,defense:undefined,gravity:undefined,id:100+index,gateId:-1,z:r.z+offset,surface:0,visualSurface:0,lane:0,hp,maxHp:hp,age:3,fired:true,dead:0,volley:0,charge:0});return e;}
function bullet(r:Race,index=0,hostile=true,core=false){const p=trackPoint(r.z+(core?SINGULARITY.forward:0),r.surface,r.laneX,r.playerHeight+(core?1:0));const b=r.combat.bolts[index];Object.assign(b,{active:true,hostile,z:r.z,surface:r.surface,lane:r.laneX,wx:p.x,wy:p.y,wz:p.z-.2,vx:0,vy:0,vz:24,life:2,enemyId:777,kind:'manta',targetSupport:undefined,supportIndex:undefined});return b;}
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('twelve real pickups preserve ordinary energy, score, speed and turbo; first use waits forty seconds',()=>{
 const r=run(),base=run(0);for(let i=0;i<12;i++){pickup(r,i);pickup(base,i);assert.equal(r.score,base.score);assert.equal(r.energy,base.energy);assert.equal(r.boostCharge,base.boostCharge);near(r.z,base.z);}assert.equal(r.combat.singularity.energy,12);assert.equal(r.combat.singularity.ready,false);r.gates=[];wait(r,39.2);assert.equal(r.combat.singularity.ready,false);r.step(.1);assert.equal(r.combat.singularity.ready,true);assert.equal(r.events.filter(e=>e.type==='singularityReady').length,1);charge(r,8,100);assert.equal(r.combat.singularity.energy,12);assert.equal(r.events.filter(e=>e.type==='singularityReady').length,1);
});
test('time alone, missed/duplicate pickups, health and shield cannot supply charge',()=>{
 const r=run();wait(r,41);assert.equal(r.combat.singularity.ready,false);pickup(r,1,1);assert.equal(r.combat.singularity.energy,0);pickup(r,2);pickup(r,2);assert.equal(r.combat.singularity.energy,1);for(const kind of ['health','shield'] as const)r.collectPickup({id:20+(kind==='shield'?1:0),z:r.z,safe:0,blocked:[],kind:'barrier',phase:0,cluster:0,checkpoint:false,pickup:{kind,lane:0}});assert.equal(r.combat.singularity.energy,1);
});
test('nearby threats never spend a banked charge; manual throw spends once and preserves normal firing',()=>{
 const r=prepared(),s=r.combat.singularity;wait(r,2);const e=enemy(r);r.firing=true;r.combat.aimWorld=trackPoint(r.z+90,0,5,8);r.combat.update(r,1/120);
 assert.equal(s.ready,true);assert.equal(s.busy,false);assert.equal(r.combat.shots,1);assert.equal(e.hp,6);
 assert.equal(r.activateSingularity(),true);assert.equal(r.activateSingularity(),false);assert.equal(s.launching,true);assert.equal(s.active,false);assert.equal(s.energy,0);assert.equal(s.remaining,40);
 r.combat.update(r,.15);assert.equal(s.active,false);assert.equal(e.hp,6);assert.ok(!e.gravity?.offset.lengthSq());const midpoint=s.center.clone();
 r.combat.update(r,.15);assert.equal(s.launching,false);assert.equal(s.active,true);assert.ok(s.center.distanceTo(midpoint)>5);assert.equal(r.events.filter(e=>e.type==='singularityOpen').length,1);assert.equal(s.targets.size,0);
});
test('manual deployment works on an empty road and cannot bank energy while airborne',()=>{
 const r=prepared(),s=r.combat.singularity;assert.equal(r.activateSingularity(),true);for(let i=0;i<12;i++)s.collect(true);assert.equal(s.energy,0);r.step(.1);
 const snap=[s.launchElapsed,s.remaining,s.elapsed];r.failed=true;r.step(1);assert.deepEqual([s.launchElapsed,s.remaining,s.elapsed],snap);r.revive();assert.equal(s.busy,false);assert.equal(s.energy,0);
});
test('absorbs a swept fast projectile before player impact, including escort-targeted shots; friendly fire remains',()=>{
 const r=prepared();enemy(r);open(r);const p=trackPoint(r.z,r.surface,r.laneX,r.playerHeight),b=bullet(r);const c=r.combat.singularity.center,d=c.clone().sub(p).normalize();b.wx=c.x+d.x*60;b.wy=c.y+d.y*60;b.wz=c.z+d.z*60;b.z=-b.wz;b.vx=-d.x*12000;b.vy=-d.y*12000;b.vz=-d.z*12000;const friend=bullet(r,1,false),escort=bullet(r,2,true,true);escort.targetSupport=0;r.combat.update(r,.01);assert.equal(b.active,false);assert.equal(escort.active,false);assert.equal(friend.active,true);assert.equal(r.combat.singularity.absorbed,2);assert.equal(r.health,3);
});
test('distant, immature, dead and tutorial enemies and distant/friendly bullets cannot waste a prepared charge',()=>{
 for(const mode of ['distant','immature','dead','training','distantBullet','friendlyBullet'] as const){const r=prepared();if(mode==='distantBullet'){const b=bullet(r);b.wx=100;}else if(mode==='friendlyBullet')bullet(r,0,false);else{const e=enemy(r);if(mode==='distant')e.z=r.z+150;if(mode==='immature')e.age=.1;if(mode==='dead')e.hp=0;if(mode==='training')e.training=true;}r.combat.update(r,.01);assert.equal(r.combat.singularity.ready,true,mode);assert.equal(r.combat.singularity.active,false,mode);}
});
test('two second window expires, does not extend invulnerability, and needs fresh energy AND cooldown',()=>{
 const r=prepared(),s=r.combat.singularity;enemy(r);open(r);for(let i=0;i<12;i++)s.collect(true);assert.equal(s.energy,0);for(let i=0;i<239;i++)r.combat.update(r,1/120);assert.equal(s.active,true);r.combat.update(r,.01);assert.equal(s.active,false);assert.equal(r.invulnerable,0);bullet(r);r.combat.update(r,1/120);assert.equal(r.health,2);for(const e of r.combat.enemies)e.active=false;charge(r,12,100);assert.equal(s.energy,12);assert.equal(s.ready,false);const time=s.remaining;wait(r,time-.02);assert.equal(s.ready,false);r.step(.03);assert.equal(s.ready,true);assert.equal(r.events.filter(e=>e.type==='singularityReady').length,2);enemy(r,0,6);assert.equal(s.ready,true);open(r);assert.equal(s.active,true);assert.equal(s.targets.size,0);assert.equal(s.absorbed,0);assert.equal(s.energy,0);assert.equal(s.remaining,40);
});
test('obstacles, meteors and rift damage are not protected; no speed, turbo, heat or ordinary shot damage bonus',()=>{
 for(const source of ['obstacle','meteor','meteor_trail','rift','unknown']){const r=prepared(),speed=r.speed;enemy(r);open(r);assert.equal(r.combat.heat,0);assert.equal(r.speed,speed);assert.equal(r.boost,0);r.damage(source);assert.equal(r.health,2,source);}const r=prepared();enemy(r);open(r);r.firing=true;r.combat.aimWorld=trackPoint(r.z+90,0,5,8);r.combat.update(r,.01);assert.equal(r.combat.bolts.find(b=>b.active&&!b.hostile)?.power,1);
});
test('only the equipped Event Horizon charges; training, flight, failure, portal and shifts cannot open it',()=>{
 for(let tier=0;tier<8;tier++){const r=run(tier);charge(r);assert.equal(r.combat.singularity.energy,tier===7?12:0);}
 for(const mode of ['training','ship','transit','failed','shift'] as const){const r=prepared();enemy(r);if(mode==='training')r.training={step:0,limit:100};if(mode==='ship')r.ship.active=true;if(mode==='failed')r.failed=true;if(mode==='shift')r.shiftLeft=.2;if(mode==='transit')r.riftTransit={rift:{id:1,z:100,kind:'blue',surface:0,lane:0,jump:650,points:400},elapsed:0,jumped:false,mode:'enter'};assert.equal(r.activateSingularity(),false,mode);r.combat.update(r,.01);assert.equal(r.combat.singularity.busy,false,mode);assert.equal(r.combat.singularity.energy,12,mode);}
});
test('flight, portals and surface shifts cancel without refund; lane changes keep the hole attached',()=>{
 for(const mode of ['ship','portal','shift'] as const){const r=prepared();enemy(r);open(r);if(mode==='ship')r.ship.active=true;if(mode==='shift')r.shiftLeft=.2;if(mode==='portal')r.combat.clearTransit();r.combat.update(r,.01);assert.equal(r.combat.singularity.active,false,mode);assert.equal(r.combat.singularity.energy,0);assert.equal(r.combat.singularity.remaining,40);}
 const r=prepared();enemy(r);open(r);const before=r.combat.singularity.center.clone();assert.equal(r.changeLane(1),true);r.step(.1);assert.equal(r.combat.singularity.active,true);assert.ok(r.combat.singularity.center.distanceTo(before)>0);
});
test('failed race freezes active duration and cooldown; revive cancels without refund and fresh run resets',()=>{
 const r=prepared();enemy(r);open(r);r.step(.2);const s=r.combat.singularity,snapshot=[s.elapsed,s.remaining,s.energy];r.health=0;r.failed=true;r.step(2);assert.deepEqual([s.elapsed,s.remaining,s.energy],snapshot);assert.equal(r.revive(),true);assert.equal(s.active,false);assert.equal(s.remaining,snapshot[1]);assert.equal(s.energy,0);const fresh=run().combat.singularity;assert.equal(fresh.energy,0);assert.equal(fresh.remaining,40);
});
test('unlock in a run takes effect next run only',()=>{
 const r=run(6),p=cleanBikeProgress({version:1,legacyXp:10000,best:26000,unlocked:6,selected:6}),tracker=new BikeProgressTracker();tracker.start(r);r.z=50000;assert.equal(tracker.record(p,r).unlocked,true);assert.equal(p.selected,7);charge(r);assert.equal(r.combat.singularity.energy,0);const next=run(p.selected);charge(next);assert.equal(next.combat.singularity.energy,12);
});
test('six locale live/locked Garage and HUD expose mechanics, bounded seven mesh model resets visibility',()=>{
 const r=run(),p=cleanBikeProgress({version:1,best:50000,unlocked:7,selected:7});for(const locale of ['en','tr','de','es','fr','pt-BR']){setLocale(locale);const html=garageMarkup(p,7);assert.match(html,/singularity-ability/);assert.ok(html.includes(t('ability.singularity.short')));assert.doesNotMatch(t('ability.singularity.limits',{radius:55,seconds:2}),/\{/);assert.ok(t('ability.description7').includes('40'));}setLocale('en');assert.equal(singularityStatus(r),'Singularity · 0/12 · 40s');assert.match(singularityHud(r),/singularity-status/);assert.equal(singularityHud(run(6)),'');const ready=prepared();assert.equal(singularityStatus(ready),'Singularity · READY');enemy(ready);open(ready);ready.combat.update(ready,.05);ready.combat.update(ready,.05);const view=new SingularityView(),origin={x:1,y:2,z:-3};view.render(ready,origin);assert.equal(view.root.visible,true);assert.equal(view.root.children.length,7);assert.ok(view.root.position.distanceTo(ready.combat.singularity.center.clone().sub(new THREE.Vector3(1,2,-3)))<1e-7);assert.ok(view.root.scale.x>0);ready.ship.active=true;view.render(ready,origin);assert.equal(view.root.visible,false);const locked=garageMarkup(cleanBikeProgress({version:1,unlocked:6,selected:6}),7);assert.match(locked,/Singularity/);assert.match(locked,/data-action="garageEquip" data-tier="7" disabled/);
});
test('original ready/open/absorb cues are finite, fade cleanly and ship in both native audio banks',()=>{
 for(const kind of ['singularityReady','singularityOpen','singularityAbsorb'] as const){const samples=synthEffect(kind,44100);assert.ok(samples.every(Number.isFinite));assert.ok(samples.some(x=>Math.abs(x)>.05));assert.ok(Math.abs(samples.at(-1)!)<1e-5);for(const mode of ['game-effects','music-mode']){const wav=readFileSync(new URL(`../public/audio/${mode}/${kind}.wav`,import.meta.url));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.length-44,wav.readUInt32LE(40));assert.ok(wav.length>10000);}}
});
