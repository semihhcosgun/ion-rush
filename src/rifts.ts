import {BODIES} from './config';

export type RiftKind='blue'|'violet'|'black';
export interface Rift{id:number;z:number;kind:RiftKind;surface:number;lane:number;jump:number;points:number;}

const CLEARANCE=700;
const landmarks=BODIES.map(body=>body.passAt);
function clearLandmarks(value:number,roll:()=>number){
 let z=value;
 for(let pass=0;pass<landmarks.length;pass++){
  const conflict=landmarks.find(mark=>Math.abs(z-mark)<CLEARANCE);
  if(conflict===undefined)break;
  const before=conflict-CLEARANCE-roll()*240,after=conflict+CLEARANCE+roll()*240;
  z=Math.abs(value-before)<Math.abs(value-after)?before:after;
 }
 return Math.round(z/8)*8;
}

function mix(seed:number){let x=seed|0;return()=>{x=x+0x6D2B79F5|0;let t=Math.imul(x^x>>>15,1|x);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/** Deterministic optional encounters. Distances, rarity and dry-spell protection live here. */
export class RiftStream{
 private rng:()=>number;private id=0;private lastBlack=-Infinity;nextZ:number;
 constructor(seed:number){this.rng=mix(seed^0x52494654);this.nextZ=Math.round((6800+this.rng()*400)/8)*8;}
 next():Rift{
  const z=this.nextZ,roll=this.rng();let kind:RiftKind='blue';
  if(this.id>0){
   if(z<12000)kind='blue';
   else if(z<20000)kind=roll<.3?'violet':'blue';
   else if(z<28000)kind=roll<.5?'violet':'blue';
   else if(z<42000)kind=roll<.1?'black':roll<.65?'violet':'blue';
   else if(z<50000)kind=roll<.2?'black':roll<.8?'violet':'blue';
   else kind=roll<.3?'black':roll<.8?'violet':'blue';
  }
  if(kind==='black'&&z-this.lastBlack<8000)kind='violet';
  if(kind==='black')this.lastBlack=z;
  const jump=kind==='blue'?500+Math.round(this.rng()*300):kind==='violet'?900+Math.round(this.rng()*500):1500+Math.round(this.rng()*1000);
  const points=kind==='blue'?400:kind==='violet'?900:2000;
  const rift={id:this.id++,z,kind,surface:Math.floor(this.rng()*4),lane:Math.floor(this.rng()*3)-1,jump,points};
  const [min,max]=z<12000?[4000,6000]:z<20000?[4000,5000]:z<28000?[3500,5000]:z<50000?[4000,6000]:[3000,5000];
  this.nextZ=clearLandmarks(z+min+this.rng()*(max-min),this.rng);
  return rift;
 }
}

/** Shared boundary for visible suction and irreversible capture. */
export function suctionRift(race:{speed:number;z:number;surface:number;laneX:number;shiftLeft:number;rifts:Rift[];resolvedRifts:Set<number>;ship:{active:boolean};riftChallenge?:unknown}){
 if(race.ship.active||race.riftChallenge||race.shiftLeft>0)return undefined;
 return race.rifts.find(r=>!race.resolvedRifts.has(r.id)&&r.surface===race.surface&&r.z>=race.z&&r.z-race.z<race.speed*.82+81&&Math.abs(race.laneX-r.lane)<1);
}
