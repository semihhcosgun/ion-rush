import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Race,CourseStream,type Gate} from '../src/game';
import {ENEMY_TYPES,COMBAT,TUNE} from '../src/config';
import {enemyChoices,chooseEnemy,minimumEnemyRank} from '../src/enemy-progression';
import {weaponBatteryProfile} from '../src/weapon-battery';
import {updateFlight} from '../src/enemy-flight';
import {defenseProfile} from '../src/enemy-defense';
import {MeteorField} from '../src/meteors';
import {trackPoint} from '../src/combat-space';

test('old alien ranks retire progressively as stronger archetypes unlock',()=>{
 for(const z of [2400,4400,6800,9200,14800,20800,30000,33000,44000,56000,100000]){
  assert.ok(enemyChoices(z,[]).length>0);
  for(let i=0;i<1000;i++){const k=chooseEnemy(z,[],i/1000);assert.ok(k);assert.ok(ENEMY_TYPES[k!].rank>=minimumEnemyRank(z));}
 }
 assert.ok(enemyChoices(30000,[]).every(c=>ENEMY_TYPES[c.kind].rank>=7));
 assert.ok(!enemyChoices(2400,[]).some(c=>c.kind==='drone'));
 assert.ok(!enemyChoices(4400,[]).some(c=>c.kind==='saucer'));
 assert.ok(!enemyChoices(9200,[]).some(c=>c.kind==='manta'));
 assert.ok(!enemyChoices(30000,[]).some(c=>c.kind==='drone'||c.kind==='saucer'||c.kind==='manta'));
});

test('battery scales with unlocked enemy toughness while full refill stays eight seconds',()=>{
 let previous=0;
 for(const z of [0,450,900,2400,12000,24000,30000,44000,56000,100000]){
  const p=weaponBatteryProfile(z);assert.ok(p.shots>=previous);previous=p.shots;
  assert.equal(100/p.cooling,8);assert.equal(p.activeCooling,0);
  const r=new Race();r.z=z;r.gates=[];r.stream.nextZ=Infinity;r.rifts=[];r.riftStream.nextZ=Infinity;r.ship.nextZ=Infinity;r.meteors.nextZ=Infinity;r.firing=true;
  for(let i=0;i<1000&&!r.combat.locked;i++)r.combat.update(r,1/120);
  assert.equal(r.combat.shots,p.shots);assert.equal(r.combat.heat,100);
  r.firing=false;for(let i=0;i<961;i++)r.combat.update(r,1/120);
  assert.equal(r.combat.heat,0);assert.equal(r.combat.locked,false);
 }
 assert.equal(weaponBatteryProfile(0).shots,16);assert.equal(weaponBatteryProfile(30000).shots,22);
});

test('consecutive hits cannot reset a dodge or pin an alien motion in place',()=>{
 const r=new Race(12);r.z=30000;const e=r.combat.enemies[0];Object.assign(e,{kind:'oracle',id:12,active:true,pursuing:true,hp:1000,maxHp:1000,age:3,z:r.z+60,flight:'upperRight'});
 updateFlight(e,r,1/120);const before={...e.motion!};r.combat.damageEnemy(r,e,1);
 assert.ok(e.defense!.remaining>0);const count=e.defense!.count;
 for(let i=0;i<120;i++){if(i%10===0)r.combat.damageEnemy(r,e,1);e.age+=1/120;updateFlight(e,r,1/120);}
 assert.equal(e.defense!.count,count);assert.ok(e.defense!.remaining===0);
 assert.ok(Math.abs(e.motion!.lane-before.lane)>.5);assert.ok(e.hp>0);
});

test('veterans react faster to actual threats and to observed steering',()=>{
 assert.ok(defenseProfile(8,30000).reaction<defenseProfile(1,450).reaction);
 const delays:number[]=[];for(const kind of ['drone','oracle'] as const){const r=new Race(5);r.z=30000;const e=r.combat.enemies[0];Object.assign(e,{kind,id:3,active:true,pursuing:true,hp:8,age:3,z:r.z+60});updateFlight(e,r,1/120);delays.push(e.motion!.nextDecision-e.age);}
 assert.ok(delays[1]<delays[0]);
});

test('a meteor warning and hot trail preserve the obstacle and its health collectible',()=>{
 const r=new Race(22);r.z=6000;r.stream.nextZ=Infinity;r.rifts=[];r.riftStream.nextZ=Infinity;r.ship.nextZ=Infinity;r.combat.update=()=>{};r.meteors=new MeteorField(22);r.meteors.nextZ=Infinity;r.meteors.spawn(r);
 const m=r.meteors.items[0];const lane=m.lane===1?-1:1;r.lane=r.laneX=lane;r.surface=m.surface;r.health=1;
 const gate:Gate={id:91,z:m.z,safe:m.surface,blocked:[0,1,2,3].filter(s=>s!==m.surface),kind:'barrier',phase:0,cluster:0,checkpoint:false,pickup:{kind:'health',lane}};r.gates=[gate];
 for(let i=0;i<1200&&r.z<gate.z+37;i++)r.step(1/120);
 assert.ok(r.gates.includes(gate));assert.equal(r.health,2);assert.ok(r.pickupTaken.has(gate.id));
});

test('late black-hole lane entries synchronize approach at 30/60/120 FPS and pay once',()=>{
 for(const fps of [30,60,120])for(const boost of [0,3])for(const distance of [3,8,12]){
  const r=new Race(9);r.z=44000-distance;r.boost=boost;r.health=3;r.combat.update=()=>{};r.gates=[];r.stream.nextZ=Infinity;r.riftStream.nextZ=Infinity;r.ship.nextZ=Infinity;r.meteors.nextZ=Infinity;
  const portal={id:19,z:44000,kind:'black' as const,surface:0,lane:0,jump:2000,points:2000};r.rifts=[portal];r.lane=r.laneX=1;r.changeLane(-1);
  for(let i=0;i<120&&!r.riftTransit&&!r.riftChallenge;i++)r.step(1/fps);
  assert.ok(r.riftTransit);assert.equal(r.riftTransit.portalZ,portal.z);assert.ok(r.riftTransit.elapsed>0);
  for(let i=0;i<300&&r.riftTransit;i++)r.step(1/fps);
  assert.equal(r.failed,false);assert.equal(r.events.filter(e=>e.type==='riftComplete').length,1);assert.equal(r.events.filter(e=>e.type==='riftJump').length,1);
 }
});

test('finishing training restores the opening weapon battery',()=>{const r=new Race();r.training={step:2,limit:200};r.combat.heat=75;r.combat.locked=true;r.combat.cooldown=.15;r.endTraining();assert.equal(r.combat.heat,0);assert.equal(r.combat.locked,false);assert.equal(r.combat.cooldown,0);});
