import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Object3D} from 'three';
import {VisibleModelGroup} from '../src/visible-model-group';
test('hidden pool skips child transforms and refreshes after its parent moved',()=>{
 const root=new Group(),model=new VisibleModelGroup(),child=new Object3D();root.add(model);model.add(child);
 let calls=0;const update=child.updateMatrixWorld;child.updateMatrixWorld=function(force){calls++;update.call(this,force);};
 root.updateMatrixWorld(true);calls=0;model.visible=false;root.position.x=12;
 for(let i=0;i<60;i++)root.updateMatrixWorld(true);
 assert.equal(calls,0);
 model.visible=true;root.updateMatrixWorld();assert.equal(calls,1);assert.equal(child.matrixWorld.elements[12],12);
 assert.ok(model.clone() instanceof VisibleModelGroup);
});


test('nested dormant effects refresh after moving and reappearing independently',()=>{
 const scene=new Group(),outer=new VisibleModelGroup(),inner=new VisibleModelGroup(),child=new Object3D();
 scene.add(outer);outer.add(inner);inner.add(child);scene.updateMatrixWorld(true);
 outer.visible=false;inner.visible=false;scene.position.set(20,30,40);inner.position.set(1,2,3);child.position.set(4,5,6);
 scene.updateMatrixWorld(true);outer.visible=true;scene.updateMatrixWorld();
 inner.visible=true;scene.updateMatrixWorld();
 assert.deepEqual(child.matrixWorld.elements.slice(12,15),[25,37,49]);
});
