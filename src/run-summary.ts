import type {Race} from './game';
import type {Save} from './storage';

const savedRuns=new WeakMap<Race,{energy:number;best:number}>();
/** Save each crash immediately; a recovered run only contributes its new rewards. */
export function saveRunProgress(save:Save,race:Race){
  const prior=savedRuns.get(race);
  const best=prior?.best??save.journey.distance;
  save.journey.distance=Math.max(save.journey.distance,Math.floor(race.z));
  save.journey.score=Math.max(save.journey.score,race.score);
  save.journey.energy+=Math.max(0,race.energy-(prior?.energy??0));
  if(!prior)save.journey.runs++;
  savedRuns.set(race,{energy:race.energy,best});
  return race.z>best;
}
