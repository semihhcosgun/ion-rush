import {ENEMY_TYPES,ENEMY_PROGRESSION as P,PURSUIT,type EnemyKind} from './config';
import {expeditionPressure} from './event-horizon';
export const pursuitPressure=(distance:number,age:number)=>distance<PURSUIT.huntDistance?0:Math.max(0,Math.min(1,(age-PURSUIT.reinforceAge)/PURSUIT.pressureRamp));
export const pursuitLimit=(distance:number,pressure:number)=>Math.min(distance<1400?2:distance<3200?4:PURSUIT.maxEnemies,(distance<1400?1:distance<3200?2:3)+Math.ceil(pressure*3));
export const threatBudget=(distance:number)=>(distance<1400?P.earlyBudget:distance<3200?P.moonBudget:distance<6000?P.marsBudget:P.deepBudget)+expeditionPressure(distance)*4;
/** Retire old patrols as new combat tiers become available. */
export function minimumEnemyRank(distance:number){
 const newest=Math.max(1,...Object.values(ENEMY_TYPES).filter(e=>distance>=e.unlock).map(e=>e.rank));
 return Math.max(1,newest-1);
}
export function enemyChoices(distance:number,alive:EnemyKind[],pressure=0){
 const used=alive.reduce((sum,k)=>sum+ENEMY_TYPES[k].cost,0),elites=alive.filter(k=>ENEMY_TYPES[k].rank>=3).length;
 return (Object.keys(ENEMY_TYPES) as EnemyKind[]).filter(k=>{const d=ENEMY_TYPES[k];return distance>=d.unlock&&d.rank>=minimumEnemyRank(distance)&&used+d.cost<=threatBudget(distance)+pressure*PURSUIT.extraBudget+1e-6&&!(d.rank>=8&&alive.filter(k=>ENEMY_TYPES[k].rank>=8).length>=(distance>=33000?2:1))&&!(d.rank>=3&&(alive.includes(k)||elites>=(distance<P.doubleEliteDistance?1:2)));}).map(kind=>{
  const d=ENEMY_TYPES[kind],intro=d.rank===1?1:P.introWeight+(1-P.introWeight)*Math.min(1,(distance-d.unlock)/P.introDistance),retire=Math.max(.3,1-Math.max(0,distance-d.unlock-2000)/8000);
  return {kind,weight:d.weight*intro*retire*(d.rank>=6?1.5:1)};
 });
}
export function chooseEnemy(distance:number,alive:EnemyKind[],roll:number,pressure=0):EnemyKind|undefined{const choices=enemyChoices(distance,alive,pressure);let target=Math.max(0,Math.min(.999999,roll))*choices.reduce((s,c)=>s+c.weight,0);for(const choice of choices){target-=choice.weight;if(target<0)return choice.kind;}return undefined;}
