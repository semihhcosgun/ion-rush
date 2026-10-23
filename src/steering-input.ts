/** A tap moves one lane; dragging cancels the tap. */
export function steeringInput(root:HTMLElement,enabled:()=>boolean,lane:(dir:number)=>void){
 const active=new Map<number,{button:HTMLElement;x:number;y:number;started:number;distance:number;used:boolean;dir:number}>();
 const clear=(id?:number)=>{for(const [key,g] of active){if(id!==undefined&&key!==id)continue;active.delete(key);g.button.classList.remove('gesture-held','gesture-swiped');if(g.button.hasPointerCapture(key))g.button.releasePointerCapture(key);}};
 window.addEventListener('pointerdown',e=>{const button=(e.target as Element).closest<HTMLElement>('[data-steer]');if(!button||!root.contains(button)||!enabled()||e.button!==0||[...active.values()].some(g=>g.button===button))return;e.preventDefault();active.set(e.pointerId,{button,x:e.clientX,y:e.clientY,started:e.timeStamp,distance:0,used:false,dir:Number(button.dataset.steer)});button.setPointerCapture(e.pointerId);button.classList.add('gesture-held');});
 const move=(e:PointerEvent)=>{const g=active.get(e.pointerId);if(!g)return;if(!enabled()){clear(e.pointerId);return;}e.preventDefault();g.distance=Math.max(g.distance,Math.hypot(e.clientX-g.x,e.clientY-g.y));if(!g.used&&g.distance>=26){g.used=true; }};
 window.addEventListener('pointermove',move,{passive:false});
 window.addEventListener('pointerup',e=>{const g=active.get(e.pointerId);if(!g)return;move(e);if(enabled()&&!g.used&&g.distance<14&&e.timeStamp-g.started<450)lane(g.dir);clear(e.pointerId);});
 window.addEventListener('pointercancel',e=>clear(e.pointerId));root.addEventListener('lostpointercapture',e=>clear(e.pointerId));window.addEventListener('blur',()=>clear());
 root.addEventListener('click',e=>{const button=(e.target as Element).closest<HTMLElement>('[data-steer]');if(button&&e.detail===0&&enabled())lane(Number(button.dataset.steer));});
 return {clear};
}
