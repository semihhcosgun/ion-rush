import test from 'node:test';
import assert from 'node:assert/strict';
import {CombatView} from '../src/combat-view';
import {Race} from '../src/game';
import {ENEMY_TYPES,type EnemyKind} from '../src/config';
import {enemyPoint} from '../src/combat-space';
import {pathAt} from '../src/path';

test('render caches refresh on movement, death and reuse of enemy slots',()=>{
 const v=new CombatView(),r=new Race(),e=r.combat.enemies[0],kinds=Object.keys(ENEMY_TYPES) as EnemyKind[];
 v.render(r,false);const version=v.bolts.instanceMatrix.version;v.render(r,false);assert.equal(v.bolts.instanceMatrix.version,version);
 for(let i=0;i<kinds.length*3;i++){
  r.z=i*310;r.time=i/60;
  Object.assign(e,{active:i%3!==0,hp:i%5===0?0:3,kind:kinds[i%kinds.length],id:i,z:r.z+40,age:5,pursuing:true,visualSurface:(i%4)*.7,flight:'level',lane:0});
  v.render(r,false);
  assert.equal(v.ships[0].visible,e.active);
  v.models[0].forEach((m,j)=>assert.equal(m.visible,e.active&&e.hp>0&&j===i%kinds.length));
  if(e.active){const expected=enemyPoint(e),origin=pathAt(r.z);expected.x-=origin.x;expected.y-=origin.y;expected.z+=r.z;assert.ok(v.ships[0].position.distanceTo(expected)<1e-10);}
 }
});
