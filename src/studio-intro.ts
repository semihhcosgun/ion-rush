import {t} from './i18n';
export const studioMarkup=()=>`<section id="studio-intro" aria-label="RVLTN FACTORY"><div class="studio-mark"><img src="/rvltn-factory.png" alt="RVLTN FACTORY" /></div><div class="studio-progress" role="progressbar" aria-label="${t('loading.studio')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div></section>`;
export function studioProgress(ui:HTMLElement,progress:number){const bar=ui.querySelector<HTMLElement>('.studio-progress');if(!bar)return;const value=Math.round(Math.max(0,Math.min(1,progress))*100);bar.setAttribute('aria-valuenow',String(value));bar.querySelector<HTMLElement>('i')!.style.width=value+'%';}
export async function studioIntro(ui:HTMLElement){
 // The logo is an image: CSS fonts otherwise start loading only after home paints.
 const fontsReady=Promise.allSettled([
  '600 16px "Barlow Condensed"','700 16px "Barlow Condensed"',
  '400 16px Manrope','500 16px Manrope','600 16px Manrope','700 16px Manrope','900 16px Nunito','800 16px Nunito',
  '600 16px Oxanium','700 16px Oxanium','800 16px Oxanium',
 ].map(font=>document.fonts.load(font,'ION RUSH 0123456789 ÇĞİÖŞÜ çğıöşü')));
 ui.className='screen-boot';ui.innerHTML=studioMarkup();
 const logo=ui.querySelector<HTMLImageElement>('img')!;
 await logo.decode().catch(()=>{});
 await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
 await Promise.all([fontsReady,new Promise<void>(resolve=>setTimeout(resolve,3500))]);
}
