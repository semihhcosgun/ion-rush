import {Capacitor,type PluginListenerHandle} from '@capacitor/core';
import {nativeDeviceState} from './thermal-monitor';
export type PowerStatus={supported:boolean;lowPower:boolean};
export interface PowerPlugin {
 getPowerStatus():Promise<PowerStatus>;
 addListener(event:'powerStateChanged',listener:(status:PowerStatus)=>void):Promise<PluginListenerHandle>;
}
export class PowerMonitor {
 private listener?:PluginListenerHandle;
 private revision=0;
 private stopped=false;
 constructor(private changed:(lowPower:boolean)=>void,private plugin:PowerPlugin=nativeDeviceState){}
 async start(){
  try{
   const listener=await this.plugin.addListener('powerStateChanged',status=>{this.revision++;this.accept(status);});
   if(this.stopped){await listener.remove();return;}this.listener=listener;
  }catch{/* An older installed native bridge may not support power events. */}
  await this.refresh();
 }
 async refresh(){
  if(this.stopped)return;const revision=++this.revision;
  try{const status=await this.plugin.getPowerStatus();if(revision===this.revision)this.accept(status);}catch{/* Keep the known power budget. */}
 }
 private accept(status:PowerStatus){
  if(!this.stopped&&status?.supported===true&&typeof status.lowPower==='boolean')this.changed(status.lowPower);
 }
 async stop(){this.stopped=true;await this.listener?.remove();this.listener=undefined;}
}
export function monitorPower(changed:(lowPower:boolean)=>void){
 if(!Capacitor.isNativePlatform())return;
 const monitor=new PowerMonitor(changed);void monitor.start();return monitor;
}
