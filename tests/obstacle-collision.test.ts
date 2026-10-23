import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Race,type Gate} from '../src/game';
import {gateIntersectsRider,obstacleContact,type RiderPose} from '../src/obstacle-collision';

const gate=(kind:Gate['kind']='barrier',phase=0,z=10):Gate=>({id:0,z,safe:1,blocked:[0],kind,phase,cluster:0,checkpoint:false});
const pose=(z:number,angle=0,laneX=0,time=0):RiderPose=>({z,angle,laneX,time});
function roadRace(g:Gate,z=0){const r=new Race(123);r.gates=[g];r.z=z;r.stream.nextZ=100000;r.combat.update=()=>{};r.meteors.nextZ=Infinity;return r;}

test('moving block hits its occupied lane and leaves distant lanes clear',()=>{
 for(const z of [10,1000,3000,12000])for(let face=0;face<4;face++){
  const g={...gate('block',0,z),blocked:[face]},a=face*Math.PI/2;
  assert.equal(gateIntersectsRider(g,z,a,-1,0),false);
  assert.equal(gateIntersectsRider(g,z,a,0,0),true);
  assert.equal(gateIntersectsRider(g,z,a,1,0),false);
  g.phase=Math.PI/2;
  assert.equal(gateIntersectsRider(g,z,a,0,0),false);
  assert.equal(gateIntersectsRider(g,z,a,1,0),true);
  g.phase=-Math.PI/2;
  assert.equal(gateIntersectsRider(g,z,a,-1,0),true);
  assert.equal(gateIntersectsRider(g,z,a,1,0),false);
 }
});

test('raised arm still blocks its low left end, while centre and right can pass',()=>{
 const g=gate('arm',1);
 assert.equal(gateIntersectsRider(g,10,0,-1,0),true);
 assert.equal(gateIntersectsRider(g,10,0,0,0),false);
 assert.equal(gateIntersectsRider(g,10,0,1,0),false);
 assert.equal(gateIntersectsRider({...g,phase:0},10,0,1,0),true);
});

test('narrow barriers use their rendered width, including during a lane change',()=>{
 const g={...gate(),lane:0};
 assert.equal(gateIntersectsRider(g,10,0,.8,0),false);
 assert.equal(gateIntersectsRider(g,10,0,.6,0),true);
 assert.equal(gateIntersectsRider({...g,lane:1},10,0,0,0),false);
 assert.equal(gateIntersectsRider({...g,lane:1},10,0,1,0),true);
});

test('a visible longitudinal gap before or after a barrier does not cause damage',()=>{
 const g=gate();
 for(const z of [6,7,13,14])assert.equal(gateIntersectsRider(g,z,0,0,0),false,`z=${z}`);
 for(const z of [7.5,10,12])assert.equal(gateIntersectsRider(g,z,0,0,0),true,`z=${z}`);
 const r=roadRace(g,6);r.step(1/120);assert.equal(r.health,3);assert.equal(r.hits,0);
 while(r.z<8)r.step(1/120);assert.equal(r.health,2);assert.equal(r.hits,1);
 while(r.z<15)r.step(1/120);assert.equal(r.hits,1);
});

test('surface transition uses the drawn angle rather than both complete faces',()=>{
 const g=gate();
 assert.equal(gateIntersectsRider(g,10,Math.PI/8,0,0),true);
 assert.equal(gateIntersectsRider(g,10,Math.PI/4,0,0),false);
 assert.equal(gateIntersectsRider(g,10,Math.PI*.45,0,0),false);
 assert.equal(gateIntersectsRider({...g,blocked:[1]},10,Math.PI*.05,0,0),false);
 assert.equal(gateIntersectsRider({...g,blocked:[1]},10,Math.PI/2,0,0),true);
 const r=roadRace(g,5.7);r.shift(1);r.step(.05);assert.equal(r.health,3);
 const late=roadRace(g,7.5);late.shift(1);late.step(.05);assert.equal(late.health,2);
});

test('leaving an old blocked face before reaching it stays clear for the rest of the transition',()=>{
 const r=roadRace(gate(),4);r.shift(1);r.step(.15);
 assert.ok(r.shiftLeft>0);assert.equal(r.health,3);
 r.step(.15);assert.equal(r.health,3);assert.equal(r.hits,0);
});

test('mines leave a physically clear middle corridor and only hit near their bodies',()=>{
 const g=gate('mines');
 assert.equal(gateIntersectsRider(g,10,0,.42,0),false);
 assert.equal(gateIntersectsRider(g,10,0,-.42,0),false);
 assert.equal(gateIntersectsRider(g,10,0,.65,0),true);
 assert.equal(gateIntersectsRider(g,10,0,-.65,0),true);
});

test('shutter clearance includes the helmet instead of an arbitrary animation phase',()=>{
 assert.equal(gateIntersectsRider(gate('shutter',-Math.PI/2),10,0,0,0),false);
 assert.equal(gateIntersectsRider(gate('shutter',Math.asin(.2)),10,0,0,0),true);
 assert.equal(gateIntersectsRider(gate('shutter',Math.PI/2),10,0,0,0),true);
});

test('inactive lasers are passable, active beams collide, and fast movement cannot skip them',()=>{
 assert.equal(gateIntersectsRider(gate('laser',-Math.PI/2),10,0,0,0),false);
 assert.equal(gateIntersectsRider(gate('laser'),10,0,0,0),true);
 assert.equal(obstacleContact(gate('laser'),pose(4),pose(16,0,0,.1)),true);
 assert.equal(obstacleContact(gate('laser',-Math.PI/2),pose(4),pose(16,0,0,.1)),false);
});

test('sampling checks moving obstacle phase at contact, not only the end of a long step',()=>{
 const g=gate('block',-Math.PI/2);
 // At the end, the block is on the right. Earlier, it crossed the player's centre lane.
 assert.equal(gateIntersectsRider(g,16,0,0,Math.PI/1.4),false);
 assert.equal(obstacleContact(g,pose(4),pose(16,0,0,Math.PI/1.4)),true);
 assert.equal(obstacleContact(gate(),pose(4,0,1),pose(16,0,1,.1)),true);
 assert.equal(obstacleContact({...gate(),lane:0},pose(4,0,1),pose(16,0,1,.1)),false);
});

test('gaps test missing support and do not create a solid wall while rounding a corner',()=>{
 const g=gate('gap',0,16);
 assert.equal(gateIntersectsRider(g,10,0,0,0),false);
 assert.equal(gateIntersectsRider(g,16,0,0,0),true);
 assert.equal(gateIntersectsRider(g,16,Math.PI/4,0,0),false);
 assert.equal(gateIntersectsRider(g,16,Math.PI/2,0,0),false);
});

test('dodging a moving block awards one clean pass without losing health',()=>{
 const r=roadRace(gate('block',-Math.PI/2,60));r.changeLane(-1);
 while(r.z<70&&!r.failed)r.step(1/120);
 assert.equal(r.health,3);assert.equal(r.hits,0);assert.equal(r.cleared,1);
});
