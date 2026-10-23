import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Race,type Gate} from '../src/game';
import {gateIntersectsRider,obstacleContact} from '../src/obstacle-collision';
import {OBSTACLE,RIDER,shutterPosition} from '../src/obstacle-shapes';

const shutter=(phase=-Math.PI/2,z=60):Gate=>({id:0,z,safe:1,blocked:[0],kind:'shutter',phase,cluster:0,checkpoint:false});

test('fully raised shutter clears the visible helmet with room to spare',()=>{
 const bottom=shutterPosition(0,-Math.PI/2)-OBSTACLE.shutter.height/2;
 const helmetTop=RIDER.surfaceRadius+(1.705+.345)*RIDER.scale;
 assert.ok(bottom-helmetTop>=1,`clearance ${bottom-helmetTop}`);
 // The guide posts reach the top of the raised panel.
 assert.ok(4+OBSTACLE.shutter.postHeight>=shutterPosition(0,-Math.PI/2)+OBSTACLE.shutter.height/2-.1);
});

test('each cycle provides at least 1.7 seconds of usable head clearance',()=>{
 const g=shutter(),period=2*Math.PI/OBSTACLE.shutter.rate,dt=1/120;
 let safeSeconds=0;
 for(let time=0;time<period;time+=dt)if(!gateIntersectsRider(g,g.z,0,0,time))safeSeconds+=dt;
 assert.ok(safeSeconds>=1.7,`only ${safeSeconds.toFixed(3)}s available`);
 assert.ok(safeSeconds<period*.7,'the shutter must still have a closed phase');
});

test('open shutter permits the complete bike to cross at cruise and turbo speed on every lane and face',()=>{
 for(const z of [60,1000,3000,12000])for(const speed of [24,48,54])for(let face=0;face<4;face++)for(const laneX of [-1,0,1])for(const offset of [-.6,0,.6]){
  const crossingTime=1+offset,angle=face*Math.PI/2;
  const g={...shutter(-Math.PI/2-OBSTACLE.shutter.rate,z),blocked:[face]};
  const from={z:z-6,angle,laneX,time:crossingTime-6/speed};
  const to={z:z+6,angle,laneX,time:crossingTime+6/speed};
  assert.equal(obstacleContact(g,from,to),false,`z=${z} speed=${speed} face=${face} lane=${laneX} offset=${offset}`);
 }
});

test('a fully closed shutter remains solid for every lane and face',()=>{
 for(let face=0;face<4;face++)for(const laneX of [-1,0,1]){
  const g={...shutter(Math.PI/2),blocked:[face]};
  assert.equal(gateIntersectsRider(g,g.z,face*Math.PI/2,laneX,0),true);
 }
});

test('normal gameplay awards an open-shutter pass, but a closed crossing loses health once',()=>{
 for(const open of [true,false]){
  const r=new Race(123);r.gates=[];r.stream.nextZ=100000;r.combat.update=()=>{};r.meteors.nextZ=Infinity;
  // Find the actual arrival time with normal acceleration before choosing phase.
  while(r.z<60)r.step(1/120);
  const phase=(open?-Math.PI/2:Math.PI/2)-OBSTACLE.shutter.rate*r.time;
  const run=new Race(123);run.gates=[shutter(phase)];run.stream.nextZ=100000;run.combat.update=()=>{};run.meteors.nextZ=Infinity;
  while(run.z<70&&!run.failed)run.step(1/120);
  assert.equal(run.health,open?3:2);assert.equal(run.hits,open?0:1);assert.equal(run.cleared,open?1:0);
 }
});
