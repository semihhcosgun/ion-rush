import {PowerBudget} from './power-budget';
import {ThermalProtection} from './thermal-protection';
/** Uses delivered frame intervals; CPU submission time is not a GPU timer. */
export class AdaptivePerformance {
  level=0;
  private frameTarget:30|60=60;
  get targetFps():30|60{return this.thermal.maxFps===30||this.power.maxFps===30?30:this.frameTarget;}
  set targetFps(value:30|60){this.frameTarget=value;}
  get effectiveLevel(){return Math.max(this.level,this.thermal.levelFloor,this.power.levelFloor);}
  averageMs=0;
  private intervals:number[]=[];
  private elapsed=0;
  private bad=0;
  private good=0;
  private warmup=2;
  private deadline=0;
  private lastFrame=0;
  private recoveryWindows=15;
  private probing=false;
  private pressureSeconds=0;
  // Reduce distant detail/effects before trading clarity for resolution.
  constructor(readonly maxRatio:number,readonly thermal=new ThermalProtection(),readonly power=new PowerBudget()) {}
  // Stable FPS is not evidence of thermal headroom. Recover only to the
  // starting budget instead of escalating resolution and shadow maps.
  get shadowSize(){return this.thermal.shadowSize;}
  get ratio(){const base=Math.min(this.maxRatio,1.5);return Math.min(this.power.ratioCap,this.thermal.ratioCap,base,Math.max(.7,base-Math.max(0,this.effectiveLevel-5)*.3));}
  get effects(){return Math.min(2,Math.max(0,this.effectiveLevel));}
  get bloom(){return this.effectiveLevel<3;}
  get shadows(){return this.effectiveLevel<4;}
  resetSampling(){this.intervals=[];this.elapsed=0;this.bad=0;this.good=0;this.warmup=2;this.deadline=0;this.lastFrame=0;}
  due(now:number){
    if(now+1<this.deadline)return false;
    const period=1000/this.targetFps;
    // Keep the display cadence after a late callback; do not move every
    // subsequent deadline to the delayed frame and accidentally skip a vsync.
    if(!this.deadline)this.deadline=now+period;
    else this.deadline+=Math.max(1,Math.floor((now+1-this.deadline)/period)+1)*period;
    return true;
  }
  presented(now:number){
    const previous=this.lastFrame;this.lastFrame=now;
    return previous?this.sample((now-previous)/1000):false;
  }
  sample(seconds:number){
    if(!Number.isFinite(seconds)||seconds<=0||seconds>1){this.pressureSeconds=0;this.resetSampling();return false;}
    if(this.thermal.advance(seconds)){this.resetSampling();return true;}
    if(this.targetFps===60)this.pressureSeconds+=seconds;
    if(this.warmup>0){this.warmup-=seconds;return false;}
    this.intervals.push(seconds*1000);this.elapsed+=seconds;
    if(this.elapsed<2)return false;
    // Trim isolated stalls, while sustained slow frames remain in the window.
    const sorted=this.intervals.sort((a,b)=>a-b);
    const kept=sorted.slice(0,Math.max(1,Math.ceil(sorted.length*.95)));
    this.averageMs=kept.reduce((a,b)=>a+b,0)/kept.length;
    this.intervals=[];this.elapsed=0;
    // Keep reporting actual frame delivery, but never probe 60 FPS while hot.
    if(this.thermal.maxFps===30||this.power.maxFps===30){this.bad=0;this.good=0;return false;}
    const slow=this.averageMs>1000/this.targetFps*1.18;
    if(!slow||this.targetFps===60&&this.averageMs<=1000/32)this.pressureSeconds=0;
    this.bad=slow?this.bad+1:0;
    const recoveryTolerance=this.targetFps===30?1.12:1.04;
    this.good=!slow&&this.averageMs<1000/this.targetFps*recoveryTolerance?this.good+1:0;
    // Sustained sub-45 delivery needs a useful response, not six repeated warm-ups.
    // Keep the existing resolution floor and 60 FPS target while shedding effects.
    if(this.targetFps===60&&this.level>=0&&this.level<6&&this.averageMs>1000/45){
      this.level=this.level<3?3:this.level<4?4:6;
      this.resetSampling();this.warmup=.25;return true;
    }
    if(this.bad>=2){
      this.bad=0;this.good=0;
      if(this.level<6)this.level++;
      // Never discard frames when the scene already delivers above 30 FPS.
      else if(this.targetFps===60&&this.averageMs>1000/32&&(this.probing||this.pressureSeconds>=40)){
        this.targetFps=30;
        if(this.probing)this.recoveryWindows=Math.min(150,this.recoveryWindows*4);
        this.probing=false;
      }
      else return false;
      this.resetSampling();return true;
    }
    // A 60 FPS probe is required: paced 30 FPS alone cannot prove 60 FPS capacity.
    if(this.good>=(this.targetFps===30?this.recoveryWindows:15)){
      this.good=0;
      if(this.targetFps===30){this.targetFps=60;this.probing=true;}
      else if(this.level>0){this.level--;this.probing=false;this.recoveryWindows=15;}
      else return false;
      this.resetSampling();return true;
    }
    return false;
  }
}
