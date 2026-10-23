import {Capacitor,registerPlugin} from '@capacitor/core';
import {EVENT_NAMES,EventQueue,validEvent,type EventName,type Params,type RecordEvent,type Store} from './telemetry-core';
export interface NativeTelemetry {status():Promise<{configured:boolean;testBuild:boolean;qaUpload:boolean}>;setEnabled(options:{enabled:boolean}):Promise<void>;logEvent(options:{name:string;params:Params}):Promise<void>;recordError(options:{code:string;stack:string}):Promise<void>;}
const native=registerPlugin<NativeTelemetry>('IonTelemetry');
const memory=new Map<string,string>();
const storage:Store={getItem:k=>{try{return localStorage.getItem(k);}catch{return memory.get(k)??null;}},setItem:(k,v)=>{memory.set(k,v);try{localStorage.setItem(k,v);}catch{}},removeItem:k=>{memory.delete(k);try{localStorage.removeItem(k);}catch{}}};
const DEV=(import.meta as ImportMeta&{env?:{DEV?:boolean}}).env?.DEV===true;
const CONSENT='ion-telemetry-consent-v1';
export const telemetryStore=storage;
export class Telemetry {
  configured=false;testMode=DEV;qaUpload=false;choice=storage.getItem(CONSENT);private initialized=false;private serial=Promise.resolve();private buffer:RecordEvent[]=[];private errorCount=0;
  constructor(private adapter:NativeTelemetry=native,private platform:()=>string=()=>Capacitor.getPlatform()){}
  private queue=new EventQueue(storage,{send:e=>this.adapter.logEvent({name:e.name,params:e.params})});
  get available(){return this.configured&&(!this.testMode||this.qaUpload);}
  // Production defaults on without fabricating an explicit saved opt-in.
  // Preserve existing refusals; QA uploads still require an explicit choice.
  get enabled(){return this.available&&(this.choice==='yes'||(!this.testMode&&this.choice===null));}
  async init(){try{if(['android','ios'].includes(this.platform())){const status=await this.adapter.status();this.configured=status.configured;this.testMode ||= status.testBuild;this.qaUpload=status.qaUpload&&!DEV;await this.adapter.setEnabled({enabled:this.enabled});}}catch{this.configured=false;}
    if(this.enabled)this.queue.enable();else this.queue.disable();this.initialized=true;
    setInterval(()=>void this.queue.flush(),5000);window.addEventListener('online',()=>void this.queue.flush());
    if(this.testMode)Object.defineProperty(window,'ionTelemetry',{value:{events:()=>structuredClone(this.buffer),clear:()=>{this.buffer=[];},names:EVENT_NAMES},configurable:true});
    window.addEventListener('error',e=>this.error('javascript_error',e.error));window.addEventListener('unhandledrejection',e=>this.error('unhandled_rejection',e.reason));
  }
  setChoice(allowed:boolean){this.choice=allowed?'yes':'no';storage.setItem(CONSENT,this.choice);if(!allowed){this.queue.disable();storage.removeItem('ion-active-run-v1');}
    this.serial=this.serial.catch(()=>{}).then(async()=>{if(this.configured)await this.adapter.setEnabled({enabled:this.enabled});if(this.enabled){this.queue.enable();void this.queue.flush();}});return this.serial;
  }
  emit(name:EventName,params:Params={}){const event:RecordEvent={name,params:{schema_version:1,balance_version:'2026_09_14',app_version:'0.54.0',is_test:this.testMode?1:0,client_time_ms:Date.now(),...params},created:Date.now()};
    if(!validEvent(event)){if(this.testMode)console.error('Invalid telemetry schema',name,Object.keys(event.params));return;}
    if(this.testMode){this.buffer.push(event);if(this.buffer.length>500)this.buffer.shift();if(!this.qaUpload)return;}
    if(this.initialized&&this.enabled)this.queue.push(event);
  }
  flush(){return this.queue.flush();}
  error(code:string,error?:unknown){if(!this.enabled||this.errorCount++>=5)return;const stack=error instanceof Error?(error.stack??'').split('\n').slice(1,12).join('\n').replace(/https?:\/\/[^\s)]+/g,url=>url.split('?')[0]).slice(0,3000):'';void this.adapter.recordError({code,stack}).catch(()=>{});}
}
export const telemetry=new Telemetry();
