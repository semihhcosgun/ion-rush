import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AdaptivePerformance} from '../src/adaptive-performance';
function feed(p:AdaptivePerformance,seconds:number,dt:number){for(let t=0;t<seconds;t+=dt)p.sample(dt);}
test('isolated stalls do not degrade stable gameplay',()=>{
 const p=new AdaptivePerformance(1);feed(p,3,1/60);
 for(let i=0;i<900;i++)p.sample(i%120===0?.2:1/60);
 assert.equal(p.level,0);assert.equal(p.targetFps,60);
});
test('sustained pressure reduces effects in stages then targets 30',()=>{
 const p=new AdaptivePerformance(1);feed(p,60,1/25);
 assert.equal(p.level,6);assert.equal(p.targetFps,30);assert.equal(p.ratio,.7);
 assert.equal(p.bloom,false);assert.equal(p.shadows,false);
});
test('recovery is slower than degradation and probes 60 before raising quality',()=>{
 const p=new AdaptivePerformance(1);feed(p,60,1/25);
 feed(p,10,1/30);assert.equal(p.targetFps,30);
 for(let i=0;i<1200&&p.targetFps===30;i++)p.sample(1/30);
 assert.equal(p.targetFps,60);assert.equal(p.level,6);
 feed(p,36,1/60);assert.ok(p.level<6);
});
test('30 FPS pacing skips drawing only and reset allows an immediate frame',()=>{
 const p=new AdaptivePerformance(1);p.targetFps=30;let count=0;
 for(let i=0;i<60;i++)if(p.due(i*1000/60))count++;
 assert.equal(count,30);p.resetSampling();assert.equal(p.due(1),true);
});
test('background gaps reset measurement without lowering quality',()=>{
 const p=new AdaptivePerformance(1.5);p.sample(5);feed(p,1,1/15);
 assert.equal(p.level,0);assert.equal(p.ratio,1.5);
});

test('late callbacks do not shift all following 30 FPS deadlines',()=>{
 const p=new AdaptivePerformance(1);p.targetFps=30;
 assert.equal(p.due(0),true);
 assert.equal(p.due(40),true);
 assert.equal(p.due(50),false);
 assert.equal(p.due(1000/15),true);
 assert.equal(p.due(100),true);
 assert.equal(p.due(250),true);
 assert.equal(p.due(251),false);
 assert.equal(p.due(800/3),true);
});
test('all devices start with the same quality and frame target policy',()=>{
 for(const ratio of [.8,1,1.5]){
  const p=new AdaptivePerformance(ratio);
  assert.equal(p.targetFps,60);assert.equal(p.level,0);
  assert.equal(p.ratio,ratio);assert.equal(p.bloom,true);assert.equal(p.shadows,true);
 }
});

test('failed recovery probes back off across sampling resets on every device',()=>{
 for(const ratio of [1,1.5]){
  const p=new AdaptivePerformance(ratio);feed(p,60,1/25);
  for(let i=0;i<1500&&p.targetFps===30;i++)p.sample(1/30);
  assert.equal(p.targetFps,60);
  feed(p,7,1/25);assert.equal(p.targetFps,30);
  p.resetSampling();feed(p,65,1/30);assert.equal(p.targetFps,30);
  for(let i=0;i<2400&&p.targetFps===30;i++)p.sample(1/30);assert.equal(p.targetFps,60);
 }
});

test('sustained 60 FPS never increases the initial GPU budget',()=>{
 for(const cap of [.8,1,1.5,1.6,1.75,2,2.25,2.5,3]){
  const p=new AdaptivePerformance(cap);feed(p,600,1/60);
  assert.equal(p.level,0);assert.equal(p.ratio,Math.min(cap,1.5));
  assert.equal(p.shadowSize,1024);assert.equal(p.targetFps,60);
 }
});
test('recovery restores the starting budget without exceeding it',()=>{
 const p=new AdaptivePerformance(3);feed(p,60,1/25);
 assert.equal(p.targetFps,30);assert.equal(p.level,6);
 for(let i=0;i<1500&&p.targetFps===30;i++)p.sample(1/30);
 assert.equal(p.targetFps,60);
 feed(p,250,1/60);
 assert.equal(p.level,0);assert.equal(p.ratio,1.5);assert.equal(p.shadowSize,1024);
});
test('resolution reduction still respects native density on slow devices',()=>{
 for(const cap of [.8,1,1.5,2,2.5]){
  const p=new AdaptivePerformance(cap);feed(p,60,1/25);
  assert.equal(p.level,6);assert.equal(p.targetFps,30);
  assert.ok(Math.abs(p.ratio-Math.min(cap,Math.max(.7,Math.min(cap,1.5)-.3)))<1e-9);
 }
});
test('60 FPS drawing budget holds across ordinary and high-refresh displays',()=>{
 for(const refresh of [60,90,120,144]){
  const p=new AdaptivePerformance(2);let draws=0;
  for(let i=0;i<refresh*10;i++)if(p.due(i*1000/refresh))draws++;
  assert.equal(draws,600,`drawing count at ${refresh} Hz`);
 }
});
test('60 FPS pacing tolerates vsync jitter and does not repay missed frames in bursts',()=>{
 const p=new AdaptivePerformance(2);let draws=0;
 for(let i=0;i<600;i++)if(p.due(i*1000/59.94+(i%2?.4:-.4)))draws++;
 assert.equal(draws,600);
 assert.equal(p.due(20000),true);
 assert.equal(p.due(20001),false);
 p.resetSampling();assert.equal(p.due(20001),true);
});

test('first economy tier preserves pixel density while distant road detail is reduced',()=>{
 const p=new AdaptivePerformance(2);const base=p.ratio;p.level=1;assert.equal(p.ratio,base);
 p.level=2;assert.equal(p.ratio,base);
});



test('environment and effect tiers are spent before lowering resolution, with 60 FPS retained',()=>{
 const p=new AdaptivePerformance(2);
 for(let level=0;level<=5;level++){p.level=level;assert.equal(p.ratio,1.5);assert.equal(p.targetFps,60);assert.equal(p.effects,Math.min(level,2));}
 p.level=5;assert.equal(p.ratio,1.5);p.level=6;assert.ok(Math.abs(p.ratio-1.2)<1e-9);
});

test('sustained sub-30 rendering sheds expensive passes promptly without capping 60',()=>{
 const p=new AdaptivePerformance(2);feed(p,4.2,1/25);
 assert.equal(p.level,3);assert.equal(p.bloom,false);assert.equal(p.ratio,1.5);assert.equal(p.targetFps,60);
 feed(p,2.5,1/25);assert.equal(p.level,4);assert.equal(p.shadows,false);assert.equal(p.ratio,1.5);
 feed(p,2.5,1/25);assert.equal(p.level,6);assert.equal(p.targetFps,60);assert.ok(Math.abs(p.ratio-1.2)<1e-9);
});

test('fast effect shedding does not bring forward the 30 FPS fallback',()=>{
 const p=new AdaptivePerformance(2);feed(p,30,1/25);
 assert.equal(p.level,6);assert.equal(p.targetFps,60);
 feed(p,20,1/25);assert.equal(p.targetFps,30);
});

test('persistent 35 FPS pressure skips the empty tier without reducing the resolution floor',()=>{
 const p=new AdaptivePerformance(2);feed(p,10,1/35);
 assert.equal(p.level,6);assert.equal(p.targetFps,60);assert.ok(Math.abs(p.ratio-1.2)<1e-9);
});

test('ordinary 30 FPS pacing jitter does not indefinitely prevent a 60 FPS probe',()=>{
 const p=new AdaptivePerformance(2);feed(p,60,1/25);assert.equal(p.targetFps,30);
 for(let i=0;i<1200&&p.targetFps===30;i++)p.sample(1/28);
 assert.equal(p.targetFps,60);assert.equal(p.level,6);
});


test('sustained 35 to 50 FPS never gets artificially reduced to 30',()=>{
 for(const fps of [35,37,43,50]){
  const p=new AdaptivePerformance(2.5);feed(p,180,1/fps);
  assert.equal(p.targetFps,60,`must preserve ${fps} FPS delivery`);
 }
});
test('a recovery probe keeps 40 FPS instead of locking back to 30',()=>{
 const p=new AdaptivePerformance(2);feed(p,60,1/25);
 for(let i=0;i<1500&&p.targetFps===30;i++)p.sample(1/30);
 assert.equal(p.targetFps,60);feed(p,90,1/40);assert.equal(p.targetFps,60);
});
