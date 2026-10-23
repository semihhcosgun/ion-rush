import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GpuTimer} from '../src/gpu-timer';
test('GPU timer waits across frames, discards disjoint results and releases queries',()=>{
 let available=false,disjoint=false,deleted=0,resultReads=0;
 const gl={QUERY_RESULT_AVAILABLE:1,QUERY_RESULT:2,getExtension:()=>({TIME_ELAPSED_EXT:3,GPU_DISJOINT_EXT:4}),getParameter:()=>disjoint,
  createQuery:()=>({}),beginQuery:()=>{},endQuery:()=>{},deleteQuery:()=>{deleted++;},getQueryParameter:(_:unknown,key:number)=>{if(key===1)return available;resultReads++;return 12000000;}};
 const timer=new GpuTimer(gl as unknown as WebGL2RenderingContext);
 for(let i=0;i<31;i++){timer.begin();timer.end();}assert.equal(resultReads,0);
 available=true;timer.begin();timer.end();assert.equal(timer.milliseconds,12);assert.equal(deleted,1);
 disjoint=true;timer.begin();timer.end();assert.equal(timer.milliseconds,null);timer.dispose();
});
test('unsupported GPU timers leave measurements unavailable',()=>{
 const timer=new GpuTimer({getExtension:()=>null} as unknown as WebGL2RenderingContext);
 timer.begin();timer.end();timer.dispose();assert.equal(timer.milliseconds,null);
});
