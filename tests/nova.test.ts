import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NOVA_REVIVE_COST,canSpendNova} from '../src/nova';
import {Race} from '../src/game';

test('spends a single core for recovery',()=>{
  assert.equal(canSpendNova(1,NOVA_REVIVE_COST),true);
  assert.equal(canSpendNova(0,NOVA_REVIVE_COST),false);
});
test('allows two recoveries, protects each return and ends on the third death',()=>{
  const race=new Race(91);
  race.damage('test','fatal',undefined,3);
  assert.equal(race.failed,true);
  assert.equal(race.revive(),true);
  assert.equal(race.failed,false);
  assert.equal(race.health,2);
  assert.equal(race.shield,2);
  assert.equal(race.invulnerable,3);
  assert.equal(race.gates.every(g=>g.z>race.z+150),true);
  race.invulnerable=0;race.shield=0;race.damage('test','fatal-again',undefined,3);
  assert.equal(race.revive(),true);
  assert.equal(race.revives,2);
  assert.equal(race.health,2);
  assert.equal(race.shield,2);
  assert.equal(race.invulnerable,3);
  race.invulnerable=0;race.shield=0;race.damage('test','third-death',undefined,3);
  assert.equal(race.revive(),false);
  assert.equal(race.failed,true);
});
test('cannot consume recovery before a crash',()=>assert.equal(new Race(7).revive(),false));
