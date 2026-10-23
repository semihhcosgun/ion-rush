export const EVENT_NAMES = ['support_used','tutorial_step','run_start','run_end','run_checkpoint','damage_taken','pickup_resolved','turbo_used','enemy_encounter_start','enemy_encounter_end','destination_reached','rift_presented','rift_entered','rift_ended','ship_core_presented','ship_started','ship_ended','archive_opened','archive_card_viewed','app_backgrounded','performance_summary'] as const;
export type EventName = typeof EVENT_NAMES[number];
export type Params = Record<string,string|number>;
export interface RecordEvent {name:EventName;params:Params;created:number;}
export interface EventTransport {send(event:RecordEvent):Promise<void>;}
export interface Store {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void;}
export const QUEUE_KEY='ion-telemetry-queue-v1';
const MAX_QUEUE=500,MAX_AGE=72*60*60*1000;
export function validEvent(event:RecordEvent){return EVENT_NAMES.includes(event.name)&&Number.isFinite(event.created)&&Object.keys(event.params).length<=25&&Object.entries(event.params).every(([k,v])=>/^[a-z][a-z0-9_]{0,39}$/.test(k)&&(typeof v==='string'?v.length<=100:typeof v==='number'&&Number.isFinite(v)));}
/** Only enabled telemetry events enter the durable queue. SDK acceptance is not server delivery. */
export class EventQueue {
  events:RecordEvent[]=[];enabled=false;private sending=false;private generation=0;
  constructor(private store:Store,private transport:EventTransport,private now=Date.now){}
  enable(){this.enabled=true;try{const saved=JSON.parse(this.store.getItem(QUEUE_KEY)??'[]');this.events=Array.isArray(saved)?saved.filter(e=>e&&e.params&&validEvent(e)&&this.now()-e.created<MAX_AGE).slice(-MAX_QUEUE):[];}catch{this.events=[];}}
  disable(){this.enabled=false;this.generation++;this.events=[];try{this.store.removeItem(QUEUE_KEY);}catch{}}
  push(event:RecordEvent){if(!this.enabled||!validEvent(event))return;this.events.push(event);this.events=this.events.filter(e=>this.now()-e.created<MAX_AGE).slice(-MAX_QUEUE);this.persist();}
  private persist(){try{this.store.setItem(QUEUE_KEY,JSON.stringify(this.events));}catch{/* Storage may be unavailable; the bounded memory queue still works. */}}
  async flush(){if(this.sending||!this.enabled)return;this.sending=true;const generation=this.generation;try{while(this.enabled&&generation===this.generation&&this.events.length){const event=this.events[0];if(this.now()-event.created<MAX_AGE){try{await this.transport.send(event);}catch{break;}}if(generation!==this.generation)break;if(this.events[0]===event)this.events.shift();this.persist();}}finally{this.sending=false;}}
}
