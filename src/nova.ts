export const NOVA_STARTER_BALANCE=3;
export const NOVA_REVIVE_COST=1;

export function canSpendNova(balance:number,cost=NOVA_REVIVE_COST){
  return Number.isFinite(balance)&&balance>=cost;
}
