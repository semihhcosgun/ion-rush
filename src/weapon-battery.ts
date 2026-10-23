import {ENEMY_TYPES,COMBAT} from './config';
/** Continuous battery recharge, with no collectible or health-style inventory.
 * A fresh weapon has sixteen shots; unlocks add capacity for tougher hulls.
 * A normal full recharge costs eight seconds; bike abilities may accelerate it. */
export function weaponBatteryProfile(distance:number){
 const strongest=Math.max(2,...Object.values(ENEMY_TYPES).filter(e=>e.unlock<=distance).map(e=>e.hp));
 const shots=100/COMBAT.shotHeat+(strongest-2);
 return {shots,shotHeat:100/shots,cooling:COMBAT.cooling,activeCooling:COMBAT.activeCooling,rearm:COMBAT.rearm};
}
