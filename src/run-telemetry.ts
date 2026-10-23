import {ROUTES} from './config';
import type {Race,GameEvent} from './game';
import {telemetry,telemetryStore} from './telemetry';
import type {EventName,Params} from './telemetry-core';
type EnemyLog={kind:string;started:number;received:number;dealt:number};
type Special={id:string;kind:string;z:number;time:number;hits:number;kills:number};
type Emit=(name:EventName,params:Params)=>void;
const ACTIVE='ion-active-run-v1';
export class RunTelemetry {
  private r?:Race;private id='';private active=false;private recording=false;private startZ=0;private best=0;private death='unknown';
  private checkpointAt=0;private checkpointZ=0;private shots=0;private hits=0;private kills=0;private damage=0;private lanes=0;private surfaces=0;private heals=0;private shields=0;private threat=0;private speed=0;
  private enemies=new Map<number,EnemyLog>();private seenRifts=new Set<number>();private destinations=new Set<string>();private coreZ=-1;private coreId='';private rift?:Special;private ship?:Special;
  private tutorial=new Map<string,number>();private completed=new Set<string>();private frames=new Map<string,{seconds:number;frames:number;slow:number;enemies:number}>();
  constructor(private emit:Emit=(name,p)=>telemetry.emit(name,p)){}
  get isActive(){return this.active;}
  get runId(){return this.id;}
  private send(name:EventName,params:Params={}){if(this.recording)this.emit(name,{run_id:this.id,distance:Math.floor(this.r!.z),elapsed_s:Math.round(this.r!.elapsed*10)/10,...params});}
  recover(){try{const saved=JSON.parse(telemetryStore.getItem(ACTIVE)??'null');if(saved&&saved.is_test===0&&typeof saved.run_id==='string'&&Number.isFinite(saved.distance)&&Number.isFinite(saved.elapsed_s)&&Date.now()-saved.saved_at<72*3600000&&telemetry.enabled){this.emit('run_end',{run_id:saved.run_id,distance:saved.distance,elapsed_s:saved.elapsed_s,end_reason:'interrupted',observed_at_checkpoint:1});}}catch{}telemetryStore.removeItem(ACTIVE);}
  start(r:Race,best:number,recording=telemetry.enabled||telemetry.testMode){if(this.active&&this.r===r)return;this.end('restart');this.r=r;this.active=true;this.recording=recording;this.id=crypto.randomUUID();this.startZ=r.z;this.best=best;this.death='unknown';this.checkpointAt=r.elapsed;this.checkpointZ=r.z;this.shots=r.combat.shots;this.hits=r.combat.hits;this.kills=r.combat.kills;this.damage=r.hits;this.lanes=this.surfaces=this.heals=this.shields=this.threat=this.speed=0;this.enemies.clear();this.seenRifts.clear();this.destinations=new Set(ROUTES.filter(d=>d.start<=r.z).map(d=>d.id));this.coreZ=-1;this.coreId='';this.rift=undefined;this.ship=undefined;this.frames.clear();this.tutorial.clear();this.completed.clear();
    const counterKey=telemetry.testMode?'ion-test-runs-v1':'ion-started-runs-v1';const runs=Number(telemetryStore.getItem(counterKey)??0)+1;if(recording)telemetryStore.setItem(counterKey,String(runs));
    r.telemetry=(name,p)=>this.signal(name,p);
    this.send('run_start',{start_distance:Math.floor(r.z),run_number:runs,previous_best:Math.floor(best)});this.remember();

  }
  private signal(name:EventName,p:Params){if(!this.active)return;const r=this.r!;
    if(name==='damage_taken'){this.death=String(p.source_detail??p.source);const enemy=this.enemies.get(Number(p.enemy_id));if(enemy)enemy.dealt+=Number(p.health_before)-Number(p.health_after);this.send(name,{...p,enemy_id:p.enemy_id===undefined?'none':String(p.enemy_id),active_enemies:r.combat.enemies.filter(e=>e.active&&e.hp>0).length,nearby_obstacle:r.gates.find(g=>Math.abs(g.z-r.z)<25)?.kind??'none',mode:this.mode(),surface:r.surface,lane:r.lane});return;}
    if(name==='pickup_resolved'){if(p.outcome==='collected'){if(p.pickup_kind==='health')this.heals+=Number(p.amount);else this.shields+=Number(p.amount);}this.send(name,p);return;}
    this.send(name,p);
  }
  lessonStep(step:string,action:'shown'|'completed'|'skipped'){if(!this.active)return;if(action==='shown'){if(this.tutorial.has(step))return;this.tutorial.set(step,this.r!.elapsed);this.send('tutorial_step',{step,action});}else if(action==='completed')this.complete(step);else if(this.tutorial.has(step))this.send('tutorial_step',{step,action});}
  private complete(step:string){if(this.completed.has(step)||!this.tutorial.has(step))return;this.completed.add(step);this.send('tutorial_step',{step,action:'completed',step_duration_s:Math.round(this.r!.elapsed-this.tutorial.get(step)!)});}
  events(events:readonly GameEvent[]){if(!this.active)return;const r=this.r!;for(const e of events){
    if(e.type==='encounter'&&e.enemyId!==undefined&&e.kind&&!this.enemies.has(e.enemyId)){this.enemies.set(e.enemyId,{kind:e.kind,started:r.elapsed,received:0,dealt:0});this.send('enemy_encounter_start',{encounter_id:String(e.enemyId),enemy_kind:e.kind,mode:this.mode()});}
    if(e.type==='lane'){this.lanes++;}if(e.type==='shift')this.surfaces++;
    if(e.type==='boost'){this.send('turbo_used',{health:r.health,active_enemies:r.combat.enemies.filter(v=>v.active&&v.hp>0).length});}
    if(e.type==='enemyHit'&&e.enemyId!==undefined){const enemy=this.enemies.get(e.enemyId);if(enemy)enemy.received+=e.value??1;}
    if(e.type==='riftEnter'&&e.value!==1){const portal=r.riftTransit?.rift;if(portal){this.rift={id:String(portal.id),kind:portal.kind,z:r.z,time:r.elapsed,hits:r.hits,kills:r.combat.kills};this.send('rift_entered',{encounter_id:this.rift.id,rift_kind:portal.kind,health:r.health});}}
    if(e.type==='riftComplete')this.endRift('completed',e.value??0);
  }}
  update(r:Race,dt:number){if(!this.active||this.r!==r)return;const living=r.combat.enemies.filter(e=>e.active&&e.hp>0);if(living.length)this.threat+=dt;this.speed+=r.speed*dt;
    for(const e of r.combat.enemies){if(e.active&&!e.training&&!this.enemies.has(e.id)&&e.hp>0){this.enemies.set(e.id,{kind:e.kind,started:r.elapsed,received:0,dealt:0});this.send('enemy_encounter_start',{encounter_id:String(e.id),enemy_kind:e.kind,health:e.hp,mode:this.mode()});}}
    for(const [id,log] of this.enemies){const e=r.combat.enemies.find(v=>v.active&&v.id===id);if(!e||e.hp<=0)this.endEnemy(id,log,e?.hp===0?'defeated':r.riftTransit?'rift_cleared':'left_encounter');}
    for(const d of ROUTES){if(d.start>this.startZ&&r.z>=d.start&&!this.destinations.has(d.id)){this.destinations.add(d.id);this.send('destination_reached',{destination:d.id,first_discovery:this.best<d.start?1:0,arrival_mode:r.riftTransit?'rift_jump':this.mode()});}}
    if(!r.ship.active&&!r.riftTransit)for(const portal of r.rifts){if(!r.resolvedRifts.has(portal.id)&&portal.z>=r.z&&portal.z-r.z<170&&!this.seenRifts.has(portal.id)){this.seenRifts.add(portal.id);this.send('rift_presented',{encounter_id:String(portal.id),rift_kind:portal.kind,portal_distance:Math.floor(portal.z),surface:portal.surface,lane:portal.lane});}}
    const core=r.ship.core;if(core&&core.z>=r.z&&core.z-r.z<200&&core.z!==this.coreZ){this.coreZ=core.z;this.coreId=String(Math.floor(core.z));this.send('ship_core_presented',{encounter_id:this.coreId,core_distance:Math.floor(core.z),surface:core.surface,lane:core.lane});}
    if(r.ship.active&&!this.ship){this.ship={id:this.coreId,kind:'ship',z:r.z,time:r.elapsed,hits:r.hits,kills:r.combat.kills};this.send('ship_started',{encounter_id:this.coreId,health:r.health});}else if(!r.ship.active&&this.ship)this.endShip('landed');
    if(r.elapsed-this.checkpointAt>=30)this.checkpoint('interval');
  }
  private endEnemy(id:number,log:EnemyLog,outcome:string){this.send('enemy_encounter_end',{encounter_id:String(id),enemy_kind:log.kind,outcome,encounter_duration_s:Math.round((this.r!.elapsed-log.started)*10)/10,damage_received:log.received,damage_dealt:log.dealt});this.enemies.delete(id);}
  private endRift(outcome:string,reward=0){const s=this.rift;if(!s)return;this.send('rift_ended',{encounter_id:s.id,rift_kind:s.kind,outcome,distance_gained:Math.floor(this.r!.z-s.z),duration_s:Math.round(this.r!.elapsed-s.time),damage_taken:this.r!.hits-s.hits,reward});this.rift=undefined;}
  private endShip(outcome:string){const s=this.ship;if(!s)return;this.send('ship_ended',{encounter_id:s.id,outcome,distance_gained:Math.floor(this.r!.z-s.z),duration_s:Math.round(this.r!.elapsed-s.time),damage_taken:this.r!.hits-s.hits,kills:this.r!.combat.kills-s.kills});this.ship=undefined;}
  checkpoint(reason:string){if(!this.active)return;const r=this.r!,duration=r.elapsed-this.checkpointAt;if(duration<=0)return;this.send('run_checkpoint',{reason,segment_start:Math.floor(this.checkpointZ),segment_duration_s:Math.round(duration*10)/10,distance_gained:Math.floor(r.z-this.checkpointZ),health:r.health,shield:r.shield,shots:r.combat.shots-this.shots,shot_hits:r.combat.hits-this.hits,kills:r.combat.kills-this.kills,damage:r.hits-this.damage,lane_changes:this.lanes,surface_changes:this.surfaces,health_gained:this.heals,shield_gained:this.shields,threat_seconds:Math.round(this.threat),avg_speed:Math.round(this.speed/duration),mode:this.mode()});
    this.checkpointAt=r.elapsed;this.checkpointZ=r.z;this.shots=r.combat.shots;this.hits=r.combat.hits;this.kills=r.combat.kills;this.damage=r.hits;this.lanes=this.surfaces=this.heals=this.shields=this.threat=this.speed=0;this.performance();this.remember();
  }
  private remember(){if(this.recording&&(telemetry.enabled||telemetry.testMode))telemetryStore.setItem(ACTIVE,JSON.stringify({run_id:this.id,distance:Math.floor(this.r!.z),elapsed_s:Math.round(this.r!.elapsed),saved_at:Date.now(),is_test:telemetry.testMode?1:0}));}
  background(screen:string){if(this.active)this.checkpoint('background');if(this.recording||!this.active) this.emit('app_backgrounded',{screen,run_id:this.active?this.id:'none',distance:this.active?Math.floor(this.r!.z):0});void telemetry.flush();}
  frame(seconds:number){if(!this.active||seconds<=0)return;const mode=this.mode(),f=this.frames.get(mode)??{seconds:0,frames:0,slow:0,enemies:0};f.seconds+=seconds;f.frames++;if(seconds>1/30)f.slow++;f.enemies+=this.r!.combat.enemies.filter(e=>e.active&&e.hp>0).length;this.frames.set(mode,f);}
  private performance(){for(const [mode,f] of this.frames){if(f.seconds<.2)continue;this.send('performance_summary',{mode,sample_s:Math.round(f.seconds*10)/10,avg_fps:Math.round(f.frames/f.seconds),slow_frame_ratio:Math.round(f.slow/f.frames*1000)/1000,avg_enemies:Math.round(f.enemies/f.frames*10)/10,frames:f.frames});}this.frames.clear();}
  private mode(){return this.r?.training?'training':this.r?.riftTransit||this.r?.riftChallenge?'rift':this.r?.ship.active?'ship':'bike';}
  end(reason:string){if(!this.active)return;const r=this.r!;this.checkpoint('run_end');this.endRift(reason);this.endShip(reason);for(const [id,log] of this.enemies)this.endEnemy(id,log,'run_'+reason);this.send('run_end',{end_reason:reason,death_reason:reason==='death'?this.death:'none',start_distance:Math.floor(this.startZ),score:r.score,health:r.health,kills:r.combat.kills,shots:r.combat.shots,shot_hits:r.combat.hits,damage:r.hits,new_record:r.z>this.best?1:0,destination:r.route.id});this.active=false;r.telemetry=undefined;telemetryStore.removeItem(ACTIVE);void telemetry.flush();}
}
export const runTelemetry=new RunTelemetry();
