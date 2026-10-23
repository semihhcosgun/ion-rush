import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Race,wrap} from '../src/game';
import {enemyPoint} from '../src/combat-space';
import {COMBAT,PURSUIT,ENEMY_TYPES} from '../src/config';
import {pursuitPressure} from '../src/enemy-progression';

function run(seed:number,shoot:boolean,observe=false,limit=8000){
 const r=new Race(seed);if(observe)r.damage=()=>{};
 let peak=0,shots=0,first=-1,retained=false;
 while(r.z<limit&&!r.failed){
  const gate=r.gates.find(g=>g.z+4>=r.z);
  if(gate&&gate.z-r.z<95&&r.surface!==gate.safe&&!r.shiftLeft)r.shift(wrap(gate.safe-r.surface)===1?1:-1);
  const target=r.combat.enemies.find(e=>e.active&&e.hp>0);
  r.firing=shoot&&!!target&&target.age>=2.2&&!(target.defense?.remaining>0);if(shoot&&target)r.combat.aimWorld=enemyPoint(target);
  r.step(1/120);
  const alive=r.combat.enemies.filter(e=>e.active&&e.hp>0);
  if(first<0&&alive.length)first=alive[0].id;
  if(r.z>5000&&alive.some(e=>e.id===first))retained=true;
  peak=Math.max(peak,alive.length);shots+=r.events.filter(e=>e.type==='enemyShot').length;
  assert.ok(alive.length<=PURSUIT.maxEnemies);
  assert.ok(r.combat.spawned.size<10);
  assert.ok(r.combat.bolts.filter(b=>b.active&&b.hostile).length<=COMBAT.bolts-8);
  r.events=[];
 }
 return {r,peak,shots,retained};
}

test('ignoring aliens accumulates reinforcements without recycling living pursuers',()=>{
 for(let seed=0;seed<8;seed++){
  const passive=run(seed,false,true);
  assert.ok(passive.peak>=5,`seed ${seed}: ${passive.peak} enemies`);
  assert.ok(passive.retained);
  assert.equal(passive.r.combat.kills,0);
  assert.ok(passive.shots>50);
 }
});

test('old survivors call backup even when the next encounter has no random wave',()=>{
 const {r,e}=hunter();r.time=50;e.age=90;
 r.gates=[{id:90,z:r.z+170,safe:1,blocked:[0,2,3],kind:'barrier',phase:0,cluster:0,checkpoint:false,wave:false}];
 r.combat.update(r,1/120);
 assert.equal(r.combat.enemies.filter(e=>e.active&&e.hp>0).length,2);
 assert.ok(r.combat.enemies.some(other=>other!==e&&other.active&&!other.hunting&&other.age<.01));
 const newcomer=r.combat.enemies.find(other=>other!==e&&other.active)!;
 assert.equal(newcomer.charge,0);
 // The same gate cannot repeatedly spawn reinforcements.
 for(let i=0;i<120;i++)r.combat.update(r,1/120);
 assert.equal(r.combat.enemies.filter(e=>e.active&&e.hp>0).length,2);
});

test('road-only evasion takes combat damage, while aimed kills relieve the pursuit',()=>{
 let passiveDistance=0,armedDistance=0,passivePeak=0,armedPeak=0;
 for(let seed=0;seed<8;seed++){
  const passive=run(seed,false),armed=run(seed,true);
  assert.ok(passive.r.hits>0,`seed ${seed}: untouched passive run`);
  assert.ok(armed.r.combat.kills>=3);
  passiveDistance+=passive.r.z;armedDistance+=armed.r.z;
  passivePeak+=passive.peak;armedPeak+=run(seed,true,false,passive.r.z).peak;
 }
 assert.ok(armedDistance>passiveDistance*1.5);
 assert.ok(armedPeak<passivePeak);
 console.log('Mean distance, road-only / aimed fire:',Math.round(passiveDistance/8),Math.round(armedDistance/8));
});

function hunter(){
 const r=new Race();r.z=2000;r.gates=[];r.stream.nextZ=100000;
 const e=r.combat.enemies[0];
 Object.assign(e,{active:true,id:17,kind:'drone',pursuing:true,visualSurface:0,surface:0,lane:0,z:2050,age:40,hp:2,maxHp:2,fired:true});
 return {r,e};
}

test('hunters warn for the full duration and lock their lane so a dodge avoids damage',()=>{
 for(const dodge of [false,true]){
  const {r,e}=hunter();r.step(1/120);
  assert.ok(e.hunting);assert.equal(e.surface,0);assert.equal(e.lane,0);
  assert.equal(r.events.filter(e=>e.type==='incoming').length,1);
  if(dodge)r.changeLane(1);
  let firstShot=0;
  for(let tick=1;tick<480;tick++){
   r.events=[];r.step(1/120);
   if(!firstShot&&r.events.some(e=>e.type==='enemyShot'))firstShot=r.time;
   assert.equal(e.surface,0);assert.equal(e.lane,0);
  }
  assert.ok(firstShot>=COMBAT.telegraph-1e-9&&firstShot<COMBAT.telegraph+.02);
  assert.equal(r.hits,dodge?0:1);
 }
});

test('killing a hunter during warning cancels its volley and fresh spawns start without pressure',()=>{
 const {r,e}=hunter();r.step(1/120);e.hp=0;
 for(let i=0;i<480;i++)r.step(1/120);
 assert.equal(r.events.some(e=>e.type==='enemyShot'),false);
 assert.equal(e.active,false);
 const fresh=new Race();assert.equal(pursuitPressure(fresh.z,0),0);
 assert.ok(fresh.combat.enemies.every(e=>!e.hunting&&!e.active));
});

test('six veteran pursuers stagger warnings, reserve player shots and shorten cooldowns',()=>{
 const {r}=hunter();r.damage=()=>{};
 for(let i=0;i<6;i++)Object.assign(r.combat.enemies[i],{active:true,id:i,kind:'sentinel',pursuing:true,visualSurface:0,surface:0,lane:0,z:r.z+50,age:90,hp:7,maxHp:7,fired:true});
 r.firing=true;let warnings=0,hostile=0;
 for(let tick=0;tick<2400;tick++){
  r.step(1/120);
  warnings=Math.max(warnings,r.combat.enemies.filter(e=>e.active&&e.hp>0&&((e.charge>0&&!e.fired)||e.volley>0)).length);
  hostile+=r.events.filter(e=>e.type==='enemyShot').length;r.events=[];
 }
 assert.ok(warnings>0&&warnings<=PURSUIT.maxWarnings);
 assert.ok(hostile>20);assert.ok(r.combat.shots>=20&&r.combat.shots<=60);
 assert.ok(r.combat.enemies.some(e=>e.attackCooldown<ENEMY_TYPES.sentinel.attackCooldown));
});
