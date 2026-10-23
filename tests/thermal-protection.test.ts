import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ThermalProtection} from '../src/thermal-protection';
import {AdaptivePerformance} from '../src/adaptive-performance';
import {ThermalMonitor,type ThermalPlugin,type ThermalStatus} from '../src/thermal-monitor';
function feed(p:AdaptivePerformance,seconds:number,dt=1/60){for(let i=0;i<Math.round(seconds/dt);i++)p.sample(dt);}

test('warming reduces GPU work even while frame delivery stays at 60 FPS',()=>{
 const thermal=new ThermalProtection(),p=new AdaptivePerformance(3,thermal);
 assert.equal(thermal.setState('fair'),true);
 assert.equal(p.targetFps,60);assert.equal(p.ratio,1.25);assert.equal(p.bloom,false);
 assert.equal(p.shadows,true);assert.equal(p.shadowSize,512);assert.equal(p.effects,2);
 feed(p,600);assert.equal(p.ratio,1.25);assert.equal(p.bloom,false);
});
test('serious and critical heat cap frame rate despite stable delivery and resets',()=>{
 const thermal=new ThermalProtection(),p=new AdaptivePerformance(3,thermal);
 thermal.setState('serious');feed(p,600,1/30);p.resetSampling();
 assert.equal(p.targetFps,30);assert.equal(p.ratio,1);assert.equal(p.shadows,false);
 assert.ok(Math.abs(p.averageMs-1000/30)<1e-6,'HUD still reports the delivered 30 FPS');
 thermal.setState('critical');assert.equal(p.ratio,.85);assert.equal(p.targetFps,30);
 assert.equal(p.due(0),true);assert.equal(p.due(1000/60),false);assert.equal(p.due(1000/30),true);
});
test('cooling restores one tier per 30 seconds of active frames',()=>{
 const thermal=new ThermalProtection(),p=new AdaptivePerformance(3,thermal);
 thermal.setState('critical');thermal.setState('nominal');
 feed(p,29,1/30);assert.equal(thermal.state,'critical');
 feed(p,1,1/30);assert.equal(thermal.state,'serious');assert.equal(p.targetFps,30);
 feed(p,30,1/30);assert.equal(thermal.state,'fair');assert.equal(p.targetFps,60);assert.equal(p.ratio,1.25);
 feed(p,29);assert.equal(thermal.state,'fair');
 feed(p,1);assert.equal(thermal.state,'nominal');assert.equal(p.ratio,1.5);
});
test('warming again cancels pending recovery without oscillating quality',()=>{
 const thermal=new ThermalProtection(),p=new AdaptivePerformance(2,thermal);
 thermal.setState('serious');thermal.setState('nominal');feed(p,29,1/30);
 thermal.setState('serious');feed(p,60,1/30);assert.equal(thermal.state,'serious');
 thermal.setState('fair');feed(p,30,1/30);assert.equal(thermal.state,'fair');
 feed(p,120);assert.equal(thermal.state,'fair');
});
test('background gaps and resetting FPS samples do not count as cooling',()=>{
 const thermal=new ThermalProtection(),p=new AdaptivePerformance(2,thermal);
 thermal.setState('serious');thermal.setState('nominal');
 for(const dt of [120,Infinity,NaN,-1,0])p.sample(dt);
 p.resetSampling();assert.equal(thermal.state,'serious');assert.equal(p.targetFps,30);
 feed(p,29,1/30);assert.equal(thermal.state,'serious');
});
test('changing quality or starting another race preserves the thermal budget',()=>{
 const thermal=new ThermalProtection();thermal.setState('serious');
 for(let i=0;i<3;i++){
  const p=new AdaptivePerformance(2,thermal);p.resetSampling();
  assert.equal(p.targetFps,30);assert.equal(p.ratio,1);assert.equal(p.bloom,false);
 }
});
test('thermal limits never increase native density or discard an existing FPS fallback',()=>{
 for(const ratio of [.8,1,1.5,3]){
  const thermal=new ThermalProtection(),p=new AdaptivePerformance(ratio,thermal);
  thermal.setState('fair');assert.ok(p.ratio<=ratio);assert.equal(p.targetFps,60);
 }
 const thermal=new ThermalProtection(),p=new AdaptivePerformance(2,thermal);
 p.targetFps=30;thermal.setState('serious');thermal.setState('nominal');feed(p,60,1/30);
 assert.equal(thermal.state,'nominal');assert.equal(p.targetFps,30);
});

function mockPlugin(){
 let changed:((status:ThermalStatus)=>void)|undefined,removed=false;
 const plugin:ThermalPlugin={getStatus:async()=>({supported:true,state:'nominal'}),addListener:async(_event,fn)=>{
  changed=fn;return {remove:async()=>{removed=true;}};
 }};
 return {plugin,emit:(status:ThermalStatus)=>changed!(status),removed:()=>removed};
}
test('thermal bridge reads initial state and applies subsequent notifications',async()=>{
 const mock=mockPlugin(),received:string[]=[];
 mock.plugin.getStatus=async()=>({supported:true,state:'fair'});
 const monitor=new ThermalMonitor(s=>received.push(s),mock.plugin);await monitor.start();
 mock.emit({supported:true,state:'serious'});await monitor.stop();mock.emit({supported:true,state:'nominal'});
 assert.deepEqual(received,['fair','serious']);assert.equal(mock.removed(),true);
});
test('an old status read cannot overwrite a newer thermal notification',async()=>{
 const mock=mockPlugin(),received:string[]=[];
 let resolve!:(value:ThermalStatus)=>void;
 mock.plugin.getStatus=()=>new Promise(r=>{resolve=r;});
 const monitor=new ThermalMonitor(s=>received.push(s),mock.plugin);const start=monitor.start();
 await Promise.resolve();mock.emit({supported:true,state:'critical'});
 resolve({supported:true,state:'nominal'});await start;
 assert.deepEqual(received,['critical']);await monitor.stop();
});
test('unsupported sensors and failed refreshes never release known heat limits',async()=>{
 const mock=mockPlugin(),received:string[]=[];
 const monitor=new ThermalMonitor(s=>received.push(s),mock.plugin);await monitor.start();
 mock.emit({supported:true,state:'serious'});mock.emit({supported:false,state:'nominal'});
 mock.plugin.getStatus=async()=>{throw new Error('unavailable');};await monitor.refresh();
 assert.deepEqual(received,['nominal','serious']);await monitor.stop();
});
test('concurrent refreshes accept only the newest status snapshot',async()=>{
 const mock=mockPlugin(),received:string[]=[];
 const monitor=new ThermalMonitor(s=>received.push(s),mock.plugin);await monitor.start();received.length=0;
 const reads:Array<(status:ThermalStatus)=>void>=[];
 mock.plugin.getStatus=()=>new Promise(resolve=>reads.push(resolve));
 const old=monitor.refresh(),fresh=monitor.refresh();
 reads[1]({supported:true,state:'serious'});await fresh;
 reads[0]({supported:true,state:'nominal'});await old;
 assert.deepEqual(received,['serious']);await monitor.stop();
});
