import test from 'node:test';
import assert from 'node:assert/strict';
import {Race} from '../src/game';
import {COMBAT} from '../src/config';
import {IGNITION,IgnitionVent} from '../src/ignition';
import {enemyPoint} from '../src/combat-space';
import {BikeProgressTracker,cleanBikeProgress} from '../src/bike-progress';
import {garageMarkup} from '../src/garage';
import {ignitionStatus} from '../src/ignition-ui';
import {HeatVentFX} from '../src/heat-vent-fx';
import {setLocale} from '../src/i18n';
function run(tier=1){const r=new Race(2249,tier);r.gates=[];r.stream.nextZ=1e6;r.riftStream.nextZ=1e6;return r;}
function tick(r:Race,seconds:number){for(let i=0;i<Math.round(seconds*120);i++)r.combat.update(r,1/120);}
function fire(r:Race){r.firing=true;r.combat.update(r,1/120);r.firing=false;}
function target(r:Race,hp=1){const e=r.combat.enemies[0];Object.assign(e,{active:true,training:false,pursuing:false,id:e.id+1,z:45,surface:0,visualSurface:0,lane:0,hp,maxHp:hp,age:2,fired:true,dead:0});return e;}
function kill(r:Race){const e=target(r);r.combat.damageEnemy(r,e,1);return e;}
function near(a:number,b:number){assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);}
test('all bikes keep ordinary shot damage, heat and projectile count',()=>{
 for(let tier=0;tier<8;tier++){const r=run(tier);fire(r);const bolts=r.combat.bolts.filter(b=>b.active&&!b.hostile);assert.equal(bolts.length,1);assert.equal(bolts[0].power,1);assert.equal(r.combat.heat,COMBAT.shotHeat);assert.equal(r.combat.shots,1);assert.equal(r.combat.ignition.remaining,0);}
});
test('a lethal player projectile vents exactly 20 heat and preserves scoring once',()=>{
 const runs=[run(0),run(1)];
 for(const r of runs){const e=target(r);r.combat.heat=60;r.combat.aimWorld=enemyPoint(e);fire(r);tick(r,.4);assert.equal(e.hp,0);assert.equal(r.combat.kills,1);assert.equal(r.combat.hits,1);const kills=r.events.filter(e=>e.type==='kill');assert.equal(kills.length,1);assert.equal(r.score,kills[0].value);r.combat.damageEnemy(r,e,1);assert.equal(r.combat.kills,1);}
 near(runs[0].combat.heat-runs[1].combat.heat,20+COMBAT.cooling*IGNITION.rechargeBonus*(IGNITION.rechargeDuration-runs[1].combat.ignition.rechargeRemaining));assert.equal(runs[1].events.filter(e=>e.type==='heatVent').length,1);assert.equal(runs[1].events.find(e=>e.type==='heatVent')?.value,20);assert.ok(runs[1].combat.ignition.remaining>5);assert.equal(runs[0].events.some(e=>e.type==='heatVent'),false);
});
test('misses and nonlethal hits never consume the vent cooldown',()=>{
 const r=run();fire(r);tick(r,.4);assert.equal(r.combat.ignition.remaining,0);
 const e=target(r,2);r.combat.aimWorld=enemyPoint(e);fire(r);tick(r,.4);assert.equal(e.hp,1);assert.equal(r.combat.ignition.remaining,0);assert.equal(r.events.some(e=>e.type==='heatVent'),false);
 fire(r);tick(r,.4);assert.equal(e.hp,0);assert.ok(r.combat.ignition.remaining>5);
});
test('vent clamps at zero and does not waste cooldown on an already-cold weapon',()=>{
 const r=run();kill(r);assert.equal(r.combat.heat,0);assert.equal(r.combat.ignition.remaining,0);assert.equal(r.events.some(e=>e.type==='heatVent'),false);
 r.combat.heat=7;kill(r);assert.equal(r.combat.heat,0);assert.equal(r.combat.ignition.remaining,6);assert.equal(r.events.find(e=>e.type==='heatVent')?.value,7);
});
test('six simulation seconds gate the next kill; cooldown kills neither queue nor reset it',()=>{
 const r=run();r.combat.heat=80;kill(r);tick(r,2);r.combat.heat=80;const remaining=r.combat.ignition.remaining;kill(r);assert.equal(r.combat.heat,80);assert.equal(r.combat.ignition.remaining,remaining);
 tick(r,3.9);r.combat.heat=80;kill(r);assert.equal(r.combat.heat,80);tick(r,.1);assert.equal(r.combat.ignition.ready,true);r.combat.heat=80;tick(r,.01);assert.ok(r.combat.heat>79);kill(r);near(r.combat.heat,80-COMBAT.cooling/120-20);assert.equal(r.events.filter(e=>e.type==='heatVent').length,2);
});
test('allied kills, training, other bikes, ship, transit and failed runs cannot trigger Heat Vent',()=>{
 for(const mode of ['support','trainingEnemy','training','ship','transit','failed','rookie','runner'] as const){
  const r=run(mode==='rookie'?0:mode==='runner'?2:1),e=target(r);r.combat.heat=60;
  if(mode==='trainingEnemy')e.training=true;if(mode==='training')r.training={step:0,limit:100};if(mode==='ship')r.ship.active=true;if(mode==='failed')r.failed=true;if(mode==='transit')r.riftTransit={rift:{id:1,z:100,kind:'blue',surface:0,lane:0,jump:650,points:400},elapsed:0,jumped:false,mode:'enter'};
  r.combat.damageEnemy(r,e,1,mode==='support');assert.equal(r.combat.heat,60,mode);assert.equal(r.combat.ignition.remaining,0,mode);assert.equal(r.events.some(e=>e.type==='heatVent'),false,mode);
 }
 const ship=run();ship.ship.active=true;fire(ship);assert.equal(ship.combat.bolts.find(b=>b.active)?.power,2);assert.equal(ship.combat.heat,COMBAT.shotHeat);
});
test('the existing rearm threshold still controls a locked weapon after venting',()=>{
 const r=run();r.combat.heat=100;r.combat.locked=true;kill(r);assert.equal(r.combat.heat,80);assert.equal(r.combat.locked,true);fire(r);assert.equal(r.combat.shots,0);near(r.combat.rearmSeconds(r),2.4-1/120);tick(r,2.3);assert.equal(r.combat.locked,true);tick(r,.1);assert.equal(r.combat.locked,false);
 const low=run();low.combat.heat=50;low.combat.locked=true;kill(low);assert.equal(low.combat.heat,30);assert.equal(low.combat.locked,true);fire(low);assert.equal(low.combat.locked,false);assert.equal(low.combat.shots,1);
});
test('pause freezes the cooldown and effect; revive retains it, a new run starts ready',()=>{
 const r=run();r.combat.heat=60;kill(r);const fx=new HeatVentFX();fx.update(r.combat.ignition.flash);assert.equal(fx.root.visible,true);const status=ignitionStatus(r);assert.equal(status,'Heat Vent · −20 HEAT');assert.equal(r.combat.ignition.remaining,6);
 tick(r,.5);fx.update(r.combat.ignition.flash);assert.equal(fx.root.visible,false);assert.equal(ignitionStatus(r),'+60% RECHARGE · 1.5s');const remaining=r.combat.ignition.remaining;r.failed=true;r.health=0;assert.equal(r.revive(),true);assert.equal(r.combat.ignition.remaining,remaining);assert.equal(run().combat.ignition.ready,true);
});
test('a rank unlock changes the ability only on the next run',()=>{
 const r=run(0),p=cleanBikeProgress({version:1,legacyXp:120,unlocked:0,selected:0,best:0}),tracker=new BikeProgressTracker();tracker.start(r);r.z=500;assert.equal(tracker.record(p,r).unlocked,true);assert.equal(p.selected,1);assert.equal(r.bikeTier,0);r.combat.heat=60;kill(r);assert.equal(r.combat.heat,60);
 const next=run(p.selected);next.combat.heat=60;kill(next);assert.equal(next.combat.heat,40);
});
test('Rookie shows Heat Vent before unlock while locked selection and equip remain disabled',()=>{
 setLocale('en');const p=cleanBikeProgress({version:1,unlocked:0,selected:0});const html=garageMarkup(p,0);assert.match(html,/Unlock with Ignition/);assert.match(html,/Heat Vent/);assert.match(html,/−20 heat/);assert.match(html,/6s cooldown/);assert.match(html,/\+60% recharge · 2s/);assert.doesNotMatch(html,/Charged Shot/);assert.match(html,/data-action="garagePreview" data-tier="1" disabled/);assert.match(html,/data-action="bikeAbilities"/);assert.match(garageMarkup(p,1),/data-action="garageEquip" data-tier="1" disabled/);
});

test('a player kill also accelerates idle recharge for exactly two seconds without stacking',()=>{
 const r=run();r.combat.heat=100;kill(r);assert.equal(r.combat.ignition.rechargeRemaining,2);
 tick(r,1);near(r.combat.heat,60);near(r.combat.ignition.rechargeRemaining,1);
 kill(r);near(r.combat.heat,60);near(r.combat.ignition.rechargeRemaining,1);
 tick(r,1);near(r.combat.heat,40);near(r.combat.ignition.rechargeRemaining,0);
 tick(r,1);near(r.combat.heat,27.5);assert.equal(r.combat.ignition.ready,false);
});
test('recharge burst does not cool during firing and still expires on simulation time',()=>{
 const r=run();r.combat.heat=60;kill(r);r.firing=true;r.combat.cooldown=999;
 tick(r,2);near(r.combat.heat,40);near(r.combat.ignition.rechargeRemaining,0);
 r.firing=false;tick(r,1);near(r.combat.heat,27.5);
});
test('recharge bonus expires accurately inside a long frame and HUD predicts both phases',()=>{
 const vent=new IgnitionVent();vent.trigger(100);
 near(vent.coolingAmount(COMBAT.cooling,3),52.5);near(vent.timeToCool(45,COMBAT.cooling),2.4);
 near(vent.timeToCool(20,COMBAT.cooling),1);near(vent.timeToCool(-5,COMBAT.cooling),0);
 vent.update(3);near(vent.coolingAmount(COMBAT.cooling,1),12.5);near(vent.timeToCool(25,COMBAT.cooling),2);
 const r=run();r.combat.heat=60;r.combat.locked=true;kill(r);near(r.combat.rearmSeconds(r),5/20);
 tick(r,.24);assert.equal(r.combat.locked,true);tick(r,.02);assert.equal(r.combat.locked,false);
});
test('unavailable contexts neither grant nor use the recharge burst',()=>{
 for(const mode of ['support','training','ship','transit','otherBike'] as const){
  const r=run(mode==='otherBike'?0:1);r.combat.heat=60;
  if(mode==='training')r.training={step:0,limit:100};if(mode==='ship')r.ship.active=true;
  if(mode==='transit')r.riftTransit={rift:{id:1,z:100,kind:'blue',surface:0,lane:0,jump:650,points:400},elapsed:0,jumped:false,mode:'enter'};
  r.combat.damageEnemy(r,target(r),1,mode==='support');assert.equal(r.combat.ignition.rechargeRemaining,0);
  if(mode!=='support'){r.combat.ignition.rechargeRemaining=2;near(r.combat.rearmSeconds(r),2);tick(r,.5);near(r.combat.heat,53.75);}
 }
 const cold=run();kill(cold);assert.equal(cold.combat.ignition.rechargeRemaining,0);
});
