import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';
import type {ThermalState} from './thermal-protection';
import type {PowerPlugin} from './power-monitor';
export type ThermalStatus={supported:boolean;state:ThermalState};
export interface ThermalPlugin {
 getStatus():Promise<ThermalStatus>;
 addListener(event:'thermalStateChanged',listener:(status:ThermalStatus)=>void):Promise<PluginListenerHandle>;
}
export const nativeDeviceState=registerPlugin<ThermalPlugin&PowerPlugin>('IonThermal');
const states=['nominal','fair','serious','critical'];

/** Notifications avoid polling sensors. Failed reads never mean "cooled down". */
export class ThermalMonitor {
 private listener?:PluginListenerHandle;
 private revision=0;
 private stopped=false;
 constructor(private changed:(state:ThermalState)=>void,private plugin:ThermalPlugin=nativeDeviceState){}
 async start(){
  try{
   const listener=await this.plugin.addListener('thermalStateChanged',status=>{this.revision++;this.accept(status);});
   if(this.stopped){await listener.remove();return;}
   this.listener=listener;
  }catch{/* Older native builds and browsers keep the existing FPS policy. */}
  await this.refresh();
 }
 async refresh(){
  if(this.stopped)return;
  const revision=++this.revision;
  try{const status=await this.plugin.getStatus();if(revision===this.revision)this.accept(status);}catch{/* Keep the last known thermal budget. */}
 }
 private accept(status:ThermalStatus){
  if(!this.stopped&&status?.supported===true&&states.includes(status.state))this.changed(status.state);
 }
 async stop(){this.stopped=true;await this.listener?.remove();this.listener=undefined;}
}
export function monitorThermals(changed:(state:ThermalState)=>void){
 if(!Capacitor.isNativePlatform())return;
 const monitor=new ThermalMonitor(changed);void monitor.start();return monitor;
}
