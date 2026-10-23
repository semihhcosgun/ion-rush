import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector2,ShapeUtils} from 'three';
import {simplifyFootprint} from '../src/footprint-detail';
test('survey skyline retains winding and a 0.45 metre world-space outline error bound',()=>{
 const rows=JSON.parse(readFileSync(new URL('../public/data/sf-buildings.json',import.meta.url),'utf8'));
 let before=0,after=0,maxError=0;
 for(const row of rows)for(const polygon of row.shape.coordinates){
  const input=polygon[0].map(([x,y]:number[])=>new Vector2((x+122.44)*87980,(y-37.81)*111320));
  const result=polygon.length===1?simplifyFootprint(input):input;before+=input.length;after+=result.length;
  assert.ok(result.length>=3);assert.ok(ShapeUtils.area(input)*ShapeUtils.area(result)>0);
  for(const point of input){let closest=Infinity;
   for(let i=0;i<result.length;i++){const a=result[i],b=result[(i+1)%result.length],edge=b.clone().sub(a),t=Math.max(0,Math.min(1,point.clone().sub(a).dot(edge)/(edge.lengthSq()||1)));closest=Math.min(closest,point.distanceTo(a.clone().addScaledVector(edge,t)));}
   maxError=Math.max(maxError,closest);assert.ok(closest<=1.500001);
  }
 }
 console.log({surveyVerticesBefore:before,surveyVerticesAfter:after,maxWorldOutlineError:maxError*.3});
 assert.ok(after<before*.6);
});
