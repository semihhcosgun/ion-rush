import {enemyPoint} from '../src/combat-space';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Race,wrap,isDangerous} from '../src/game';
import {COMBAT} from '../src/config';
function drone(r:Race){Object.assign(r.combat.enemies[0],{active:true,id:100,gateId:-1,z:110,surface:0,lane:1,hp:2,maxHp:2,age:2,fired:true,dead:0});}
test('edge shots hit every alien type while clearly wide shots still miss',()=>{
 for(const kind of ['drone','saucer','manta','wraith','sentinel'] as const)for(const offset of [3.4,-3.4,4.8,-4.8]){const r=new Race();r.gates=[];drone(r);const e=r.combat.enemies[0];e.kind=kind;const point=enemyPoint(e),b=r.combat.bolts[0];Object.assign(b,{active:true,hostile:false,wx:point.x+offset,wy:point.y,wz:point.z+1,vx:0,vy:0,vz:-120,z:e.z-1,life:1});r.combat.update(r,1/60);assert.equal(e.hp,Math.abs(offset)<4?1:2,`${kind} offset ${offset}`);assert.equal(r.combat.hits,Math.abs(offset)<4?1:0);}
});
test('firing hits the selected face, kills once and awards bounded points',()=>{const r=new Race();drone(r);r.firing=true;for(let i=0;i<180;i++){r.combat.aimWorld=enemyPoint(r.combat.enemies[0]);r.step(1/120);}assert.equal(r.combat.kills,1);assert.equal(r.score,COMBAT.killPoints);assert.ok(r.combat.hits>=2);assert.equal(r.failed,false);});
test('shots cannot hit drones on the opposite face',()=>{const r=new Race();drone(r);r.combat.enemies[0].surface=2;r.firing=true;for(let i=0;i<240;i++)r.step(1/120);assert.equal(r.combat.kills,0);});
test('scarce battery permits sixteen opening shots, then requires a real recharge',()=>{const r=new Race();r.gates=[];r.stream.nextZ=100000;r.firing=true;let firstLock=0;for(let i=1;i<600;i++){r.step(1/120);r.events=[];if(r.combat.locked){firstLock=i/120;break;}}assert.equal(r.combat.shots,16);assert.ok(firstLock>=2.5&&firstLock<=2.7);const stopped=r.combat.shots;r.firing=false;let cooling=0;while(r.combat.locked&&cooling<6){r.step(1/120);cooling+=1/120;}assert.ok(cooling>=5.19&&cooling<=5.22);assert.equal(r.combat.shots,stopped);r.firing=true;for(let i=0;i<60;i++)r.step(1/120);assert.ok(r.combat.shots>stopped);assert.equal(r.combat.bolts.length,COMBAT.bolts);});

test('incoming bolt can be dodged by changing lane, shield absorbs one hit',()=>{for(const mode of ['hit','dodge','shield']){const r=new Race();Object.assign(r.combat.bolts[0],{active:true,hostile:true,z:30,surface:0,lane:0,startLane:0,targetLane:0,startZ:30,targetZ:0,life:3});if(mode==='dodge')r.changeLane(1);if(mode==='shield')r.shield=1;for(let i=0;i<70;i++)r.step(1/120);assert.equal(r.failed,false);assert.equal(r.health,mode==='hit'?2:3);assert.equal(r.shield,0);}});
test('new hazards preserve safe route and center lane through mine clusters',()=>{const g={id:0,z:100,safe:1,blocked:[0,2,3],kind:'mines' as const,phase:0,cluster:0,checkpoint:false};assert.equal(isDangerous(g,0,0,0),false);assert.equal(isDangerous(g,0,0,1),true);assert.equal(isDangerous(g,1,0,-1),false);const shutter={...g,kind:'shutter' as const};assert.equal(new Set(Array.from({length:100},(_,i)=>isDangerous(shutter,0,i*.1))).size,2);});


test('each archetype completes entry and a full warning before its distinct volley',()=>{
 for(const kind of ['drone','saucer','manta','wraith','sentinel'] as const){
  const r=new Race();r.gates=[{id:0,z:70,safe:1,blocked:[0],kind:'barrier',phase:0,cluster:0,checkpoint:false}];
  const e=r.combat.enemies[0];Object.assign(e,{active:true,kind,gateId:0,z:40,surface:0,lane:0,hp:4,maxHp:4,age:0});
  let firstShot=0,warning=0;const shots=new Set<object>();const lanes=new Set<number>();
  for(let tick=1;tick<=540;tick++){r.combat.update(r,1/120);if(e.charge>0&&!warning)warning=tick/120;for(const b of r.combat.bolts)if(b.active&&b.hostile){if(!firstShot)firstShot=tick/120;shots.add(b);lanes.add(b.targetLane);assert.equal(b.surface,0);}}
  assert.ok(warning>=2.19);assert.ok(firstShot-warning>=COMBAT.telegraph-1/60);assert.equal(shots.size,kind==='drone'?1:kind==='wraith'||kind==='sentinel'?3:2);assert.deepEqual([...lanes].sort(),kind==='sentinel'?[-1,0,1]:kind==='manta'?[-1,1]:[0]);
 }
});
test('all enemy types are killable and grant their reward once',()=>{
 for(const [kind,hp,points] of [['drone',2,180],['saucer',3,240],['manta',4,320],['wraith',5,440],['sentinel',7,650]] as const){const r=new Race();r.gates=[];r.stream.nextZ=100000;Object.assign(r.combat.enemies[0],{active:true,kind,gateId:-1,z:90,surface:0,lane:0,hp,maxHp:hp,age:3,fired:true});r.firing=true;for(let i=0;i<240;i++){r.combat.aimWorld=enemyPoint(r.combat.enemies[0]);r.step(1/120);}assert.equal(r.combat.kills,1);assert.equal(r.score,points);assert.equal(r.combat.hits,hp);}
});
test('destroying a charging alien cancels its hostile volley',()=>{const r=new Race();r.gates=[{id:0,z:70,safe:1,blocked:[0],kind:'barrier',phase:0,cluster:0,checkpoint:false}];Object.assign(r.combat.enemies[0],{active:true,kind:'manta',gateId:0,z:40,surface:0,lane:0,hp:0,maxHp:4,age:3,charge:.99,volley:2});for(let i=0;i<120;i++)r.combat.update(r,1/120);assert.equal(r.combat.bolts.some(b=>b.active&&b.hostile),false);});

test('manual aim hits elevated and diagonal enemies while an off-axis shot misses',()=>{for(const flight of ['high','upperLeft','upperRight'] as const){for(const aimed of [false,true]){const r=new Race();r.gates=[];r.stream.nextZ=100000;Object.assign(r.combat.enemies[0],{active:true,flight,gateId:-1,z:110,surface:0,lane:0,hp:2,maxHp:2,age:3,fired:true});r.firing=true;for(let i=0;i<240;i++){if(aimed)r.combat.aimWorld=enemyPoint(r.combat.enemies[0]);r.step(1/120);}assert.equal(r.combat.kills,aimed?1:0,flight+' aimed '+aimed);}}});
test('a projectile keeps its chosen direction after the aim changes',()=>{const r=new Race();r.gates=[];r.stream.nextZ=100000;r.firing=true;r.step(1/120);const b=r.combat.bolts.find(b=>b.active)!;const v=[b.vx,b.vy,b.vz];r.firing=false;r.combat.aimWorld=enemyPoint({...r.combat.enemies[0],flight:'upperRight',z:100,age:3});r.step(.1);assert.deepEqual([b.vx,b.vy,b.vz],v);});

test('pursuers survive passing their original gate and launch repeated attacks within a fixed population',()=>{const r=new Race(7);r.damage=()=>{};let tracked=-1,originalZ=0,shots=0;const positions=new Set<number>();while(r.z<2300&&!r.failed){const g=r.gates.find(g=>g.z+4>=r.z);if(g&&g.z-r.z<95&&r.surface!==g.safe&&!r.shiftLeft)r.shift(wrap(g.safe-r.surface)===1?1:-1);r.step(1/120);const e=r.combat.enemies.find(e=>e.active&&e.hp>0);if(tracked<0&&e){tracked=e.id;originalZ=r.gates.find(g=>g.id===e.gateId)!.z;}const same=r.combat.enemies.find(e=>e.id===tracked&&e.active);if(same&&r.z>originalZ+400){assert.ok(same.z>r.z+25);positions.add(Math.round(same.z-r.z));}shots+=r.events.filter(e=>e.type==='enemyShot').length;r.events=[];assert.ok(r.combat.enemies.filter(e=>e.active&&e.hp>0).length<=6);}assert.equal(r.failed,false);assert.ok(positions.size>8);assert.ok(shots>=6);assert.ok(r.combat.enemies.some(e=>e.id===tracked&&e.active&&e.hp>0));});
