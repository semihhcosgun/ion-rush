// Static screens request one frame; active gameplay requests the next frame.
export class DemandFrameLoop {
 private active=false;
 private pending:number|undefined;
 private drawing=false;
 private dirty=false;
 constructor(
  private frame:(now:number)=>boolean,
  private wake:()=>void,
  private request:(callback:FrameRequestCallback)=>number=callback=>requestAnimationFrame(callback),
  private cancel:(id:number)=>void=id=>cancelAnimationFrame(id),
 ){}
 setActive(active:boolean){
  if(this.active===active)return;
  this.active=active;
  if(active)this.invalidate();
  else if(this.pending!==undefined){this.cancel(this.pending);this.pending=undefined;}
 }
 invalidate(){
  this.dirty=true;
  if(this.active&&this.pending===undefined&&!this.drawing){this.wake();this.schedule();}
 }
 private schedule(){this.pending=this.request(now=>{
  this.pending=undefined;
  if(!this.active)return;
  this.dirty=false;this.drawing=true;
  let continuous=false;
  try{continuous=this.frame(now);}finally{this.drawing=false;}
  if(this.active&&(continuous||this.dirty))this.schedule();
 });}
}
