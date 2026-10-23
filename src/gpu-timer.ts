/** Asynchronous timer queries: never wait for GPU completion on the main thread.
 * https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/
 */
export class GpuTimer {
 private ext:{TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number}|null;
 private pending:WebGLQuery[]=[];
 private active:WebGLQuery|null=null;
 private frame=0;
 milliseconds:number|null=null;
 constructor(private gl:WebGL2RenderingContext){this.ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');}
 begin(){
  const {gl,ext}=this;if(!ext)return;
  if(gl.getParameter(ext.GPU_DISJOINT_EXT)){this.pending.forEach(q=>gl.deleteQuery(q));this.pending=[];this.milliseconds=null;}
  const query=this.pending[0];
  if(query&&gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){
   this.milliseconds=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(query);this.pending.shift();
  }
  if(++this.frame%30||this.pending.length>=3)return;
  this.active=gl.createQuery();if(this.active)gl.beginQuery(ext.TIME_ELAPSED_EXT,this.active);
 }
 end(){if(this.active&&this.ext){this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);this.pending.push(this.active);this.active=null;}}
 dispose(){this.pending.forEach(q=>this.gl.deleteQuery(q));this.pending=[];}
}
