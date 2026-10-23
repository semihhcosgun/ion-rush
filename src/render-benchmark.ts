import {World} from './world';
import {Race} from './game';
import {ROUTES} from './config';

/** Explicit diagnostic build only. Never writes saves or awards gameplay rewards. */
export async function runRenderBenchmark(canvas:HTMLCanvasElement,ui:HTMLElement){
 ui.style.cssText='background:none;pointer-events:none;padding:12px;font-size:12px';
 ui.textContent='Device diagnostic: loading';
 const world=new World(canvas);await world.loadArtwork(()=>{});
 let race=new Race(ROUTES[0].seed);await world.prepare(race,()=>{});
 world.setQuality('low');world.adaptive.level=6;world.quality='auto';world.pixelRatio=1.2;world.resize();
 const reports:unknown[]=[];
 const variants=['baseline','direct-render','no-road','no-enemies','no-scenery','ratio-1'] as const;
 let variant:typeof variants[number]='baseline';
 const render=world.composer.render.bind(world.composer);
 world.composer.render=(dt?:number)=>{
  const objects=variant==='no-road'?[world.track]:variant==='no-enemies'?[world.combatView.root]:variant==='no-scenery'?[world.sanFrancisco.root,world.deepSpace.root,world.planet,world.atmosphere,world.moon,world.stars]:[];
  const visible=objects.map(o=>o.visible);objects.forEach(o=>o.visible=false);
  try{if(variant==='direct-render')world.renderer.render(world.scene,world.camera);else render(dt);}
  finally{objects.forEach((o,i)=>o.visible=visible[i]);}
 };
 // Forward/reverse order limits systematic warm-up and heating bias.
 for(const start of [9800])for(const pass of [0,1])for(const mode of pass?[...variants].reverse():variants){
  variant=mode;world.pixelRatio=mode==='ratio-1'?1:1.2;world.resize();
  race=new Race(ROUTES[0].seed);const intervals:number[]=[],cpu:number[]=[],submit:number[]=[],calls:number[]=[],triangles:number[]=[],gpu:number[]=[];let last=0;
  world.timer=0;world.cameraAngle=0;
  for(let frame=0;frame<150;frame++){
   const now=await new Promise<number>(requestAnimationFrame);
   race.z=start+frame*.4;race.time=frame/60;race.ensureCourse();
   race.combat.enemies.slice(0,3).forEach((e,i)=>Object.assign(e,{active:true,id:i+1,kind:i===1?'saucer':'drone',hp:3,maxHp:3,age:2+frame/60,z:race.z+40+i*22,lane:i-1,surface:0}));
   world.render(1/60,race);
   if(frame>=30){intervals.push(now-last);cpu.push(world.profile.updateMs);submit.push(world.profile.submitMs);calls.push(world.profile.calls);triangles.push(world.profile.triangles);if(world.gpuTimer.milliseconds!==null)gpu.push(world.gpuTimer.milliseconds);}
   last=now;
  }
  const mean=(a:number[])=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
  const sorted=[...intervals].sort((a,b)=>a-b);
  const result={start,pass,variant,ratio:world.pixelRatio,width:innerWidth,height:innerHeight,frames:intervals.length,intervalMs:mean(intervals),p95Ms:sorted[Math.ceil(sorted.length*.95)-1],updateMs:mean(cpu),submitMs:mean(submit),gpuMs:mean(gpu),calls:mean(calls),triangles:mean(triangles)};
  reports.push(result);console.info('ION_BENCH '+JSON.stringify(result));ui.textContent=`Diagnostic ${start} / ${pass+1} / ${variant}`;
 }
 (window as unknown as {ionBenchmark:unknown}).ionBenchmark=reports;
 for(const report of reports)console.info('ION_BENCH_REPLAY '+JSON.stringify(report));
 console.info('ION_BENCH_DONE');ui.textContent='Diagnostic complete';
}

