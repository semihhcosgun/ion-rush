/** Original FM discharge, plasma impacts and filtered blast effects, cached before play. */
export const SFX_DURATION={uiClick:.085,supportReady:.8,supportCalled:2.4,supportEnded:.38,supportShot:.48,supportBlocked:.65,lessonStep:.48,lessonComplete:.95,revive:1.15,meteorWarning:.32,meteorImpact:1.2,warp:.55,heatVent:.38,overdrive:.65,targetLock:.48,guardReady:.4,guardBlock:.3,siegeReady:.35,siegeBeam:2,phaseStart:.45,phaseEnd:.18,singularityReady:.4,singularityOpen:1.1,singularityAbsorb:.2,shot:.32,enemyShot:.4,enemyHit:.28,kill:.95,hit:.65,shift:.32,lane:.1,energy:.18,health:.85,shield:.4,shieldHit:.3,shieldExpired:.28,boost:.65,incoming:.18,denied:.1,clean:.09,goal:.4,turboReady:.4,stage:.5} as const;
export const OVERDRIVE_AUDIO_GAIN=1.6;
export type SfxKind=keyof typeof SFX_DURATION;
export function synthEffect(kind:SfxKind,rate:number,variation=0):Float32Array<ArrayBuffer>{
 // Overdrive reuses the original turbo waveform, only with more amplitude.
 if(kind==='overdrive')return synthEffect('boost',rate,variation).map(sample=>sample*OVERDRIVE_AUDIO_GAIN);
 const duration=SFX_DURATION[kind],data=new Float32Array(Math.ceil(duration*rate));let seed=731+variation*977,low=0,body=0,carrier=0,modulator=0,bass=0;
 const pitch=1+(variation-1.5)*.018, lowAlpha=1-Math.exp(-2*Math.PI*850/rate), bodyAlpha=1-Math.exp(-2*Math.PI*140/rate);
 for(let i=0;i<data.length;i++){
  const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;
  low+=(noise-low)*lowAlpha;body+=(noise-body)*bodyAlpha;let v=0;
  if(kind==='uiClick'){
   // Layer a dry switch snap, a rounded mechanical body and a tiny enclosure reflection.
   // Each layer decays separately so the click has weight without a pitched beep.
   bass+=2*Math.PI*(270+160*Math.exp(-t/.006))/rate;
   carrier+=2*Math.PI*920/rate;
   const attack=Math.min(1,t/.0008);
   const snap=(noise-low)*.18*Math.exp(-t/.0022)+low*.30*Math.exp(-t/.006);
   const weight=(Math.sin(bass)*.22+Math.sin(bass*2.07)*.045)*Math.exp(-t/.014);
   const contact=Math.sin(carrier)*.06*Math.exp(-t/.0045);
   const reflection=t>.008?low*.065*Math.exp(-(t-.008)/.009)*Math.min(1,(t-.008)/.002):0;
   v=attack*(snap+weight+contact)+reflection;
  }else if(kind==='supportReady'||kind==='supportCalled'){
   const notes=kind==='supportReady'?[659.25,880,1318.5]:[880,659.25,440];
   for(let n=0;n<notes.length;n++){const u=t-n*.16;if(u>=0){const env=Math.min(1,u/.008)*Math.exp(-u/.095);v+=env*(Math.sin(2*Math.PI*notes[n]*u)*.28+low*.08);}}
   if(kind==='supportCalled'){
    // Three staggered turbine passes match the wing's arrival.
    for(let n=0;n<3;n++){const u=t-.22-n*.34;if(u<0||u>1.3)continue;const env=Math.sin(Math.PI*u/1.3)**2;const phase=2*Math.PI*(210*u+95*(1-Math.exp(-u*4)));v+=env*(low*.65+body*.9+Math.sin(phase)*.18+Math.sin(phase*2)*.09);}
   }
  }else if(kind==='supportEnded'){
   // Audible gathering sweep followed by a compact departure pulse, within the teleport.
   const gather=Math.min(1,t/.22),release=Math.max(0,t-.22);
   carrier+=2*Math.PI*(320+1500*gather*gather)*Math.exp(-release*15)/rate;
   bass+=2*Math.PI*(100+180*Math.exp(-release*24))/rate;
   const env=Math.min(1,t/.008)*(.35+.65*gather)*Math.exp(-release*25);
   v=env*(low*.6+Math.sin(carrier)*.3)+Math.sin(bass)*Math.min(1,release/.006)*Math.exp(-release*32)*.35;
  }else if(kind==='singularityReady'){
   for(const [n,f] of [440,660,880].entries()){const u=t-n*.07;if(u>=0)v+=Math.sin(2*Math.PI*f*u)*.22*Math.min(1,u/.007)*Math.exp(-u/.06);}
  }else if(kind==='singularityOpen'){
   carrier+=2*Math.PI*(95+300*Math.exp(-t/.12))/rate;modulator+=2*Math.PI*23/rate;
   const env=Math.min(1,t/.018)*Math.min(1,(duration-t)/.28);v=env*(Math.sin(carrier+Math.sin(modulator)*1.5)*.24+body*.4+low*.18)*(.65+.35*Math.exp(-t/.2));
  }else if(kind==='singularityAbsorb'){
   carrier+=2*Math.PI*(200+1600*Math.exp(-t/.025))/rate;v=(Math.sin(carrier)*.28+low*.22)*Math.sin(Math.PI*t/duration)**1.4;
  }else if(kind==='phaseStart' ||kind==='phaseEnd'){
   const enter=kind==='phaseStart',sweep=enter?1-t/duration:t/duration;
   carrier+=2*Math.PI*(180+1100*sweep*sweep)/rate;modulator+=2*Math.PI*37/rate;
   const env=Math.sin(Math.PI*t/duration)**1.5;v=env*(Math.sin(carrier+Math.sin(modulator)*2)*.18+low*.3);
  }else if(kind==='siegeReady'){
   const env=Math.min(1,t/.008)*Math.exp(-t/ .08);v=env*(Math.sin(2*Math.PI*880*t)*.2+Math.sin(2*Math.PI*1320*t)*.15);
  }else if(kind==='siegeBeam'){
   carrier+=2*Math.PI*(150+50*Math.sin(t*8))/rate;modulator+=2*Math.PI*46/rate;
   const env=Math.min(1,t/.035)*Math.min(1,(duration-t)/.15);v=env*(Math.sin(carrier+Math.sin(modulator)*2)*.25+low*.22+Math.sin(carrier*.5)*.15);
  }else if(kind==='guardReady'){
   for(const [n,f] of [660,990].entries()){const u=t-n*.065;if(u>=0)v+=(Math.sin(2*Math.PI*f*u)*.22+low*.06)*Math.min(1,u/.006)*Math.exp(-u/.065);}
  }else if(kind==='guardBlock'){
   carrier+=2*Math.PI*(520+1600*Math.exp(-t/.035))/rate;bass+=2*Math.PI*(110+90*Math.exp(-t/.015))/rate;
   v=Math.min(1,t/.002)*(Math.sin(carrier)*.25+Math.sin(bass)*.25+low*.35)*Math.exp(-t/.055);
  }else if(kind==='targetLock'){
   // Two short mechanical ignitions and rising guidance tones, one per launcher.
   for(const delay of [0,.09]){const u=t-delay;if(u<0)continue;const env=Math.min(1,u/.003)*Math.exp(-u/.065);v+=env*(Math.sin(2*Math.PI*(280*u+850*u*u))*.25+low*.26+body*.3);}
  }else if(kind==='heatVent'){
   // A valve clack opens into a falling air release; no extra gunshot layer.
   bass+=2*Math.PI*(140+120*Math.exp(-t/.009))/rate;
   const valve=(Math.sin(bass)*.32+low*.35)*Math.exp(-t/.018);
   const air=Math.min(1,Math.max(0,t-.008)/.009)*Math.exp(-Math.max(0,t-.018)/.065);
   v=valve+((noise-low)*.22+low*.75+body*.35)*air;
  }else if(kind==='supportShot'){
   carrier+=2*Math.PI*(150+1400*Math.exp(-t/.022))/rate;bass+=2*Math.PI*(80+160*Math.exp(-t/.04))/rate;
   v=(Math.sin(carrier+Math.sin(carrier*1.7)*2)*.4+low*.32)*Math.exp(-t/.09)+Math.sin(bass)*.48*Math.exp(-t/.16);
   if(t>.08)v+=low*.22*Math.exp(-(t-.08)/.1);
  }else if(kind==='supportBlocked'){
   carrier+=2*Math.PI*(110+360*Math.exp(-t/.045))/rate;v=(Math.sin(carrier)*.48+low*.6+body*.7)*Math.exp(-t/.18)+Math.sin(2*Math.PI*660*t)*.1*Math.exp(-t/.25);
  }else if(kind==='lessonStep'||kind==='lessonComplete'){
   // Warm ascending notes, with a soft low note to read on phone speakers.
   const notes=kind==='lessonStep'?[523.25,783.99]:[523.25,659.25,783.99,1046.5];
   for(let n=0;n<notes.length;n++){const u=t-n*(kind==='lessonStep'?.105:.12);if(u<0)continue;
    const env=Math.min(1,u/.009)*Math.exp(-u/(kind==='lessonStep'?.105:.19));
    v+=env*(Math.sin(2*Math.PI*notes[n]*u)*.30+Math.sin(2*Math.PI*notes[n]*2*u)*.045);
   }
   v+=Math.sin(2*Math.PI*261.63*t)*Math.min(1,t/.008)*Math.exp(-t/.11)*.20;
  }else if(kind==='revive'){
   // A short intake, a solid ignition hit and a bright fifth resolve.
   // Upper bass harmonics keep the impact audible on small phone speakers.
   const charge=Math.min(1,t/.14);
   carrier+=2*Math.PI*(170+1000*charge**3)/rate;
   modulator+=2*Math.PI*(95+280*charge)/rate;
   if(t<.14)v=Math.sin(Math.PI*charge)**.8*(low*.46+Math.sin(carrier+Math.sin(modulator)*1.4)*.19);
   const hit=t-.12;
   if(hit>=0){
    const attack=Math.min(1,hit/.004),bodyEnv=attack*Math.exp(-hit/.17);
    bass+=2*Math.PI*(92+170*Math.exp(-hit/.026))/rate;
    const engine=Math.sin(bass)+Math.sin(bass*2)*.55+Math.sin(bass*3)*.3;
    v+=engine*bodyEnv*.5;
    v+=attack*((noise-low)*.23*Math.exp(-hit/.012)+low*.48*Math.exp(-hit/.075));
    // The chord blooms just after the mechanical hit instead of masking it.
    const bloom=Math.max(0,hit-.045),env=Math.min(1,bloom/.035)*Math.exp(-bloom/.25);
    v+=env*(Math.sin(2*Math.PI*293.66*bloom)*.22+Math.sin(2*Math.PI*440*bloom)*.18+Math.sin(2*Math.PI*587.33*bloom)*.12);
    const air=Math.min(1,hit/.03)*Math.exp(-hit/.24);
    v+=low*air*.17;
    const lock=hit-.22;
    if(lock>=0){const seal=Math.min(1,lock/.004)*Math.exp(-lock/.055);v+=seal*(Math.sin(2*Math.PI*880*lock)*.14+Math.sin(2*Math.PI*1320*lock)*.055);}
   }
  }else if(kind==='meteorWarning'){
   const env=Math.sin(Math.PI*Math.min(1,t/.28))**2;v=(Math.sin(2*Math.PI*660*t)+Math.sin(2*Math.PI*880*t)*.25)*env*.13;
  }else if(kind==='meteorImpact'){
   carrier+=2*Math.PI*(38+110*Math.exp(-t/.07))/rate;const attack=Math.min(1,t/.004);
   v=attack*(body*.95*Math.exp(-t/.4)+Math.sin(carrier)*.35*Math.exp(-t/.28)+(noise-low)*.22*Math.exp(-t/.025)+low*.2*Math.exp(-t/.15));
  }else if(kind==='warp'){
   const u=t/duration,env=Math.sin(Math.PI*u)**2;carrier+=2*Math.PI*(190+850*(1-u)**3)/rate;modulator+=2*Math.PI*73/rate;
   v=env*(Math.sin(carrier+Math.sin(modulator)*2.2)*.14+low*.2+body*.25);
  }else if(kind==='shot'||kind==='enemyShot'){
   const hostile=kind==='enemyShot',f=(hostile?95:125)+(hostile?780:1350)*Math.exp(-t/(hostile?.085:.04));
   carrier+=2*Math.PI*f*pitch/rate;modulator+=2*Math.PI*f*(hostile?1.43:2.71)*pitch/rate;bass+=2*Math.PI*(58+120*Math.exp(-t/.022))/rate;
   const energy=Math.sin(carrier+(hostile?4.6:6.2)*Math.exp(-t/.1)*Math.sin(modulator));
   v=energy*Math.exp(-t/.065)*.53+Math.sin(bass)*Math.exp(-t/.095)*.42+(noise-low)*Math.exp(-t/.006)*.23;
   if(t>.036)v+=low*.2*Math.exp(-(t-.036)/.025);
  }else if(kind==='enemyHit'){
   // Broadband pressure and a short falling body: no ringing metal modes.
   bass+=2*Math.PI*(105+100*Math.exp(-t/.012))*pitch/rate;
   carrier+=2*Math.PI*(240+230*Math.exp(-t/.009))*pitch/rate;
   v=body*Math.exp(-t/.065)*1.9+low*Math.exp(-t/.035)*.85;
   v+=Math.sin(bass)*Math.exp(-t/.045)*.42;
   v+=Math.sin(carrier+low*.8)*Math.exp(-t/.021)*.17;
   v+=(noise-low)*Math.exp(-t/.003)*.09;
  }else if(kind==='kill'||kind==='hit'){
   v=body*Math.exp(-t/.3)*3.8+low*Math.exp(-t/.14)*.9+(noise-low)*Math.exp(-t/.018)*.18;
   v+=(Math.sin(2*Math.PI*57*t)+.45*Math.sin(2*Math.PI*103*t))*Math.exp(-t/.17)*.3;
   for(const delay of [.045,.105,.19,.3])if(t>delay)v+=low*Math.exp(-(t-delay)/.04)*.24;
   if(kind==='hit')v*=.75;
  }else if(kind==='shift'||kind==='boost'){
   const u=t/duration,env=Math.sin(Math.PI*u)**1.2;carrier+=2*Math.PI*(75+u*(kind==='boost'?230:100))/rate;
   v=env*(low*.75+body*1.1+Math.sin(carrier+Math.sin(carrier*1.41)*1.8)*.16);
  }else if(kind==='shield'||kind==='shieldHit'||kind==='shieldExpired'){
   carrier+=2*Math.PI*(kind==='shieldExpired'?240-160*t/duration:180+140*Math.exp(-t/.055))/rate;
   v=(Math.sin(carrier+Math.sin(carrier*2.37)*Math.exp(-t/.12)*3)*.3+low*.35)*Math.exp(-t/.1);
  }else if(kind==='health'){
   // A rising intake resolves into a warm, short chord as the light enters the suit.
   const intake=Math.max(0,1-t/.34);
   carrier+=2*Math.PI*(240+620*Math.min(1,t/.34))/rate;
   v=(Math.sin(carrier)*.12+low*.25)*Math.sin(Math.PI*Math.min(1,t/.34))*intake;
   const hit=t-.32;
   if(hit>=0){
    const attack=Math.min(1,hit/.009),decay=Math.exp(-hit/.15);
    v+=attack*decay*(Math.sin(2*Math.PI*523.25*hit)*.25+Math.sin(2*Math.PI*659.25*hit)*.17+Math.sin(2*Math.PI*783.99*hit)*.12);
    v+=attack*Math.exp(-hit/.085)*Math.sin(2*Math.PI*130.81*hit)*.34;
   }
  }else if(kind==='energy'||kind==='goal'||kind==='turboReady'||kind==='stage'){
   const env=Math.exp(-t/(kind==='energy'?.04:.11));v=(Math.sin(2*Math.PI*330*t+Math.sin(2*Math.PI*719*t)*.8)*.2+Math.sin(2*Math.PI*165*t)*.16+low*.1)*env;
  }else{v=(low*.6+Math.sin(2*Math.PI*(kind==='incoming'?230:110)*t)*.18)*Math.exp(-t/.035);}
  data[i]=Math.tanh(v*1.4)*.48*Math.min(1,t/.0015)*Math.min(1,(duration-t)/.015);
 }return data;
}
