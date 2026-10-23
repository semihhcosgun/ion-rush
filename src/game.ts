import {EarthSupport} from './earth-support';
import {ShipMode} from './ship';
import {MeteorField} from './meteors';
import {Combat} from './combat';
import {RUNNER,runnerEnabled} from './runner';
import {OVERDRIVE,TurboOverdrive,overdriveEnabled} from './overdrive';
import {vanguardEnabled} from './vanguard';
import {singularityEnabled} from './singularity';
import {titanEnabled} from './titan';
import {PhaseDrive,phantomEnabled,phaseActive,phaseBlocks} from './phantom';
import {TUNE,SURVIVAL,ENCOUNTERS,PACING,RUN_GOALS,stageAt,type ObstacleKind,type Route} from './config';
import {marketingCaptureMode,meteorPreviewMode,andromedaPreviewMode,sfPreviewMode,ascentPreviewMode} from './dev-flags';
import {RiftStream,suctionRift,type Rift,type RiftKind} from './rifts';
import {obstacleContact,gateContactReach} from './obstacle-collision';
export {isDangerous} from './obstacle-collision';
export type PickupKind="shield"|"health";
export interface Gate{wave?:boolean;pickup?:{kind:PickupKind;lane:number};id:number;z:number;safe:number;blocked:number[];kind:ObstacleKind;phase:number;cluster:number;checkpoint:boolean;lane?:number;energyLane?:number;}
export const wrap=(n:number)=>(n%4+4)%4;
export function random(seed:number){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export class CourseStream{
 private rng:()=>number;private recentKinds:ObstacleKind[]=[];private previousGap=0;private breathIn=3;private pickupIn=0;nextId=0;nextZ:number=TUNE.startDistance;safe=0;
 constructor(seed:number,private maximumSpeed:number=TUNE.boostSpeed){this.rng=random(seed);}
 next():Gate{
  const id=this.nextId++,z=this.nextZ,stage=stageAt(z);this.safe=wrap(this.safe+(this.rng()>.5?1:-1));
  let pool:ObstacleKind[]=id<3?['barrier']:z<PACING.blockUnlock?['barrier','arm']:z<PACING.laserUnlock?['barrier','arm','block']:z<1400?['barrier','arm','block','laser']:stage.kinds;
  // Preserve random order while preventing repeated runs of the same hazard.
  if(id>=3&&this.recentKinds.length===2&&this.recentKinds[0]===this.recentKinds[1])pool=pool.filter(k=>k!==this.recentKinds[1]);
  const kind=pool[Math.floor(this.rng()*pool.length)];this.recentKinds.push(kind);if(this.recentKinds.length>2)this.recentKinds.shift();
  const gate:Gate={id,z,safe:this.safe,blocked:[0,1,2,3].filter(s=>s!==this.safe&&(id>=3||s===0)),kind,phase:this.rng()*Math.PI*2,cluster:Math.floor(id/3),checkpoint:false,wave:id>=3&&this.rng()<(z<1000?ENCOUNTERS.earlyWaveChance:ENCOUNTERS.waveChance)};
  if(kind==='barrier'&&this.rng()<.65){gate.lane=Math.floor(this.rng()*3)-1;gate.energyLane=gate.lane===0?(this.rng()>.5?1:-1):0;}
  if(this.pickupIn--<=0){gate.pickup={kind:this.rng()<ENCOUNTERS.shieldChance?'shield':'health',lane:Math.floor(this.rng()*3)-1};this.pickupIn=ENCOUNTERS.pickupMinGap-1+Math.floor(this.rng()*ENCOUNTERS.pickupGapSpread);}
  // Guarantee recharge + transition + reaction time at BOOST speed before decorating.
  const minimum=Math.ceil(((TUNE.recharge+TUNE.shiftDuration+TUNE.reactionTime)*this.maximumSpeed+2*TUNE.collisionHalfWidth)/8)*8;
  const breathing=this.breathIn--<=0;if(breathing)this.breathIn=ENCOUNTERS.breathMinGap-1+Math.floor(this.rng()*ENCOUNTERS.breathGapSpread);
  const progress=Math.min(1,z/PACING.settleDistance),cruise=TUNE.speed+(TUNE.maxCruise-TUNE.speed)*Math.min(1,z/TUNE.speedRampDistance);
  const seconds=PACING.earlySeconds+(PACING.lateSeconds-PACING.earlySeconds)*progress+(this.rng()*2-1)*PACING.jitterSeconds+(breathing?PACING.breathSeconds:0)+(kind==='barrier'?0:PACING.complexSeconds);
  let gap=Math.max(minimum,Math.round(seconds*cruise/8)*8);
  if(this.previousGap)gap=Math.max(minimum,this.previousGap-PACING.maxGapChange,Math.min(this.previousGap+PACING.maxGapChange,gap));
  this.previousGap=gap;this.nextZ+=gap;return gate;
 }
}
// Bonus pickups have their own identity and position, separate from obstacles.
export interface BonusEnergy {id:number;z:number;surface:number;lane:number;}
export class BonusEnergyStream {
 private rng:()=>number;private seen=-1;private nextAt=0;private id=0;
 constructor(seed:number){this.rng=random(seed^0x454e4552);this.nextAt=3+Math.floor(this.rng()*3);}
 between(previous:Gate,next:Gate):BonusEnergy|undefined {
  if(next.id<=this.seen)return;this.seen=next.id;
  if(next.id<this.nextAt||next.id!==previous.id+1)return;
  // Leave time to enter the safe face, then to reach the next main pickup.
  const start=previous.z+88,end=next.z-64;
  if(end<start)return;
  this.nextAt=next.id+3+Math.floor(this.rng()*3);
  return {id:this.id++,z:start+(end-start)*this.rng(),surface:next.safe,lane:Math.floor(this.rng()*3)-1};
 }
}
export type GameEvent={training?:boolean;enemyId?:number;kind?:import('./config').EnemyKind;rift?:RiftKind;distance?:number;type:'supportUnlocked'|'supportReady'|'supportCalled'|'supportShot'|'supportBlocked'|'supportEnded'|'supportDeparting'|'encounter'|'warp'|'shift'|'denied'|'energy'|'clean'|'hit'|'shield'|'shieldHit'|'shieldExpired'|'health'|'boost'|'stage'|'fail'|'revive'|'goal'|'lane'|'shot'|'weaponJammed'|'heatVent'|'overdrive'|'targetLock'|'guardReady'|'guardBlock'|'siegeReady'|'siegeBeam'|'phaseStart'|'phaseEnd'|'singularityReady'|'singularityOpen'|'singularityAbsorb'|'enemyShot'|'enemyHit'|'kill'|'incoming'|'turboReady'|'riftEnter'|'riftJump'|'riftChallenge'|'riftShift'|'riftComplete'|'riftMiss';value?:number};
export class Race{
 gates:Gate[]=[];stream:CourseStream;z=0;time=0;elapsed=0;surface=0;from=0;angle=0;targetAngle=0;startAngle=0;shiftLeft=0;
 training?:{step:number;limit:number};
 riftCapture?:Rift;
 rifts:Rift[]=[];riftStream:RiftStream;resolvedRifts=new Set<number>();riftTransit?:{rift:Rift;elapsed:number;jumped:boolean;portalZ?:number;portalSurface?:number;portalLane?:number;mode:'enter'|'exit'};riftChallenge?:{rift:Rift;remaining:number;nextCheck:number;targetLane:number};riftBonus=0;riftFlash=0;
 support=new EarthSupport();
 ship:ShipMode;meteors:MeteorField;
 telemetry?: (name:import('./telemetry-core').EventName,params:import('./telemetry-core').Params)=>void;
 get playerHeight(){return 5.2+this.ship.lift*8;}
 combat=new Combat();firing=false;aimX=0;aimY=0;touchAim:{x:number;y:number}|undefined;invulnerable=0;
 private nextWeaponJam=0;
 pressFire(){
  if(this.failed)return;
  this.firing=true;
  if(phaseActive(this))return;
  // Feedback belongs to a deliberate trigger press, never to every simulation
  // tick while held. Cooling and automatic firing after rearming stay intact.
  if(this.combat.locked){
   if(this.elapsed+1e-9>=this.nextWeaponJam){this.nextWeaponJam=this.elapsed+.5;this.events.push({type:'weaponJammed'});}
  }
  else this.combat.requestTap();
 }
 lane=0;laneX=0;laneFrom=0;laneLeft=0;
 health:number=SURVIVAL.maxHealth;shieldTime=0;shieldFlash=0;pickupTaken=new Set<number>();
 charges:number=TUNE.maxCharges;recharge=0;score=0;energy=0;combo=0;bestCombo=0;shield=0;boost=0;boosts=0;shields=0;hits=0;failed=false;revives=0;
 processed=new Set<number>();collected=new Set<number>();bonusCollected=new Set<number>();bonusEnergy:BonusEnergy[]=[];bonusStream:BonusEnergyStream;events:GameEvent[]=[];goals=new Set<string>();goalPoints=0;boostCharge=0;turboEnergy=0;cleared=0;lastStage='earth';

 runnerFlash=0;readonly overdrive=new TurboOverdrive();
 readonly phase=new PhaseDrive();
 readonly bikeTier:number;
 constructor(public seed=2249,bikeTier=0){this.bonusStream=new BonusEnergyStream(seed);this.bikeTier=Number.isInteger(bikeTier)&&bikeTier>=0&&bikeTier<=7?bikeTier:0;this.meteors=new MeteorField(seed);this.ship=new ShipMode(seed);this.stream=new CourseStream(seed,TUNE.boostSpeed+TUNE.boostExtra*OVERDRIVE.maxExtra);this.riftStream=new RiftStream(seed);if(ascentPreviewMode()){this.z=950;this.stream.nextZ=1050;}else if(sfPreviewMode()){this.z=600;this.stream.nextZ=750;}else if(andromedaPreviewMode()){this.z=27000;this.lastStage=this.route.id;this.stream.nextZ=44400;this.riftStream.nextZ=100000;this.ship.nextZ=100000;this.meteors.nextZ=45200;this.goals=new Set(RUN_GOALS.map(g=>g.id));}else if(meteorPreviewMode()){this.z=6000;this.lastStage=this.route.id;this.stream.nextZ=6600;this.riftStream.nextZ=100000;this.meteors.nextZ=6050;}this.ensureCourse();}
 get route():Route{return stageAt(this.z);}get cruise(){return TUNE.speed+(TUNE.maxCruise-TUNE.speed)*Math.min(1,this.z/TUNE.speedRampDistance);}get speed(){if(this.training)return Math.min(this.boost>0?24:14,Math.max(0,(this.training.limit-this.z)*2));if(this.ship.active)return this.cruise*(1+.35*this.ship.lift);return Math.min(TUNE.boostSpeed,this.cruise+(this.boost>0?TUNE.boostExtra:0))+(this.boost>0&&overdriveEnabled(this)?TUNE.boostExtra*this.overdrive.earned:0);}get multiplier(){const base=this.combo>=TUNE.combo3?3:this.combo>=TUNE.combo2?2:1;return this.riftBonus>0?Math.max(2,base):base;}
 ensureCourse(){if(this.training)return;while(this.riftStream.nextZ<this.z+TUNE.streamAhead)this.rifts.push(this.riftStream.next());while(this.stream.nextZ<this.z+TUNE.streamAhead)this.gates.push(this.stream.next());this.gates=this.gates.filter(g=>!this.rifts.some(r=>!this.resolvedRifts.has(r.id)&&g.z>r.z-105&&g.z<r.z+125));for(let i=1;i<this.gates.length;i++){const b=this.bonusStream.between(this.gates[i-1],this.gates[i]);if(b)this.bonusEnergy.push(b);}this.bonusEnergy=this.bonusEnergy.filter(b=>{const keep=b.z>=this.z-TUNE.retainBehind&&!this.rifts.some(r=>!this.resolvedRifts.has(r.id)&&b.z>r.z-105&&b.z<r.z+125);if(!keep)this.bonusCollected.delete(b.id);return keep;});while(this.gates.length&&this.gates[0].z<this.z-TUNE.retainBehind){const old=this.gates.shift()!;this.processed.delete(old.id);this.collected.delete(old.id);this.pickupTaken.delete(old.id);}while(this.rifts.length&&this.rifts[0].z<this.z-TUNE.retainBehind){this.resolvedRifts.delete(this.rifts.shift()!.id);}}
 endTraining(){this.training=undefined;this.bonusStream=new BonusEnergyStream(this.seed);this.bonusEnergy=[];this.bonusCollected.clear();this.combat.heat=0;this.combat.locked=false;this.combat.cooldown=0;this.combat.clearTransit();for(const e of this.combat.enemies)e.training=false;this.stream=new CourseStream(this.seed,TUNE.boostSpeed+TUNE.boostExtra*OVERDRIVE.maxExtra);this.stream.nextZ=this.z+220;this.ensureCourse();this.invulnerable=Math.max(this.invulnerable,2);}
 captureSuction(){if(!this.riftCapture&&!this.riftTransit){const rift=suctionRift(this);if(rift){this.riftCapture=rift;this.laneFrom=this.laneX;this.lane=rift.lane;this.laneLeft=TUNE.laneDuration;}}return !!this.riftCapture;}
 shift(direction:number){if(this.failed||this.riftTransit||this.captureSuction()||this.shiftLeft>0||![-1,1].includes(direction))return false;if(this.charges<1){this.events.push({type:'denied'});return false;}this.charges--;this.from=this.surface;this.surface=wrap(this.surface+direction);this.startAngle=this.angle;this.targetAngle+=direction*Math.PI/2;this.shiftLeft=TUNE.shiftDuration;this.events.push({type:'shift'});return true;}
 changeLane(direction:number){if(this.failed||this.riftTransit||this.captureSuction()||this.laneLeft>0||this.shiftLeft>0||![-1,1].includes(direction))return false;const target=this.lane+direction;if(Math.abs(target)>1){if(!this.shift(direction))return false;this.laneFrom=this.laneX;this.lane=-direction;this.laneLeft=TUNE.shiftDuration;}else{this.laneFrom=this.laneX;this.lane=target;this.laneLeft=TUNE.laneDuration;}this.events.push({type:'lane'});return true;}

 singularityAvailable(){return !!singularityEnabled(this)&&this.combat.singularity.ready;}
 activateSingularity(){if(!this.singularityAvailable()||this.captureSuction())return false;return this.combat.singularity.start();}
 activateTurbo(){if(this.failed||this.riftTransit||this.captureSuction()||this.ship.active||this.boost>0||!this.boostCharge)return false;this.boostCharge=0;this.turboEnergy=0;this.boost=TUNE.boostDuration;this.overdrive.reset();this.events.push({type:'boost'});if(phantomEnabled(this)){this.phase.start();this.combat.tapShot=undefined;this.events.push({type:'phaseStart'});}return true;}
 clearRiftLanding(ambush=false){this.ensureCourse();this.gates=this.gates.filter(g=>g.z>this.z+150);this.processed.clear();this.collected.clear();this.bonusEnergy=this.bonusEnergy.filter(b=>b.z>this.z+150);this.bonusCollected.clear();this.pickupTaken.clear();this.combat.clearTransit();if(ambush&&this.gates[0])this.gates[0].wave=true;}
  damage(source='unknown',sourceDetail='unknown',enemyId?:number,amount=1){if(this.training||marketingCaptureMode()||this.failed||this.invulnerable>0||phaseBlocks(this,source))return;const healthBefore=this.health,shieldBefore=this.shield;this.combo=0;this.invulnerable=SURVIVAL.hitRecovery;if(this.support.absorb()){this.events.push({type:'supportBlocked'});}else if(this.shield>0){this.shield--;this.shieldFlash=.35;if(this.shield===0)this.shieldTime=0;this.events.push({type:'shieldHit',value:this.shield});}else{this.hits++;this.health=Math.max(0,this.health-Math.max(1,Math.min(3,Math.floor(amount))));this.events.push({type:'hit',value:this.health});if(this.health===0){this.failed=true;this.firing=false;this.combat.tapShot=undefined;this.events.push({type:'fail'});}}this.telemetry?.('damage_taken',{source,source_detail:sourceDetail,...(enemyId===undefined?{}:{enemy_id:enemyId}),health_before:healthBefore,health_after:this.health,shield_before:shieldBefore,shield_after:this.shield});}
 revive(){if(!this.failed||this.revives>=SURVIVAL.maxRevives)return false;this.failed=false;this.phase.cancel();this.support.cancel();this.revives++;this.health=SURVIVAL.reviveHealth;this.shield=SURVIVAL.reviveShield;this.shieldTime=SURVIVAL.reviveGrace;this.shieldFlash=.65;this.invulnerable=SURVIVAL.reviveGrace;this.combo=0;this.firing=false;this.combat.tapShot=undefined;this.riftTransit=undefined;this.riftCapture=undefined;this.riftChallenge=undefined;this.gates=this.gates.filter(g=>g.z>this.z+SURVIVAL.reviveClearance);this.processed.clear();this.collected.clear();this.bonusEnergy=this.bonusEnergy.filter(b=>b.z>this.z+SURVIVAL.reviveClearance);this.bonusCollected.clear();this.pickupTaken.clear();this.combat.clearTransit();this.meteors.clear();this.ensureCourse();this.events.push({type:'revive',value:this.health});return true;}
 private collectEnergy(){this.energy++;this.score+=TUNE.energyPoints*this.multiplier;this.events.push({type:'energy',value:TUNE.energyPoints*this.multiplier});if(overdriveEnabled(this)){const before=this.overdrive.extended,extra=this.overdrive.collect(this.boost);this.boost+=this.overdrive.extended-before;if(extra>0)this.events.push({type:'overdrive',value:extra});}if(this.combat.vanguard.collect(vanguardEnabled(this)))this.events.push({type:'guardReady'});if(this.combat.titan.collect(!!titanEnabled(this)))this.events.push({type:'siegeReady'});if(this.combat.singularity.collect(!!singularityEnabled(this)))this.events.push({type:'singularityReady'});this.chargeTurbo(1);}
 private chargeTurbo(amount:number){if(this.boostCharge)return 0;const before=this.turboEnergy;this.turboEnergy=Math.min(TUNE.energyForTurbo,this.turboEnergy+amount);if(this.turboEnergy===TUNE.energyForTurbo){this.boostCharge=1;this.boosts++;this.events.push({type:'turboReady'});}return this.turboEnergy-before;}

 collectPickup(g:Gate){if(!g.pickup||this.pickupTaken.has(g.id)||this.failed)return;const healthBefore=this.health,shieldBefore=this.shield;this.pickupTaken.add(g.id);if(g.pickup.kind==='shield'){this.shield=SURVIVAL.shieldHits;this.shieldTime=SURVIVAL.shieldDuration;this.shieldFlash=.2;this.shields++;this.events.push({type:'shield',value:this.shield});}else{const before=this.health;this.health=Math.min(SURVIVAL.maxHealth,this.health+SURVIVAL.heal);this.events.push({type:'health',value:this.health-before});}this.telemetry?.('pickup_resolved',{pickup_id:String(g.id),pickup_kind:g.pickup.kind,outcome:'collected',health_before:healthBefore,health_after:this.health,amount:g.pickup.kind==='health'?this.health-healthBefore:this.shield-shieldBefore});}
 step(dt:number){
  if(this.failed)return;if(this.combat.singularity.update(dt,!!singularityEnabled(this)))this.events.push({type:'singularityReady'});if(this.phase.update(dt,!!phantomEnabled(this)&&this.boost>0))this.events.push({type:'phaseEnd'});if(this.combat.titan.update(dt,!!titanEnabled(this)))this.events.push({type:'siegeReady'});this.overdrive.update(dt);this.runnerFlash=Math.max(0,this.runnerFlash-dt);if(this.combat.vanguard.update(dt,vanguardEnabled(this)))this.events.push({type:'guardReady'});const previousPose={z:this.z,angle:this.angle,laneX:this.laneX,time:this.time};this.shieldFlash=Math.max(0,this.shieldFlash-dt);this.riftBonus=Math.max(0,this.riftBonus-dt);this.riftFlash=Math.max(0,this.riftFlash-dt);if(this.shield>0&&this.shieldTime>0){this.shieldTime=Math.max(0,this.shieldTime-dt);if(this.shieldTime===0){this.shield=0;this.events.push({type:'shieldExpired'});}}this.invulnerable=Math.max(0,this.invulnerable-dt);this.time+=dt;this.elapsed+=dt;
  this.support.step(this,dt);
  if(this.riftTransit){const transit=this.riftTransit;transit.elapsed+=dt;if(transit.mode==='enter'&&this.laneLeft>0){this.laneLeft=Math.max(0,this.laneLeft-dt);const t=1-this.laneLeft/TUNE.laneDuration;this.laneX=this.laneFrom+(this.lane-this.laneFrom)*t*t*(3-2*t);}this.z+=this.speed*dt;this.boost=Math.max(0,this.boost-dt);if(this.boost<1e-8){this.boost=0;this.overdrive.reset();}this.ensureCourse();this.riftFlash=Math.max(this.riftFlash,1.8-transit.elapsed);if(transit.mode==='enter'&&transit.elapsed<.82)this.combat.update(this,dt);else this.combat.clearTransit();if(!transit.jumped&&transit.elapsed>=.82){transit.jumped=true;this.z+=transit.rift.jump;transit.portalZ=this.z+9;this.clearRiftLanding(transit.rift.kind==='violet');this.events.push({type:'riftJump',rift:transit.rift.kind,distance:transit.rift.jump});}if(transit.elapsed>=1.8){this.riftTransit=undefined;{this.score+=transit.rift.points;if(transit.rift.kind==='violet')this.riftBonus=6;if(transit.rift.kind==='black')this.riftBonus=8;this.events.push({type:'riftComplete',rift:transit.rift.kind,value:transit.rift.points,distance:transit.rift.jump});}}return;}
  this.captureSuction();
  if(this.charges<TUNE.maxCharges){this.recharge+=dt;while(this.recharge>=TUNE.recharge&&this.charges<TUNE.maxCharges){this.recharge-=TUNE.recharge;this.charges++;}}else this.recharge=0;
  if(this.laneLeft>0){this.laneLeft=Math.max(0,this.laneLeft-dt);const t=1-this.laneLeft/(this.shiftLeft>0?TUNE.shiftDuration:TUNE.laneDuration);this.laneX=this.laneFrom+(this.lane-this.laneFrom)*t*t*(3-2*t);}
  if(this.shiftLeft>0){this.shiftLeft=Math.max(0,this.shiftLeft-dt);const t=1-this.shiftLeft/TUNE.shiftDuration;this.angle=this.startAngle+(this.targetAngle-this.startAngle)*t*t*(3-2*t);}
  this.boost=Math.max(0,this.boost-dt);if(this.boost<1e-8){this.boost=0;this.overdrive.reset();}let prev=this.z;this.z+=this.speed*dt;this.ensureCourse();if(!this.training)this.ship.step(this,dt,prev);this.captureSuction();
  if(!this.ship.active)for(const rift of this.rifts){if(this.resolvedRifts.has(rift.id)||prev>rift.z+8||rift.z-this.z>this.speed*.82+9)continue;const entered=this.riftCapture?.id===rift.id||(this.surface===rift.surface&&this.shiftLeft===0&&Math.abs(this.laneX-rift.lane)<.48);if(!entered&&this.z<rift.z)continue;this.resolvedRifts.add(rift.id);if(!entered){this.events.push({type:'riftMiss',rift:rift.kind});break;}this.riftFlash=1.8;this.riftTransit={rift,elapsed:Math.max(0,Math.min(.81,.82-Math.max(0,rift.z-this.z-9)/this.speed)),jumped:false,portalZ:rift.z,portalSurface:rift.surface,portalLane:rift.lane,mode:'enter'};this.riftCapture=undefined;this.events.push({type:'riftEnter',rift:rift.kind,distance:rift.jump});this.combat.beginTransit();this.combat.update(this,dt);this.meteors.clear();return;}
  if(!this.training)this.meteors.step(this,dt,prev);if(this.failed)return;
  this.combat.update(this,dt);if(this.failed)return;
  if(this.lastStage!==this.route.id){this.lastStage=this.route.id;this.events.push({type:'stage'});}
  const currentPose={z:this.z,angle:this.angle,laneX:this.laneX,time:this.time};
  if(!this.ship.active&&!this.training)for(const b of this.bonusEnergy){if(!this.bonusCollected.has(b.id)&&prev<b.z&&this.z>=b.z&&this.surface===b.surface&&this.shiftLeft===0&&Math.abs(this.laneX-b.lane)<.3){this.bonusCollected.add(b.id);this.collectEnergy();}}
  for(const g of this.gates){
   if(this.ship.active){if(g.z<this.z)this.processed.add(g.id);continue;}
   const pickupZ=g.z+SURVIVAL.pickupOffset;if(g.pickup&&!this.pickupTaken.has(g.id)&&prev<pickupZ&&this.z>=pickupZ&&this.surface===g.safe&&this.shiftLeft===0&&Math.abs(this.laneX-g.pickup.lane)<SURVIVAL.pickupReach)this.collectPickup(g);
   if(g.pickup&&!this.pickupTaken.has(g.id)&&prev<pickupZ&&this.z>=pickupZ){this.pickupTaken.add(g.id);this.telemetry?.('pickup_resolved',{pickup_id:String(g.id),pickup_kind:g.pickup.kind,outcome:'missed',health_before:this.health,health_after:this.health,amount:0});}
   if(g.z<prev-8||g.z>this.z+18)continue;
   if(!this.collected.has(g.id)&&prev<g.z-12&&this.z>=g.z-12&&this.surface===g.safe&&this.shiftLeft===0&&Math.abs(this.laneX-(g.energyLane??0))<.3){this.collected.add(g.id);this.collectEnergy();}

   if(!this.processed.has(g.id)&&this.z>=g.z-gateContactReach(g)&&prev<=g.z+gateContactReach(g)){
    if(obstacleContact(g,previousPose,currentPose)){this.processed.add(g.id);this.damage('obstacle',g.kind);if(this.failed)return;}
   }
   if(this.z>g.z+gateContactReach(g)&&!this.processed.has(g.id)){
    this.processed.add(g.id);this.combo++;this.cleared++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.score+=TUNE.gatePoints*this.multiplier;this.events.push({type:'clean'});if(runnerEnabled(this)&&this.chargeTurbo(RUNNER.perPass)>0)this.runnerFlash=RUNNER.flashDuration;

   }
  }
  for(let i=0;i<RUN_GOALS.length;i++){const goal=RUN_GOALS[i];if(!this.goals.has(goal.id)&&this[goal.stat]>=goal.target){this.goals.add(goal.id);this.goalPoints+=goal.points;this.score+=goal.points;this.events.push({type:'goal',value:i});}}
 }
}
