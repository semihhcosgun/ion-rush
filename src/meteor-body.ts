import * as THREE from 'three';

/** Asymmetric, pitted body with broad broken facets rather than a spiky sphere. */
export function meteorBodyGeometry(){
 const geo=new THREE.SphereGeometry(1,48,32),p=geo.attributes.position;
 const pits=Array.from({length:11},(_,i)=>{const a=i*2.399,y=1-2*(i+.5)/11,r=Math.sqrt(1-y*y);return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);});
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  let radius=1+.12*Math.sin(x*3.1+y*2.7)+.1*Math.cos(z*4.3-x*2)+.035*Math.sin(x*19+y*13+z*17);
  for(let j=0;j<pits.length;j++){const c=pits[j],d=Math.hypot(x-c.x,y-c.y,z-c.z),width=.19+(j%3)*.065;radius-=.14*Math.exp(-d*d/(width*width));radius+=.035*Math.exp(-(((d-width)*18)**2));}
  p.setXYZ(i,x*radius*1.26,y*radius*.96,z*radius*1.1);
 }
 geo.computeVertexNormals();return geo;
}

/** Tail extends from the trailing hemisphere and narrows into turbulent filaments. */
export function meteorWakeGeometry(){
 const points=Array.from({length:25},(_,i)=>{const t=i/24;return new THREE.Vector2((.05+.75*Math.pow(1-t,1.25))*Math.sin(Math.min(1,t*12+.12)*Math.PI/2),t*7);});
 return new THREE.LatheGeometry(points,24);
}
