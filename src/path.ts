// A continuous, deterministic orbital ribbon. All renderable road objects share
// this frame, including physical obstacle collisions; camera space is never used.
function launchBlend(z:number){const t=Math.max(0,Math.min(1,(z-800)/350));return {value:t*t*(3-2*t),derivative:z>800&&z<1150?6*t*(1-t)/350:0};}
// Lift the playable ribbon above the intact city/bridge road, including its underside camera.
import {ascentAt} from './departure-profile';
function verticalBlend(z:number){const t=Math.max(0,Math.min(1,(z-2600)/600));return {value:t*t*(3-2*t),derivative:z>2600&&z<3200?6*t*(1-t)/600:0};}
export function pathAt(z:number){const b=launchBlend(z).value,v=verticalBlend(z).value;return {x:b*(34*Math.sin(z/230)+12*Math.sin(z/87)),y:ascentAt(z).height+v*(12*Math.sin(z/195)+3*Math.sin(z/71))};}
export function tangentAt(z:number){const b=launchBlend(z),v=verticalBlend(z);return {x:b.value*(34/230*Math.cos(z/230)+12/87*Math.cos(z/87))+b.derivative*(34*Math.sin(z/230)+12*Math.sin(z/87)),y:ascentAt(z).slope+v.value*(12/195*Math.cos(z/195)+3/71*Math.cos(z/71))+v.derivative*(12*Math.sin(z/195)+3*Math.sin(z/71))};}

