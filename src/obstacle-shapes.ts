/** Physical dimensions and animation shared by the renderer and collision checks. */
export const OBSTACLE = Object.freeze({
  barrier: {width:6.1,height:1.5,depth:.9,y:4.85,narrowScale:.3},
  block: {width:2.7,height:1.5,depth:1.5,y:4.85,travel:3.6},
  arm: {pivotX:-3.2,pivotY:4.45,length:6.4,height:.28,depth:.35},
  shutter: {width:6.5,height:1.9,depth:.65,y:5.1,lift:4,rate:1.7,openAt:-.2,closedAt:.4,postHeight:6},
  laser: {width:6.5,height:.09,depth:.16,y:4.6,spacing:.65},
  mines: {x:2.2,y:4.6,radius:.65},
  gap: {width:7.85,depth:8.12},
});

export const RIDER = Object.freeze({scale:1.28,surfaceRadius:4.2});
export function riderRadius(angle:number){return RIDER.surfaceRadius/Math.max(Math.abs(Math.sin(angle)),Math.abs(Math.cos(angle)));}
export function laserActive(time:number,phase:number){return Math.sin(time*2.1+phase)>-.35;}
export function blockPosition(time:number,phase:number){return Math.sin(time*1.4+phase)*OBSTACLE.block.travel;}
export function armAngle(time:number,phase:number){return Math.abs(Math.sin(time*1.8+phase))*1.3;}
export function shutterPosition(time:number,phase:number){
  const s=OBSTACLE.shutter;
  // Hold a readable opening with clearance above NOVA's helmet. Rendering and
  // collision use this same position throughout opening and closing.
  const t=Math.max(0,Math.min(1,(Math.sin(time*s.rate+phase)-s.openAt)/(s.closedAt-s.openAt)));
  return s.y+(1-t*t*(3-2*t))*s.lift;
}
