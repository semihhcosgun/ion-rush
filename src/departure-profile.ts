export const ASCENT_START=1070;
export const ASCENT_END=2600;
export const ORBIT_HEIGHT=650;
function smooth(z:number,a:number,b:number){const t=Math.max(0,Math.min(1,(z-a)/(b-a)));return t*t*(3-2*t);}
/** Actual world-space climb shared by the road, bike, camera and obstacles. */
export function ascentAt(z:number){
 const t=Math.max(0,Math.min(1,(z-ASCENT_START)/(ASCENT_END-ASCENT_START)));
 return {height:18+(ORBIT_HEIGHT-18)*t*t*(3-2*t),slope:z>ASCENT_START&&z<ASCENT_END?(ORBIT_HEIGHT-18)*6*t*(1-t)/(ASCENT_END-ASCENT_START):0};
}
export function departureAt(z:number){return {
 altitude:ascentAt(z).height-18,
 city:1-smooth(z,1650,2160),air:1-smooth(z,1250,2450),
 cloud:smooth(z,1390,1740)*(1-smooth(z,2070,2430)),orbit:smooth(z,1580,2450),
};}
