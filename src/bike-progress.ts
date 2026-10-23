export const BIKE_TIERS = [
 {name:'Rookie',model:'VESPER–07',xp:0,distance:0,color:'#f0774c'},
 {name:'Ignition',model:'VESPER / IGNITION',xp:120,distance:500,color:'#ffb35c'},
 {name:'Runner',model:'VESPER / RUNNER',xp:450,distance:1500,color:'#67e6c5'},
 {name:'Hunter',model:'VESPER / HUNTER',xp:1100,distance:3500,color:'#78c8ff'},
 {name:'Vanguard',model:'VESPER / VANGUARD',xp:2400,distance:7000,color:'#a29aff'},
 {name:'Titan',model:'VESPER / TITAN',xp:5000,distance:14000,color:'#f6cd79'},
 {name:'Phantom',model:'VESPER / PHANTOM',xp:9000,distance:26000,color:'#ef8cdd'},
 {name:'Event Horizon',model:'VESPER / EVENT HORIZON',xp:15000,distance:50000,color:'#ffc086'},
] as const;
export interface BikeProgress {version:1;distance:number;kills:number;cleared:number;legacyXp:number;best:number;unlocked:number;selected:number;celebrated:number}
type Legacy={journey?:{distance?:number;energy?:number};alienLog?:Partial<Record<string,{kills:number}>>;eventHorizonUnlocked?:boolean;livery?:string};
const count=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?Math.min(1e12,Math.max(0,Math.floor(v))):0;
const tier=(v:unknown)=>Math.min(7,count(v));
export const masteryXp=(p:BikeProgress)=>Math.floor(p.distance/10)+p.kills*25+p.cleared*3+p.legacyXp;
// Preserve the original 50 km Event Horizon achievement as a distance-only final rank.
export function earnedTier(p:BikeProgress){let result=0;for(let i=1;i<BIKE_TIERS.length;i++)if((i===7||masteryXp(p)>=BIKE_TIERS[i].xp)&&p.best>=BIKE_TIERS[i].distance)result=i;return result;}
/** Old records grant a one-time credit. Never reinterpret a best run as total distance. */
export function cleanBikeProgress(value:unknown,legacy:Legacy={}):BikeProgress{
 const raw=value&&typeof value==='object'?value as Partial<BikeProgress>:undefined;
 const best=count(legacy.journey?.distance);
 if(!raw||raw.version!==1){
  const reached=BIKE_TIERS.reduce((level,t,i)=>best>=t.distance?i:level,0);
  const oldHorizon=legacy.eventHorizonUnlocked===true||best>=50000;
  const credit=Math.max(BIKE_TIERS[reached].xp,Math.floor(best/10)+(count(legacy.journey?.energy)*2)+Object.values(legacy.alienLog??{}).reduce((sum,v)=>sum+count(v?.kills)*25,0));
  const unlocked=oldHorizon?7:reached;
  return {version:1,distance:0,kills:0,cleared:0,legacyXp:credit,best,unlocked,selected:legacy.livery==='event-horizon'&&oldHorizon?7:unlocked,celebrated:unlocked};
 }
 const p:BikeProgress={version:1,distance:count(raw.distance),kills:count(raw.kills),cleared:count(raw.cleared),legacyXp:count(raw.legacyXp),best:Math.max(best,count(raw.best)),unlocked:tier(raw.unlocked),selected:tier(raw.selected),celebrated:tier(raw.celebrated)};
 p.unlocked=Math.max(p.unlocked,earnedTier(p),legacy.eventHorizonUnlocked===true?7:0);p.selected=Math.min(p.selected,p.unlocked);p.celebrated=Math.min(p.celebrated,p.unlocked);return p;
}
export interface RideSnapshot {z:number;cleared:number;combat:{kills:number}}
/** Cursors survive pause/revive in memory. Repeated snapshots cannot mint XP. */
export class BikeProgressTracker {
 private cursors=new WeakMap<object,{z:number;kills:number;cleared:number}>();
 start(run:RideSnapshot){this.cursors.set(run,{z:count(run.z),kills:count(run.combat.kills),cleared:count(run.cleared)});}
 record(p:BikeProgress,run:RideSnapshot){
  const before=this.cursors.get(run)??{z:0,kills:0,cleared:0};
  const next={z:Math.max(before.z,count(run.z)),kills:Math.max(before.kills,count(run.combat.kills)),cleared:Math.max(before.cleared,count(run.cleared))};
  p.distance+=next.z-before.z;p.kills+=next.kills-before.kills;p.cleared+=next.cleared-before.cleared;p.best=Math.max(p.best,next.z);this.cursors.set(run,next);
  const previous=p.unlocked;p.unlocked=Math.max(previous,earnedTier(p));
  // Keep the rider's chosen older model unless they were using their newest one.
  if(p.unlocked>previous&&p.selected===previous)p.selected=p.unlocked;
  return {unlocked:p.unlocked>previous,changed:next.z!==before.z||next.kills!==before.kills||next.cleared!==before.cleared};
 }
}
