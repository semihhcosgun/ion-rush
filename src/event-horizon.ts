import {DEEP_SPACE} from './config';
export interface HorizonReward {eventHorizonUnlocked:boolean;livery:'classic'|'event-horizon';journey:{distance:number};}
/** Award immediately on crossing, so leaving the run cannot lose the reward. */
export function unlockEventHorizon(save:HorizonReward,distance:number){
 if(save.eventHorizonUnlocked||!Number.isFinite(distance)||distance<DEEP_SPACE.target)return false;
 save.eventHorizonUnlocked=true;save.livery='event-horizon';save.journey.distance=Math.max(save.journey.distance,Math.floor(distance));return true;
}
export const distantPressure=(distance:number)=>Math.max(0,Math.min(1,(distance-DEEP_SPACE.kuiper)/(DEEP_SPACE.target-DEEP_SPACE.kuiper)));
/** Long expeditions include short breathing windows between tougher patrols. */
export const deepRespite=(distance:number)=>distance>=DEEP_SPACE.interstellar&&(distance-DEEP_SPACE.interstellar)%3000<400;
export const expeditionPressure=(distance:number)=>distantPressure(distance)*(deepRespite(distance)?.35:1);
