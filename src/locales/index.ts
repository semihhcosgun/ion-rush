import {en} from './en';
import {tr} from './tr';
import {es} from './es';
import {ptBR} from './pt-BR';
import {de} from './de';
import {fr} from './fr';

export const catalogs={en,tr,es,'pt-BR':ptBR,de,fr} as const;
export type Locale=keyof typeof catalogs;

// Keep region-specific identifiers when available, then match the base language.
// Portuguese uses the Brazilian catalog, including devices reporting just "pt".
export function resolveLocale(value:unknown):Locale{
 if(typeof value!=='string')return 'en';
 const tag=value.trim().replace(/_/g,'-').toLowerCase();
 const ids=Object.keys(catalogs) as Locale[];
 const exact=ids.find(id=>id.toLowerCase()===tag);
 if(exact)return exact;
 const base=tag.split('-')[0];
 return ids.find(id=>id.toLowerCase().split('-')[0]===base)??'en';
}
