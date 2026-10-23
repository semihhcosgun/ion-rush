import {FLIGHT,ENEMY_TYPES,ENEMY_ENTRY,PURSUIT} from './config';
import {updateDefense,defenseProfile} from './enemy-defense';
import type {Enemy} from './combat';import type {Race} from './game';
export interface FlightState{orbit:number;orbitVelocity:number;orbitTarget:number;followedSurface:number;nextDecision:number;decisions:number;lane:number;laneVelocity:number;height:number;heightVelocity:number;gap:number;gapVelocity:number;phase:number;frequency:number;flank:number;bank:number;pitch:number;yaw:number;mode:'hover'|'attack'|'recover';modeStart:number;modeEnd:number;sorties:number;side:number;anchorLane:number;anchorHeight:number;anchorGap:number;}
function noise(seed:number,id:number,salt:number){let n=(seed^Math.imul(id+1,0x45d9f3b)^Math.imul(salt+1,0x27d4eb2d))|0;n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;}
const clamp=(v:number,limit:number)=>Math.max(-limit,Math.min(limit,v));
function spring(value:number,velocity:number,target:number,stiffness:number,speed:number,acceleration:number,dt:number){velocity+=clamp((target-value)*stiffness-2*Math.sqrt(stiffness)*velocity,acceleration)*dt;velocity=clamp(velocity,speed);return {value:value+velocity*dt,velocity};}
export function updateFlight(e:Enemy,r:Race,dt:number){
 const profile=ENEMY_TYPES[e.kind];
 if(!e.motion)e.defense=undefined;
 const rand=(salt:number)=>noise(r.seed,e.id,salt),baseHeight=e.flight==='high'?22:e.flight==='level'?7:15,baseLane=e.flight==='upperLeft'?-3:e.flight==='upperRight'?3:0;
 if(!e.motion)e.motion={orbit:e.visualSurface,orbitVelocity:0,orbitTarget:e.visualSurface,followedSurface:e.surface,nextDecision:e.age+(FLIGHT.reactionMin+rand(1)*FLIGHT.reactionSpread)/(1+(profile.rank-1)*.07),decisions:0,lane:e.warpLane??e.lane+baseLane,laneVelocity:0,height:e.warpHeight??baseHeight,heightVelocity:0,gap:Math.max(30,e.z-r.z),gapVelocity:0,phase:rand(2)*Math.PI*2,frequency:.38+rand(3)*.45,flank:(rand(4)-.5)*.3,bank:0,pitch:0,yaw:0,mode:'hover',modeStart:e.age,modeEnd:Math.max(e.age,ENEMY_ENTRY)+(FLIGHT.hoverMin+rand(20)*FLIGHT.hoverSpread)*profile.hover,sorties:0,side:rand(21)<.5?-1:1,anchorLane:baseLane,anchorHeight:baseHeight,anchorGap:PURSUIT.distance+(rand(6)-.5)*18};
 const m=e.motion;
 if(e.age>=m.nextDecision){m.followedSurface=r.surface;const target=r.surface+m.flank;const delta=((target-m.orbit+6)%4+4)%4-2;m.orbitTarget=m.orbit+delta;m.decisions++;m.nextDecision=e.age+(FLIGHT.decisionMin+rand(10+m.decisions)*FLIGHT.decisionSpread)/(1+(profile.rank-1)*.07);}
 // Commit to a maneuver instead of resampling a player-relative formation every frame.
 if(e.age>=m.modeEnd){
  m.modeStart=e.age;
  if(m.mode==='hover'){m.mode='attack';m.sorties++;m.side=rand(30+m.sorties)<.5?-1:1;m.modeEnd=e.age+(e.kind==='manta'?FLIGHT.arcDuration:FLIGHT.dartDuration)+rand(60+m.sorties)*.6;}
  else if(m.mode==='attack'){m.mode='recover';m.modeEnd=e.age+FLIGHT.recoverDuration;}
  else{m.mode='hover';m.anchorLane=baseLane+(rand(90+m.sorties)-.5)*4;m.anchorHeight=baseHeight+(rand(120+m.sorties)-.5)*3;m.anchorGap=PURSUIT.distance+(rand(150+m.sorties)-.5)*18;m.modeEnd=e.age+(FLIGHT.hoverMin+rand(180+m.sorties)*FLIGHT.hoverSpread)*profile.hover;}
 }
 const t=e.age*m.frequency+m.phase,u=Math.min(1,(e.age-m.modeStart)/(m.modeEnd-m.modeStart));
 let laneTarget=m.anchorLane+Math.sin(t*1.7)*.22,heightTarget=m.anchorHeight+Math.sin(t)*.3,gapTarget=m.anchorGap;
 let stiffness:number=FLIGHT.hoverStiffness;
 if(m.mode==='attack'){
  if(profile.rank>=8){laneTarget+=Math.sin(u*Math.PI*2)*4;heightTarget+=Math.sin(u*Math.PI)*7;gapTarget-=Math.sin(u*Math.PI)*9;stiffness=7;}
  else if(e.kind==='prism'){laneTarget+=m.side*Math.sin(u*Math.PI)*7;heightTarget+=Math.sin(u*Math.PI*2)*3;gapTarget-=Math.sin(u*Math.PI)*10;stiffness=7;}
  else if(e.kind==='revenant'){laneTarget+=m.side*Math.sin(u*Math.PI)*8;heightTarget+=Math.sin(u*Math.PI*2)*5;gapTarget-=Math.sin(u*Math.PI)*15;stiffness=8;}
  else if(e.kind==='sentinel'){laneTarget+=Math.sin(u*Math.PI*2)*6;heightTarget+=Math.sin(u*Math.PI)*4;gapTarget-=Math.sin(u*Math.PI)*12;stiffness=9;}
  else if(e.kind==='wraith'){laneTarget+=m.side*Math.sin(u*Math.PI)*6;heightTarget+=Math.sin(u*Math.PI*2)*4;gapTarget-=Math.sin(u*Math.PI)*16;stiffness=8;}
  else if(e.kind==='manta'){const arc=Math.sin(u*Math.PI);laneTarget+=m.side*FLIGHT.arcWidth*arc;heightTarget-=Math.sin(u*Math.PI)*Math.min(8,baseHeight-6);gapTarget-=FLIGHT.approach*arc;stiffness=5;}
  else if(e.kind==='saucer'){laneTarget+=m.side*FLIGHT.dartWidth;heightTarget+=u<.45?4:-2;gapTarget-=FLIGHT.approach*.6;stiffness=FLIGHT.dartStiffness;}
  else{laneTarget+=m.side*FLIGHT.dartWidth*.7;heightTarget-=Math.min(3,baseHeight-6);gapTarget-=FLIGHT.approach;stiffness=FLIGHT.dartStiffness;}
 }else if(m.mode==='recover'){laneTarget-=m.side*2;heightTarget+=3;gapTarget+=FLIGHT.retreat;stiffness=5;}

 laneTarget=m.anchorLane+(laneTarget-m.anchorLane)*profile.mobility;
 updateDefense(e,r,dt);
 if(e.defense&&e.defense.remaining>0){const defense=defenseProfile(profile.rank,r.z),pulse=Math.sin(Math.PI*(1-e.defense.remaining/defense.duration));laneTarget+=e.defense.side*defense.width*pulse;heightTarget+=pulse*(profile.rank>=6?2:0.5);stiffness=Math.max(stiffness,18);}
 const orbit=spring(m.orbit,m.orbitVelocity,m.orbitTarget,3+rand(7)*2,FLIGHT.turnSpeed*(.75+rand(8)*.4)*profile.mobility,FLIGHT.turnAcceleration*profile.mobility,dt);m.orbit=orbit.value;m.orbitVelocity=orbit.velocity;
 const lane=spring(m.lane,m.laneVelocity,laneTarget,stiffness,FLIGHT.laneSpeed*profile.mobility,FLIGHT.laneAcceleration*profile.mobility,dt);m.lane=lane.value;m.laneVelocity=lane.velocity;
 const height=spring(m.height,m.heightVelocity,heightTarget,stiffness,FLIGHT.heightSpeed*profile.mobility,28*profile.mobility,dt);m.height=height.value;m.heightVelocity=height.velocity;
 const gap=spring(m.gap,m.gapVelocity,gapTarget,stiffness,FLIGHT.gapSpeed,55,dt);m.gap=Math.max(28,gap.value);m.gapVelocity=m.gap===28?Math.max(0,gap.velocity):gap.velocity;
 const bankScale=e.kind==='saucer'?.045:.1;
 m.bank+=(-clamp(m.orbitVelocity*.6+m.laneVelocity*bankScale,.65)-m.bank)*(1-Math.exp(-5*dt));m.pitch+=(clamp(m.heightVelocity*.025-m.gapVelocity*.012,.32)-m.pitch)*(1-Math.exp(-4*dt));m.yaw+=(clamp(m.laneVelocity*.07,.4)-m.yaw)*(1-Math.exp(-4*dt));
 e.visualSurface=m.orbit;e.z=r.z+m.gap;
}
