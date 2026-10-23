import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PowerBudget} from '../src/power-budget';
import {ThermalProtection} from '../src/thermal-protection';
import {AdaptivePerformance} from '../src/adaptive-performance';
import {PowerMonitor,type PowerPlugin,type PowerStatus} from '../src/power-monitor';
import {RiderShadow} from '../src/rider-shadow';
function feed(p:AdaptivePerformance,seconds:number,dt=1/60){for(let i=0;i<Math.round(seconds/dt);i++)p.sample(dt);}

test('OS low power mode reduces rendering work while retaining the 60 FPS target',()=>{
 const power=new PowerBudget(),p=new AdaptivePerformance(3,undefined,power);
 power.setLowPower(true);feed(p,600);
 assert.equal(p.targetFps,60);assert.equal(p.ratio,1.1);assert.equal(p.effects,2);assert.equal(p.bloom,false);
 power.setLowPower(false);assert.equal(p.targetFps,60);assert.equal(p.ratio,1.5);assert.equal(p.bloom,true);
});
test('explicit Battery saver holds 30 FPS and cannot be released by stable FPS samples',()=>{
 const power=new PowerBudget(),p=new AdaptivePerformance(3,undefined,power);
 power.setSaver(true);feed(p,600,1/30);p.resetSampling();
 assert.equal(p.targetFps,30);assert.equal(p.ratio,1);assert.equal(p.bloom,false);
 power.setLowPower(true);power.setLowPower(false);assert.equal(p.targetFps,30);
 power.setSaver(false);assert.equal(p.targetFps,60);assert.equal(p.ratio,1.5);
});
test('power changes never relax the thermal budget or an existing performance fallback',()=>{
 const power=new PowerBudget(),thermal=new ThermalProtection(),p=new AdaptivePerformance(3,thermal,power);
 thermal.setState('critical');power.setLowPower(true);power.setSaver(true);
 assert.equal(p.ratio,.85);assert.equal(p.targetFps,30);
 power.setSaver(false);power.setLowPower(false);assert.equal(p.ratio,.85);assert.equal(p.targetFps,30);
 const slow=new AdaptivePerformance(3,undefined,power);slow.targetFps=30;
 power.setSaver(true);power.setSaver(false);assert.equal(slow.targetFps,30);
});
test('quality resets retain system power saving without increasing low native density',()=>{
 const power=new PowerBudget();power.setLowPower(true);
 for(const cap of [.8,1,1.5,3]){
  const p=new AdaptivePerformance(cap,undefined,power);assert.ok(p.ratio<=cap);assert.ok(p.ratio<=1.1);
  assert.equal(p.targetFps,60);assert.equal(p.bloom,false);
 }
});

function mockPlugin(){
 let changed:((status:PowerStatus)=>void)|undefined,removed=false;
 const plugin:PowerPlugin={getPowerStatus:async()=>({supported:true,lowPower:false}),addListener:async(_event,fn)=>{
  changed=fn;return {remove:async()=>{removed=true;}};
 }};
 return {plugin,emit:(status:PowerStatus)=>changed!(status),removed:()=>removed};
}
test('power bridge reads the initial mode and subsequent changes independently of heat',async()=>{
 const mock=mockPlugin(),received:boolean[]=[];mock.plugin.getPowerStatus=async()=>({supported:true,lowPower:true});
 const monitor=new PowerMonitor(s=>received.push(s),mock.plugin);await monitor.start();
 mock.emit({supported:true,lowPower:false});await monitor.stop();mock.emit({supported:true,lowPower:true});
 assert.deepEqual(received,[true,false]);assert.equal(mock.removed(),true);
});
test('power notifications invalidate older snapshots and failed reads preserve the budget',async()=>{
 const mock=mockPlugin(),received:boolean[]=[];let resolve!:(status:PowerStatus)=>void;
 mock.plugin.getPowerStatus=()=>new Promise(r=>{resolve=r;});
 const monitor=new PowerMonitor(s=>received.push(s),mock.plugin);const start=monitor.start();
 await Promise.resolve();mock.emit({supported:true,lowPower:true});resolve({supported:true,lowPower:false});await start;
 mock.plugin.getPowerStatus=async()=>{throw new Error('offline');};await monitor.refresh();
 mock.emit({supported:false,lowPower:false});assert.deepEqual(received,[true]);await monitor.stop();
});

test('contact shadow stays on the road and becomes softer as the vehicle rises',()=>{
 const shadow=new RiderShadow();shadow.update(0,true);const opacity=shadow.mesh.material.uniforms.opacity.value;
 shadow.update(.5,true);
 assert.ok(Math.abs(shadow.mesh.position.y+4+.13)<1e-9);
 assert.ok(shadow.mesh.material.uniforms.opacity.value<opacity);assert.ok(shadow.mesh.scale.x>1);
 assert.equal(shadow.mesh.geometry.index!.count,6);assert.equal(shadow.mesh.material.depthWrite,false);
 assert.equal(shadow.mesh.castShadow,false);assert.equal(shadow.mesh.receiveShadow,false);
 shadow.mesh.geometry.dispose();shadow.mesh.material.dispose();
});
test('contact shadow avoids missing road panels, flight, and corner transitions',()=>{
 const shadow=new RiderShadow();shadow.update(0,false);assert.equal(shadow.mesh.visible,false);
 shadow.update(1,true);assert.equal(shadow.mesh.visible,false);
 shadow.update(0,true,Math.PI/4);assert.equal(shadow.mesh.visible,false);
 for(const side of [0,Math.PI/2,Math.PI,3*Math.PI/2]){shadow.update(0,true,side);assert.equal(shadow.mesh.visible,true);}
 shadow.mesh.geometry.dispose();shadow.mesh.material.dispose();
});
