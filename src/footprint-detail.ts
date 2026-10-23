import {Vector2,ShapeUtils} from 'three';

/** Bounded outline error in survey metres, before the skyline's 0.3 scale. */
export function simplifyFootprint(input:Vector2[],tolerance=1.5):Vector2[]{
 const points=input.slice();if(points.length>1&&points[0].distanceToSquared(points.at(-1)!)<1e-12)points.pop();
 if(points.length<5)return points;
 const distance=(p:Vector2,a:Vector2,b:Vector2)=>{
  const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len)):0;
  return (p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2;
 };
 const simplify=(part:Vector2[]):Vector2[]=>{
  let max=tolerance*tolerance,index=-1;
  for(let i=1;i<part.length-1;i++){const d=distance(part[i],part[0],part.at(-1)!);if(d>max){max=d;index=i;}}
  return index<0?[part[0],part.at(-1)!]:[...simplify(part.slice(0,index+1)).slice(0,-1),...simplify(part.slice(index))];
 };
 let split=1;for(let i=2;i<points.length;i++)if(points[i].distanceToSquared(points[0])>points[split].distanceToSquared(points[0]))split=i;
 const result=[...simplify(points.slice(0,split+1)).slice(0,-1),...simplify([...points.slice(split),points[0]]).slice(0,-1)];
 if(result.length<3||ShapeUtils.area(result)*ShapeUtils.area(points)<=0)return points;
 // Do not introduce crossings in concave footprints.
 const cross=(a:Vector2,b:Vector2,c:Vector2)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 for(let i=0;i<result.length;i++)for(let j=i+2;j<result.length;j++){
  if(i===0&&j===result.length-1)continue;
  const a=result[i],b=result[(i+1)%result.length],c=result[j],d=result[(j+1)%result.length];
  if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return points;
 }
 return result;
}
