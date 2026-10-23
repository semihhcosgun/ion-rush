import {ascentAt,ASCENT_START,ASCENT_END,ORBIT_HEIGHT} from '../src/departure-profile';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {departureAt} from '../src/san-francisco';
import {pathAt,tangentAt} from '../src/path';
import {headlandHeight} from '../src/sf-bay';

test('ascent is in the road itself, rises monotonically and eases into level orbit',()=>{
 assert.equal(ascentAt(ASCENT_START).height,18);assert.equal(ascentAt(ASCENT_END).height,ORBIT_HEIGHT);
 assert.equal(tangentAt(ASCENT_START).y,0);assert.equal(tangentAt(ASCENT_END).y,0);
 for(let z=ASCENT_START;z<ASCENT_END;z+=2){assert.ok(pathAt(z+2).y>=pathAt(z).y);assert.ok(tangentAt(z).y>=0&&tangentAt(z).y<.65);}
 assert.ok(pathAt(1650).y-pathAt(1600).y>20,'the road ahead visibly climbs rather than staying flat');
 assert.ok(departureAt(1850).orbit>0&&departureAt(1850).orbit<1,'planets emerge during the climb');
});

test('the bridge remains at water-level until its northern anchorage and terrain clears the road',()=>{
 for(let z=240;z<=1070;z+=10){assert.equal(departureAt(z).altitude,0);assert.equal(departureAt(z).city,1);}
 for(let z=1020;z<=1350;z+=5)for(const dx of [-35,0,35])assert.ok(headlandHeight(pathAt(z).x+dx,-z)<=-15);
 const heights=[];for(let x=-2200;x<1500;x+=100)for(let z=-4000;z<-1100;z+=100)heights.push(headlandHeight(x,z));assert.ok(Math.max(...heights)>80);assert.ok(Math.min(...heights)<-72);
});

test('the cropped terrain ends below the sea rather than exposing a vertical wall',()=>{
 for(let x=-2900;x<=2900;x+=25){assert.ok(headlandHeight(x,-740)<-72);assert.ok(headlandHeight(x,-4540)<-72);}
 for(let z=-4540;z<=-740;z+=25){assert.ok(headlandHeight(-2900,z)<-72);assert.ok(headlandHeight(2900,z)<-72);}
});

test('city departure climbs continuously and restores the orbital scene at the orbital handoff',()=>{
 let previous=departureAt(0);
 for(let z=1;z<=3400;z++){
  const p=departureAt(z);assert.ok(p.altitude>=previous.altitude);assert.ok(p.altitude-previous.altitude<7);
  for(const value of [p.air,p.city,p.cloud,p.orbit])assert.ok(value>=0&&value<=1);
  assert.ok(p.air<=previous.air&&p.city<=previous.city&&p.orbit>=previous.orbit);previous=p;
 }
 assert.equal(departureAt(0).air,1);assert.equal(departureAt(0).orbit,0);
 assert.equal(departureAt(ASCENT_END).city,0);assert.equal(departureAt(ASCENT_END).air,0);assert.equal(departureAt(ASCENT_END).cloud,0);assert.equal(departureAt(ASCENT_END).orbit,1);
 assert.ok(departureAt(1900).cloud>.8);
});

test('straight bridge approach joins the original ribbon with matching tangents',()=>{
 for(const z of [0,100,365,400,750,800])assert.ok(pathAt(z).x===0&&pathAt(z).y===18);
 for(let z=0;z<=3400;z+=5){
  const a=pathAt(z-.001),b=pathAt(z+.001),t=tangentAt(z);
  assert.ok(Math.abs((b.x-a.x)/.002-t.x)<1e-5);assert.ok(Math.abs((b.y-a.y)/.002-t.y)<1e-5);
 }
 for(const z of [3200,42000,50000]){const p=pathAt(z);assert.equal(p.x,34*Math.sin(z/230)+12*Math.sin(z/87));assert.equal(p.y,ORBIT_HEIGHT+12*Math.sin(z/195)+3*Math.sin(z/71));}
});






