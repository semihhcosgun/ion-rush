type Batch={snapshot:()=>string;promise:Promise<void>;resolve:()=>void;reject:(error:unknown)=>void};

// One timer per burst, so a busy race cannot postpone the save indefinitely.
// Critical writes replace a pending batch and resolve only after durable storage.
export class SaveWriter {
 private queue=Promise.resolve();
 private batch:Batch|undefined;
 private timer:ReturnType<typeof setTimeout>|undefined;
 constructor(private write:(value:string)=>Promise<void>,private delay=750){}
 schedule(snapshot:()=>string):Promise<void>{
  if(this.batch){this.batch.snapshot=snapshot;return this.batch.promise;}
  let resolve!:()=>void,reject!:(error:unknown)=>void;
  const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});
  this.batch={snapshot,promise,resolve,reject};
  this.timer=setTimeout(()=>{
   const batch=this.takeBatch()!;
   try{this.enqueue(batch.snapshot()).then(batch.resolve,batch.reject);}
   catch(error){batch.reject(error);}
  },this.delay);
  return promise;
 }
 immediate(value:string):Promise<void>{
  const batch=this.takeBatch();
  const result=this.enqueue(value);
  if(batch)result.then(batch.resolve,batch.reject);
  return result;
 }
 private takeBatch(){
  if(this.timer!==undefined)clearTimeout(this.timer);
  this.timer=undefined;const batch=this.batch;this.batch=undefined;return batch;
 }
 private enqueue(value:string){
  this.queue=this.queue.catch(()=>{}).then(()=>this.write(value));
  return this.queue;
 }
}
