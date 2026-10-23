import {test} from 'node:test';
import assert from 'node:assert/strict';
import {meteorBodyGeometry} from '../src/meteor-body';
import {fractureMeteor,fragmentHeight} from '../src/meteor-fracture';

test('fractured shell preserves every source triangle and has closed inner faces',()=>{
 const body=meteorBodyGeometry(),pieces=fractureMeteor(body);
 assert.equal(pieces.length,12);
 assert.equal(pieces.reduce((n,p)=>n+p.geometry.groups[0].count,0),body.index!.count);
 for(const p of pieces){assert.ok(p.geometry.groups[1].count>0);assert.ok([...p.geometry.attributes.position.array].every(Number.isFinite));assert.ok([...p.geometry.attributes.normal.array].every(Number.isFinite));p.geometry.dispose();}body.dispose();
});
test('debris bounce stays above the surface and settles continuously',()=>{
 for(const start of [.12,.5,1.8])for(const velocity of [1.8,3.5,5]){let prior=start;for(let i=0;i<=5000;i++){const h=fragmentHeight(i/1000,start,velocity);assert.ok(h>=.12);assert.ok(Math.abs(h-prior)<.02);prior=h;}assert.equal(prior,.12);}
});
