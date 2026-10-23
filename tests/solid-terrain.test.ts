import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {solidTerrain} from '../src/solid-terrain';

test('uneven coastal terrain has no open edges and all shared edges have opposite winding',()=>{
 const top=new THREE.PlaneGeometry(100,100,4,4);top.rotateX(-Math.PI/2);
 const p=top.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,Math.sin(p.getX(i)*.07)*40);
 const solid=solidTerrain(top),index=solid.getIndex()!,sp=solid.getAttribute('position'),weld=new Map<string,number>();const vertex=(i:number)=>{const key=[sp.getX(i),sp.getY(i),sp.getZ(i)].join(',');if(!weld.has(key))weld.set(key,weld.size);return weld.get(key)!;};const edges=new Map<string,{count:number;direction:number}>();
 for(let i=0;i<index.count;i+=3){const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)];for(let j=0;j<3;j++){const a=vertex(tri[j]),b=vertex(tri[(j+1)%3]),key=`${Math.min(a,b)}:${Math.max(a,b)}`,e=edges.get(key)??{count:0,direction:0};e.count++;e.direction+=a<b?1:-1;edges.set(key,e);}}
 for(const edge of edges.values()){assert.equal(edge.count,2);assert.equal(edge.direction,0);}
 // A camera beneath the top surface must see the near coast, rather than open ocean behind it.
 const mesh=new THREE.Mesh(solid,new THREE.MeshBasicMaterial());mesh.updateMatrixWorld();
 const ray=new THREE.Raycaster(new THREE.Vector3(0,-60,100),new THREE.Vector3(0,0,-1));
 assert.ok(ray.intersectObject(mesh).length>0);
 top.dispose();solid.dispose();
});

