import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {Race} from '../src/game';import {ENEMY_TYPES,TUNE} from '../src/config';import {enemyPose,ENEMY_HULL_RADIUS} from '../src/combat-space';import {updateFlight} from '../src/enemy-flight';import {CombatView} from '../src/combat-view';
test('whole enemy hull stays outside every track corner during independent maneuvers',()=>{
 for(const kind of Object.keys(ENEMY_TYPES) as (keyof typeof ENEMY_TYPES)[])for(let seed=0;seed<12;seed++){
  const r=new Race(seed),e=r.combat.enemies[0];Object.assign(e,{id:seed,kind,active:true,pursuing:true,surface:0,visualSurface:0,flight:seed%2?'level':'upperLeft',z:60,hp:3,age:0});
  for(let tick=0;tick<1200;tick++){r.surface=Math.floor(tick/60)%4;e.age+=1/60;updateFlight(e,r,1/60);const p=enemyPose(e),a=-e.visualSurface*Math.PI/2,x=p.lane*TUNE.laneSpacing*Math.cos(a)-p.height*Math.sin(a),y=p.lane*TUNE.laneSpacing*Math.sin(a)+p.height*Math.cos(a);const clearance=Math.hypot(Math.max(Math.abs(x)-4.1,0),Math.max(Math.abs(y)-4.1,0));assert.ok(clearance>=ENEMY_HULL_RADIUS+1.49);}
 }
 const view=new CombatView();for(const model of view.models[0])model.traverse(o=>{if(o instanceof THREE.Mesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(Math.hypot(p.getX(i),p.getY(i),p.getZ(i))*1.644<=ENEMY_HULL_RADIUS,'clearance encloses every rendered hull vertex, including hit flash scale');}});
});
test('warp sound fires once for an encounter and does not repeat on following frames',()=>{const r=new Race(4);r.z=1600;r.gates=[{id:90,z:1770,safe:1,blocked:[0,2,3],kind:'barrier',phase:0,cluster:0,wave:true,checkpoint:false}];r.combat.update(r,1/120);assert.equal(r.events.filter(e=>e.type==='warp').length,1);r.events=[];for(let i=0;i<60;i++)r.combat.update(r,1/120);assert.equal(r.events.filter(e=>e.type==='warp').length,0);});

test('warp arrivals vary in depth, lateral position and elevation while remaining outside the track',()=>{
 const depths=new Set<number>(),sides=new Set<number>(),heights=new Set<number>();
 for(let seed=0;seed<200;seed++){const r=new Race(seed);r.z=1600;r.gates=[{id:90,z:1770,safe:1,blocked:[0,2,3],kind:'barrier',phase:0,cluster:0,wave:true,checkpoint:false}];r.combat.update(r,1/120);for(const e of r.combat.enemies.filter(e=>e.active)){const p=enemyPose(e);depths.add(Math.floor((e.z-r.z)/30));sides.add(Math.sign(e.warpLane??0));heights.add(Math.floor((e.warpHeight??0)/5));assert.ok(e.z-r.z>40&&e.z-r.z<152);assert.ok(Math.hypot(p.lane*TUNE.laneSpacing,p.height)>=Math.SQRT2*4.1+ENEMY_HULL_RADIUS+1.49);}}
 assert.ok(depths.size>=4);assert.ok(sides.has(-1)&&sides.has(1));assert.ok(heights.size>=4);
});
