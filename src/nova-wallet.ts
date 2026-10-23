export interface NovaWallet {journey:{nova:number};novaDebt?:number}

// Spent refunded currency becomes debt, so spending before a refund cannot
// erase the debit. Every subsequent source of NOVA settles that debt first.
export function creditNova(wallet:NovaWallet,amount:number){
 const debt=wallet.novaDebt??0,settled=Math.min(debt,amount);
 wallet.novaDebt=debt-settled;
 wallet.journey.nova+=amount-settled;
 return amount-settled;
}
export function revokeNova(wallet:NovaWallet,amount:number){
 const removed=Math.min(wallet.journey.nova,amount);
 wallet.journey.nova-=removed;
 wallet.novaDebt=(wallet.novaDebt??0)+amount-removed;
}
