import './badge-award.css';
import {RaceBadgeAwards} from './badge-award-ui';
import {raceHudMarkup} from './race-hud';
import {MENU_TRACKS,cleanMenuTrack} from './menu-music';
import './garage.css';
import './ignition.css';
import './runner.css';
import './hunter.css';
import './vanguard.css';
import './titan.css';
import './phantom.css';
import './singularity.css';
import {updateSingularityHud} from './singularity-ui';
import {updatePhantomHud} from './phantom-ui';
import {phaseActive} from './phantom';
import {updateTitanHud} from './titan-ui';
import {updateVanguardHud} from './vanguard-ui';
import {updateHunterHud} from './hunter-ui';
import {updateRunnerHud} from './runner-ui';
import {openBikeAbilities,ignitionStatus} from './ignition-ui';
import {BIKE_TIERS,BikeProgressTracker,cleanBikeProgress,masteryXp} from './bike-progress';
import {garageMarkup,garageHome,garageRun} from './garage';
import {DemandFrameLoop} from './demand-frame-loop';
import {monitorPower,type PowerMonitor} from './power-monitor';
import {monitorThermals,type ThermalMonitor} from './thermal-monitor';
import {ThermalNoticeSession} from './thermal-notice';
import {supportHud,updateSupportHud} from './support-hud';
import {supportPreviewMode} from './dev-flags';
import {FlightLesson,cleanTutorial,needsTutorial} from './onboarding';
import {drawLesson} from './onboarding-ui';
import {reminderSetting,reminderHome,toggleReminders,refreshReminders,updateReminderBest} from './reminders';
import '@fontsource/barlow-condensed/latin-ext-600.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/barlow-condensed/latin-ext-700.css';
import '@fontsource/manrope/latin-ext-400.css';
import '@fontsource/manrope/latin-ext-600.css';
import '@fontsource/manrope/latin-ext-700.css';
import './style.css';
import './interface.css';
import './home.css';
import './menu-theme.css';
import './race-theme.css';
import './route-map.css';
import './alien-archive.css';
import './telemetry.css';
import './nova.css';
import './store.css';
import './run-summary.css';
import './home-typography.css';
import './journey-loading.css';
import './brand-wordmark.css';
import './home-layout.css';
import './music-mode.css';
import {journeyLoadingMarkup,updateJourneyLoading} from './journey-loading';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-ext-500.css';
import {saveRunProgress} from './run-summary';
import {alienArchive,flipAlienCard} from './alien-archive';
import {ALIEN_KINDS,alienLore,recordAlien} from './alien-catalog';
import {telemetry} from './telemetry';
import {runTelemetry} from './run-telemetry';
import {watchArchiveCards,analyticsSetting} from './telemetry-ui';
import { icons } from './icons';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ROUTES, TUNE, SURVIVAL, FIRE_PAD, COMBAT, ENEMY_TYPES, ENEMY_ENTRY, RUN_GOALS, stageProgress } from './config';
import { Race, wrap } from './game';
import { World } from './world';
import { readSave, writeSave, scheduleSave, type Save } from './storage';
import {unlockEventHorizon} from './event-horizon';
import { Sound } from './audio';
import {novaArtwork} from './nova-artwork';
import {toggleTutorialReplay,takeTutorialReplay} from './tutorial-replay';
import {monitorExternalMusic,musicOfferEligible,MusicOfferSession,type ExternalMusicMonitor} from './music-mode';
import { studioIntro, studioProgress } from './studio-intro';
import { steeringInput } from './steering-input';
import {upper,enemyText,formatNumber,goalText,obstacleText,pilotTitleText,routeText,setLocale,supportedLocales,t} from './i18n';
import {riftPreviewMode,shipPreviewMode,marketingCaptureMode} from './dev-flags';
import {meteorHud} from './meteor-hud';
import {NOVA_REVIVE_COST,canSpendNova} from './nova';
import {rewardedAds} from './rewarded-ads';
import {openNovaAdDialog} from './nova-ad-dialog';
import {billing,NOVA_PACKS,type NovaProductId} from './billing';
import {createPurchaseDelivery} from './purchase-delivery';
import {createNovaRecovery,recoveryOffer} from './nova-recovery';
import {novaRecoveryButton} from './nova-recovery-ui';
import {revivePreviewMode} from './dev-flags';

const ui=document.querySelector<HTMLElement>('#ui')!,canvas=document.querySelector<HTMLCanvasElement>('#world')!;
type Screen='garage'|'home'|'aliens'|'routes'|'settings'|'store'|'exit'|'loading'|'race'|'pause'|'countdown'|'result'|'crash'|'revive';
const bikeTracker=new BikeProgressTracker();let garagePreview=0,masterySavedAt=0;let garagePointer:number|undefined,garagePointerX=0;
let thermalMonitor:ThermalMonitor|undefined;
const thermalNotice=new ThermalNoticeSession();
let thermalToast=false;
let powerMonitor:PowerMonitor|undefined;
let externalMusicMonitor:ExternalMusicMonitor|undefined;let externalMusicPlaying=false,musicDetectionSupported=Capacitor.isNativePlatform();
let musicModeActive=false;
const musicOfferSession=new MusicOfferSession();let musicOfferTimer:ReturnType<typeof setTimeout>|undefined;
let screen:Screen='home',previous:Screen='home',save:Save,race:Race|undefined,world:World;
let lastProfileRender=0;let perfSamples:number[][]=[];let perfReportAt=0;let renderElapsed=0;let wasRacing=false;let crashTime=0;let timer=0,last=0,accumulator=0,countdown=0,noticeTime=0,loading=false,appActive=true,resumeAfterBackground=false;
let firePointer:number|undefined;let fireOrigin={x:0,y:0,radius:28,aimX:.5,aimY:.4};
let hud:Record<string,HTMLElement>={};let fps=0,ratio=1;const sound=new Sound();
const rankAwards=new RaceBadgeAwards(level=>{
 if(!save?.bikeProgress)return;
 save.bikeProgress.celebrated=Math.max(save.bikeProgress.celebrated,level);persist(true);
 sound.play('goal');if(save.vibration)navigator.vibrate?.([18,45,30]);
});
let recoveryAdPending=false,framesReady=false,recoveryNotice='',recoveryAwaitingPayment=false;
const purchaseSyncs=new Set<Promise<void>>();
const recoveryBusy=()=>recoveryAdPending||novaRecovery.busy;
let lesson:FlightLesson|undefined;
let storeReturn:Screen='home',purchasingProduct:NovaProductId|undefined,storeMessage='';
const steering=steeringInput(ui,()=>screen==='race'&&!!race,dir=>{race!.changeLane(dir);dispatchEvents();});
const fmt=formatNumber;
const clock=(s:number)=>`${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
const arrow='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.7"/></svg>';
const gear='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 3-.6 2.3-2 .9-2.1-.6-2 3.4 1.6 1.7v2.5L2.3 15l2 3.4 2.2-.6 2 .9L9 21h4l.6-2.3 2-.9 2.1.6 2-3.4-1.6-1.7v-2.5L19.7 9l-2-3.4-2.2.6-2-.9L13 3H9Z" stroke="currentColor"/><circle cx="11" cy="12" r="3" stroke="currentColor"/></svg>';
const brandWordmark='<img class="brand-wordmark" src="/ion-rush-wordmark.png" width="1024" height="366" alt="ION RUSH" />';
const frames=new DemandFrameLoop(frame,()=>{last=performance.now();renderElapsed=0;});
function persist(deferred=false){updateReminderBest(save);const pending=deferred?scheduleSave(save):writeSave(save);void pending.catch(()=>toast(t('event.saveFailed')));return pending;}
function header(back=false,backAction="home"){return `<header class="topbar"><button class="brand" data-action="home" aria-label="${t('common.mainMenu')}">${screen==='home'?'RVLTN FACTORY':brandWordmark}</button><div class="topright">${screen==='routes'?`<button class="archive-button" data-action="aliens" aria-label="${t('archive.title')}">✦ ${t('archive.title')} <b>${ALIEN_KINDS.filter(k=>save.alienLog[k]?.seen).length}/${ALIEN_KINDS.length}</b></button>`:''}<span class="status-dot"></span><span class="tiny">${back?t('header.missionControl'):t('header.offlineReady')}</span><button class="icon-button" data-action="${back?backAction:'settings'}" aria-label="${back?t('common.back'):t('common.settings')}">${back?icons.close:gear}</button>${!back&&screen==='home'&&Capacitor.getPlatform()!=='ios'?`<button class="icon-button exit-button" data-action="exit" aria-label="${t('common.exit')}">${icons.exit}</button>`:''}</div></header>`;}
function footer(){return `<footer><span>${t('footer.division')} <b> / </b> 2249</span><span class="footer-center">${t('footer.tagline')}</span><span>v0.52 <i class="status-dot"></i></span></footer>`;}
function setScreen(next:Screen){const from=screen;if(next==='home'||next==='loading'||next==='exit')runTelemetry.end(race?.failed?'death':next==='loading'?'restart':'quit');if(next==='race'&&race&&from!=='revive')runTelemetry.start(race,save.journey.distance);steering.clear();if(next!=='race'){thermalToast=false;noticeTime=0;}screen=next;syncMenuMusic();const shade=next==='race'||next==='countdown';ui.className=`screen-${next}${shade?' hud-in-canvas':''}`;world?.setHudShade(shade);document.body.dataset.screen=next;frames.invalidate();queueMicrotask(updateMusicOffer);}
function menuMusicScreen(){return screen==='garage'||screen==='home'||screen==='routes'||screen==='aliens'||screen==='settings'&&previous==='home'||screen==='store'&&storeReturn==='home';}
function syncMenuMusic(){sound.setMenu(menuMusicScreen());}
function home(){setTimeout(()=>void reminderHome(save),700);if(loading||recoveryBusy())return;checkpointBike();sound.evolution=save.bikeProgress!.selected;world.bike.userData.setEvolution(save.bikeProgress!.selected);setScreen('home');sound.update(false,0);world.showMenu(ROUTES[0]);ui.innerHTML=`${header()}<section class="home-copy"><div class="home-kicker"><i></i> ${t('home.kicker')} <span>${t('home.launchCode')}</span></div><h1 class="home-wordmark"><img src="/ion-rush-wordmark.png" width="1024" height="366" alt="ION RUSH" /></h1><p>${t('home.description')}</p><button class="primary home-launch" data-action="launch" aria-label="${t('home.start')}"><span class="launch-symbol">${icons.turbo}</span><span>${t('home.start')}<small>${t('home.endless')}</small></span>${arrow}</button></section><button class="home-nova" data-action="store" aria-label="${t('store.open')}: ${save.journey.nova} ${t('common.nova')}"><span class="home-nova-gem" aria-hidden="true"><i></i><b></b></span><span class="home-nova-copy"><small>${t('store.vaultLabel')}</small><strong><b>${save.journey.nova}</b><span>${t('common.nova')}</span></strong></span><em aria-hidden="true">+</em></button><div class="home-pilot"><div><small>${t('home.pilot')}</small><strong>${pilotTitleText(save.journey.energy)}</strong></div></div>${garageHome(save.bikeProgress!)}<section class="home-dock" aria-label="${t('home.summary')}"><div class="home-record"><span class="record-icon">↗</span><div><small>${t('home.longest')}</small><strong>${fmt(save.journey.distance)} <span>M</span></strong></div></div><div class="home-energy"><small>${t('home.totalEnergy')}</small><strong>${fmt(save.journey.energy)} <span class="energy-core">${icons.energy}</span></strong></div><button class="home-alien" data-action="aliens" aria-label="${t('archive.title')}"><span class="home-alien-art" aria-hidden="true"><img src="/textures/alien-saucer.png"/><img src="/textures/alien-seraph.png"/></span><span class="map-copy"><small>${t('archive.title')}</small><strong>${ALIEN_KINDS.filter(k=>save.alienLog[k]?.seen).length}<b> / ${ALIEN_KINDS.length}</b> ${t('archive.discovered')}</strong></span><span class="map-arrow">${arrow}</span></button><button class="featured home-map" data-action="routes" aria-label="${t('home.map')}"><span class="map-planets" aria-hidden="true"><i class="earth"></i><i class="luna"></i><i class="mars"></i><i class="jupiter"></i></span><span class="map-copy"><small>${t('home.map')}</small><strong>${t('home.mapPlanets')}</strong></span><span class="map-arrow">${arrow}</span></button></section>`;}
function checkpointBike(durable=true){
 if(!save||!race||!save.bikeProgress)return;
 const result=bikeTracker.record(save.bikeProgress,race);
 if(result.unlocked){persist();rankAwards.enqueue(save.bikeProgress.unlocked);}
 else if(result.changed&&durable)persist();
}
function garage(preview=save.bikeProgress!.selected){
 checkpointBike();rankAwards.reset();garagePreview=Math.max(0,Math.min(7,Math.floor(preview)));setScreen('garage');sound.update(false,0);world.showGarage(garagePreview);ui.innerHTML=header(true)+garageMarkup(save.bikeProgress!,garagePreview);
 const p=save.bikeProgress!;
 if(p.celebrated<p.unlocked){const old=p.celebrated;p.celebrated=p.unlocked;persist();const banner=document.createElement('div');banner.className='garage-award';banner.setAttribute('role','status');banner.textContent=t('garage.awarded',{name:BIKE_TIERS[p.unlocked].name});ui.append(banner);world.bike.userData.setEvolution(old);world.invalidate();sound.play('goal');setTimeout(()=>{if(screen==='garage'&&garagePreview===preview){world.bike.userData.setEvolution(garagePreview);world.invalidate();ui.classList.add('garage-reveal');}},400);setTimeout(()=>banner.remove(),3500);}
}
function equipBike(level:number){const p=save.bikeProgress!;if(!Number.isInteger(level)||level<0||level>p.unlocked)return;p.selected=level;sound.evolution=level;save.livery=level===7?'event-horizon':'classic';persist();garage(level);}
function routes(){setScreen('routes');world.showMenu(ROUTES[0]);ui.innerHTML=`${header(true)}<section class="route-content"><div class="section-heading"><div><div class="eyebrow">${t('routes.eyebrow')}</div><h2>${t('routes.title')}</h2></div><p>${t('routes.description')}</p></div><div class="route-grid">${ROUTES.map(p=>`<article class="route-card" data-destination="${p.id}" data-locked="${save.journey.distance<p.start}" style="--planet-accent:${p.color}"><div class="card-top"><span>${routeText(p.id,'label')}</span><span>${save.journey.distance>=p.start?'◈':'◇'}</span></div><div class="card-planet ${p.id}"><span></span></div><div class="card-bottom"><span>${routeText(p.id,'difficulty')}</span><h3>${routeText(p.id,'name')}</h3><p>${routeText(p.id,'subtitle')}</p><div class="card-stats"><span>${fmt(p.start)} M →</span><span>${t('routes.continuous')}</span></div></div></article>`).join('')}</div><div class="launch-row"><div class="mission-info"><span class="mission-number">∞</span><div><strong>${t('routes.afterMars')}</strong><p>${t('routes.instructions')}</p><div class="objectives"><span>${t('routes.planets')}</span><span>◇ ${fmt(50000)} m · ${t('route.singularity.name')}</span><span>${t('routes.swipe')}</span></div></div></div><button class="primary" data-action="launch">${t('routes.startEarth')} ${arrow}</button></div></section>${footer()}`;telemetry.emit('archive_opened',{archive:'journey',discovered:ROUTES.filter(p=>save.journey.distance>=p.start).length});watchArchiveCards(ui,'journey');}
function aliens(){setScreen('aliens');world.showMenu(ROUTES[0]);ui.innerHTML=header(true)+alienArchive(save.alienLog);telemetry.emit('archive_opened',{archive:'aliens',discovered:ALIEN_KINDS.filter(k=>save.alienLog[k]?.seen).length});watchArchiveCards(ui,'aliens');}
function exitGame(){const saved=persist();sound.update(false,0);if(Capacitor.getPlatform()==='android'){void saved.then(()=>App.exitApp(),()=>{});return;}setScreen('exit');ui.innerHTML=`${header(true)}<section class="modal exit-panel"><span class="exit-mark">${icons.exit}</span><div class="eyebrow">${t('exit.eyebrow')}</div><h2>${t('exit.title')}</h2><p>${t('exit.body')}</p><button class="primary" data-action="home">${t('exit.return')} ${arrow}</button></section>`;}
function applyControls(){document.body.dataset.reach=save.controls;document.body.dataset.buttonSize=save.buttonSize;}
function closeSettings(){if(previous==='pause'){screen='race';pause();}else home();}
function settings(){previous=screen==='pause'?'pause':'home';setScreen('settings');ui.innerHTML=`${header(true,'settingsBack')}<section class="modal settings"><div class="settings-heading"><div class="eyebrow">${t('settings.eyebrow')}</div><h2>${t('settings.title')}</h2></div><div class="settings-grid">${analyticsSetting()}${reminderSetting()}
${rewardedAds.current.privacyOptionsRequired?`<div class="setting-row"><div><strong>${t('settings.adPrivacy')}</strong><small>${t('settings.adPrivacyHint')}</small></div><button class="secondary setting-action" data-action="adPrivacy">${t('settings.review')}</button></div>`:''}
<div class="setting-row"><div><strong>${t('settings.sound')}</strong><small>${t('settings.soundHint')}</small></div><button class="toggle ${save.sound?'on':''}" data-action="sound" aria-label="${t('settings.sound')}" aria-pressed="${save.sound}"><span></span></button></div>
<div class="setting-row menu-music-setting" data-external-music="${musicModeActive}"><div><strong>${t('settings.music')}</strong><small>${t(musicModeActive?'settings.musicModeActive':'settings.musicHint')}</small><label class="menu-track-label" for="menu-track">${t('settings.menuTrack')}</label><select id="menu-track" aria-label="${t('settings.menuTrack')}">${MENU_TRACKS.map(track=>`<option value="${track.id}" ${cleanMenuTrack(save.menuTrack)===track.id?'selected':''}>${track.title}</option>`).join('')}</select></div><button class="toggle ${save.music?'on':''}" data-action="music" ${musicModeActive?'disabled':''} aria-label="${t('settings.music')}" aria-pressed="${save.music}"><span></span></button></div>
<div class="setting-row"><div><strong>${t('settings.musicSuggestions')}</strong><small>${t('settings.musicSuggestionsHint')}</small></div><button class="toggle ${save.musicSuggestions!==false?'on':''}" data-action="musicSuggestions" aria-label="${t('settings.musicSuggestions')}" aria-pressed="${save.musicSuggestions!==false}"><span></span></button></div>
${musicModeActive?`<div class="setting-row audio-level-row"><div><strong>${t('settings.effectsVolume')}</strong><small>${t('settings.effectsVolumeHint')}</small></div><label class="audio-level"><input id="effects-volume" type="range" min="0" max="100" step="1" value="${Math.round((save.effectsVolume??.65)*100)}" aria-label="${t('settings.effectsVolume')}"/><output for="effects-volume">${Math.round((save.effectsVolume??.65)*100)}%</output></label></div>`:''}
<div class="setting-row"><div><strong>${t('settings.haptics')}</strong><small>${t('settings.hapticsHint')}</small></div><button class="toggle ${save.vibration?'on':''}" data-action="vibration" aria-label="${t('settings.haptics')}" aria-pressed="${save.vibration}"><span></span></button></div>
<div class="setting-row"><div><strong>${t('settings.quality')}</strong><small>${t('settings.qualityHint')}</small></div><select id="quality" aria-label="${t('settings.quality')}"><option value="auto">${t('settings.qualityAuto')}</option><option value="low">${t('settings.qualityLow')}</option><option value="high">${t('settings.qualityHigh')}</option></select></div>
<div class="setting-row"><div><strong>${t('settings.controls')}</strong><small>${t('settings.controlsHint')}</small></div><select id="controls" aria-label="${t('settings.controls')}"><option value="edge">${t('settings.controlsEdge')}</option><option value="balanced">${t('settings.controlsBalanced')}</option><option value="inset">${t('settings.controlsInset')}</option></select></div>
<div class="setting-row"><div><strong>${t('settings.buttonSize')}</strong><small>${t('settings.buttonSizeHint')}</small></div><select id="button-size" aria-label="${t('settings.buttonSize')}"><option value="normal">${t('settings.buttonNormal')}</option><option value="large">${t('settings.buttonLarge')}</option></select></div>
<div class="setting-row"><div><strong>${t('livery.title')}</strong><small>${save.eventHorizonUnlocked?t('livery.unlocked'):t('livery.locked')}</small></div><select id="livery" aria-label="${t('livery.title')}"><option value="classic" ${save.livery==='classic'?'selected':''}>VESPER — 07</option><option value="event-horizon" ${save.livery==='event-horizon'?'selected':''} ${save.eventHorizonUnlocked?'':'disabled'}>${t('livery.horizon')}</option></select></div>
<div class="setting-row"><div><strong>${t('settings.language')}</strong><small>${t('settings.languageHint')}</small></div><select id="language" aria-label="${t('settings.language')}">${supportedLocales.map(locale=>`<option value="${locale.id}">${locale.label}</option>`).join('')}</select></div></div>
<div class="settings-bottom"><div><p>${t('settings.controlsHelp')}</p><div class="settings-help-links"><button class="privacy" data-action="privacyInfo">${t('settings.privacyTitle')}</button></div></div><button class="secondary lesson-replay" data-action="learnControls" aria-pressed="${save.tutorialReplayQueued===true}">${t(save.tutorialReplayQueued?'lesson.queued':'lesson.replay')}</button><button class="primary" data-action="settingsBack">${t('common.done')} ${arrow}</button></div></section>`;(document.querySelector('#quality')as HTMLSelectElement).value=save.quality;(document.querySelector('#controls')as HTMLSelectElement).value=save.controls;(document.querySelector('#button-size')as HTMLSelectElement).value=save.buttonSize;(document.querySelector('#language')as HTMLSelectElement).value=save.language;}
async function toggleMusicMode(button:HTMLElement|undefined,enabled=musicModeActive!==true){
 if(enabled&&save.musicSuggestions===false)return;
 const before=musicModeActive===true,back=previous;
 if(button)(button as HTMLButtonElement).disabled=true;
 try{await sound.setMusicMode(enabled,save.effectsVolume??.65);musicModeActive=enabled;if(musicModeActive)musicOfferSession.dismiss();await persist();sound.update(screen==='race',race?.speed??0);sound.uiClick();}
 catch(error){console.warn('Music mode change failed',error);musicModeActive=before&&save.musicSuggestions!==false;await sound.setMusicMode(musicModeActive,save.effectsVolume??.65).catch(()=>{});toast(t('settings.audioError'));}
 finally{if(screen==='settings'){settings();previous=back;}else updateMusicOffer();}
}
function updateMusicOffer(){
 if(musicOfferTimer!==undefined){clearTimeout(musicOfferTimer);musicOfferTimer=undefined;}
 const eligible=!!save&&musicOfferEligible(save,externalMusicPlaying);
 const remaining=musicOfferSession.remaining(screen,eligible,performance.now());
 if(!remaining){ui.querySelector('.music-offer')?.remove();return;}
 if(!ui.querySelector('.music-offer')){
  const offer=document.createElement('div');offer.className='music-offer';offer.setAttribute('role','status');
  offer.innerHTML=`<span>${t('settings.musicDetected')}</span><button data-action="enableMusicMode">${t('settings.enableMusicMode')}</button><button class="music-offer-close" data-action="dismissMusicOffer" aria-label="${t('common.done')}">×</button>`;
  ui.append(offer);
 }
 musicOfferTimer=setTimeout(()=>{musicOfferTimer=undefined;musicOfferSession.dismiss();ui.querySelector('.music-offer')?.remove();},remaining);
}
function externalMusicChanged(status:{supported:boolean;playing:boolean}){
 const changed=externalMusicPlaying!==status.playing||musicDetectionSupported!==status.supported;
 externalMusicPlaying=status.playing;musicDetectionSupported=status.supported;
 if(!status.playing){musicOfferSession.reset();if(musicModeActive)void toggleMusicMode(undefined,false);}
 if(!changed)return;
 if(screen==='settings'&&save){const back=previous;settings();previous=back;}else updateMusicOffer();
}
async function launch(preview=riftPreviewMode()){if(loading||recoveryBusy())return;loading=true;recoveryNotice='';recoveryAwaitingPayment=false;musicOfferSession.beginRun();musicModeActive=false;lesson=undefined;setScreen('loading');const audioReady=Promise.all([sound.unlock(),sound.setMusicMode(false,save.effectsVolume??.65)]).catch(()=>{});checkpointBike();sound.evolution=save.bikeProgress!.selected;world.bike.userData.setEvolution(save.bikeProgress!.selected);race=new Race(crypto.getRandomValues(new Uint32Array(1))[0],save.bikeProgress!.selected);if(supportPreviewMode()){const mode=supportPreviewMode();race.z=10500;race.lastStage=race.route.id;race.support.unlocked=mode!=='locked';race.support.charge=mode==='ready'?1:mode==='charging'?.58:0;if(mode==='locked')race.z=9800;race.ensureCourse();}if(shipPreviewMode()){race.z=19000;race.lastStage=race.route.id;race.goals=new Set(RUN_GOALS.map(g=>g.id));race.riftStream.nextZ=100000;race.rifts=[];race.ship.core={z:19150,surface:0,lane:0};race.ship.nextZ=100000;race.ensureCourse();race.gates=race.gates.filter(g=>g.z>19240);}else if(preview){const start={blue:7000,violet:30000,black:44000}[preview],jump={blue:650,violet:1200,black:2000}[preview],points={blue:400,violet:900,black:2000}[preview];race.z=start;race.lastStage=race.route.id;race.goals=new Set(RUN_GOALS.filter(goal=>goal.stat!=='z'||goal.target<=start).map(goal=>goal.id));race.riftStream.nextZ=100000;race.rifts=[{id:999,z:start+230,kind:preview,surface:0,lane:0,jump,points}];race.ensureCourse();race.gates=race.gates.filter(g=>g.z>start+390);}rankAwards.reset();if(save.bikeProgress!.celebrated<save.bikeProgress!.unlocked)rankAwards.enqueue(save.bikeProgress!.unlocked);bikeTracker.start(race);ui.innerHTML=journeyLoadingMarkup(routeText(race.route.id,'name'));
  try{await new Promise<void>(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));await audioReady;await sound.prepare();await world.prepare(race,(p,label)=>{updateJourneyLoading(ui,p,label);});loading=false;save.tutorial=cleanTutorial(save.tutorial,save.journey.runs);if(race.z===0&&!preview&&!shipPreviewMode()&&!revivePreviewMode()&&!marketingCaptureMode()&&(save.tutorialReplayQueued===true||needsTutorial(save.tutorial))){if(takeTutorialReplay(save))persist();lesson=new FlightLesson(race,save.tutorial,persist,()=>{sound.play('boost');if(save.vibration)navigator.vibrate?.([18,35,35]);toast(t('lesson.live'));});}if(revivePreviewMode()){race.failed=true;race.health=0;revivePrompt();}else beginCountdown();if(preview||!appActive)pause();}catch(e){loading=false;ui.innerHTML=`<section class="modal"><h2>${t('loading.failedTitle')}</h2><p>${t('loading.failedBody')}</p><button class="primary" data-action="home">${upper(t('common.mainMenu'))}</button></section>`;console.error(e);}
}
function drawHud(){ui.innerHTML=raceHudMarkup(race!);hud={};ui.querySelectorAll<HTMLElement>('[id]').forEach(e=>hud[e.id]=e);}
function stopFire(clearTap=true){if(race){race.firing=false;race.aimX=0;race.aimY=0;race.touchAim=undefined;if(clearTap)race.combat.tapShot=undefined;}firePointer=undefined;ui.classList.remove('shooting');hud.fire?.style.setProperty('--aim-x','0px');hud.fire?.style.setProperty('--aim-y','0px');}
function beginCountdown(){stopFire();setScreen('countdown');drawHud();ui.classList.add('launch-arrival');countdown=3;accumulator=0;sound.unlock().catch(()=>{});}
function pause(){stopFire();if(screen!=='race'&&screen!=='countdown')return;setScreen('pause');sound.update(false,0);ui.innerHTML=`<section class="modal pause"><div class="eyebrow">${t('pause.eyebrow')}</div><h2>${t('pause.title')}</h2><p>${t('pause.body')}</p><button class="primary" data-action="resume">${t('pause.resume')} ${arrow}</button><button class="secondary" data-action="restart">${t('pause.restart')}</button><div class="pause-links"><button data-action="settings">${upper(t('common.settings'))}</button><button data-action="home">${upper(t('common.mainMenu'))}</button></div></section>`;persist();}
function novaCoreMarkup(){return `<div class="nova-reactor" aria-hidden="true"><span class="nova-aura"></span><i class="nova-orbit nova-orbit-a"><b></b></i><i class="nova-orbit nova-orbit-b"><b></b></i><span class="nova-shard"><i></i><b></b><em></em></span><span class="nova-flare"></span></div>`;}
function openStore(){if(recoveryBusy())return;void novaArtwork.prepare().catch(()=>{});if(screen==='revive')storeReturn='revive';else storeReturn='home';storeMessage='';store();void billing.refresh().then(()=>{if(screen==='store')store();});}
function closeStore(){if(recoveryBusy())return;const adDialog=document.querySelector('dialog[open]');if(adDialog){adDialog.dispatchEvent(new Event('cancel',{cancelable:true}));return;}if(storeReturn==='revive'&&race?.failed)revivePrompt();else home();}
function store(){if(screen==='store'&&ui.querySelector('.nova-store')){refreshStoreUi();return;}setScreen('store');sound.update(false,0);const status=billing.current;ui.innerHTML=`${header(true,'storeBack')}<section class="nova-store"><div class="store-intro"><div class="store-hero"><img decoding="sync" loading="eager" src="/textures/nova-store-pilot-v3.png" width="1024" height="1536" alt="" aria-hidden="true"/><div class="store-pilot-message"><span>${t('store.hero.lead')}</span><strong>${t('store.hero.chance')}</strong><i></i></div></div></div><div class="store-copy"><div class="eyebrow"><i></i>${t('store.eyebrow')}</div><h2>${t('store.title')}</h2><p>${t('store.body')}</p><p data-store-debt role="status" ${save.novaDebt?'':'hidden'}>${save.novaDebt?t('store.refundDebt',{count:save.novaDebt}):''}</p><div class="store-wallet"><button class="nova-ad-entry" data-action="novaAd" aria-label="${t('ad.entry')}"><span class="nova-ad-play" aria-hidden="true">▶</span><span class="nova-ad-copy"><strong>${t('ad.watch')}</strong><small>${t('ad.earn')}</small></span></button><div class="store-balance"><span>${t('store.balance')}</span><strong><i></i><span data-store-balance>${save.journey.nova} ${t('common.nova')}</span></strong></div></div></div><div class="store-products">${NOVA_PACKS.map(pack=>{const product=status.products.find(item=>item.id===pack.id),busy=purchasingProduct===pack.id,available=product?.available===true;return `<article class="store-pack ${pack.tier}" data-pack="${pack.tier}"><div class="pack-tag">${t(`store.${pack.tier}.tag`)}</div><div class="pack-art pack-art-${pack.tier}" aria-hidden="true">${pack.tier==='spark'?Array.from({length:5},(_,index)=>`<img decoding="sync" loading="eager" class="pack-crystal crystal-${index+1}" src="/textures/nova-store-core.png" alt=""/>`).join(''):`<img decoding="sync" loading="eager" class="pack-container" src="/textures/nova-pack-${pack.tier}.png" alt=""/>`}<i></i><b></b></div><div class="pack-amount"><strong>${pack.nova}</strong><span>${t('common.nova')}</span></div><h3>${t(`store.${pack.tier}.name`)}</h3><p>${t(`store.${pack.tier}.body`)}</p><button data-action="buyNova" data-product="${pack.id}" ${available&&!purchasingProduct?'':'disabled'}><span class="${available&&!busy?'pack-price':''}">${busy?t('store.processing'):available?product!.price:t(status.reason==='not_configured'||status.configured?'store.unavailable':'store.connecting')}</span>${!busy&&available?arrow:''}</button></article>`;}).join('')}</div><div class="store-foot"><span>${storeMessage||t('store.terms')}</span><button data-action="restorePurchases">${t('store.sync')}</button></div></section>`;}
function refreshStoreUi(){
 const status=billing.current;
 for(const pack of NOVA_PACKS){
  const button=ui.querySelector<HTMLButtonElement>(`[data-product="${pack.id}"]`);if(!button)continue;
  const product=status.products.find(item=>item.id===pack.id),busy=purchasingProduct===pack.id,available=product?.available===true;
  button.disabled=!available||!!purchasingProduct;
  const price=button.querySelector('span')!;const text=busy?t('store.processing'):available?product!.price:t(status.reason==='not_configured'||status.configured?'store.unavailable':'store.connecting');
  if(price.textContent!==text)price.textContent=text;price.classList.toggle('pack-price',available&&!busy);
  const icon=button.querySelector('svg');if(available&&!busy){if(!icon)button.insertAdjacentHTML('beforeend',arrow);}else icon?.remove();
 }
 const balance=ui.querySelector('[data-store-balance]');if(balance)balance.textContent=`${save.journey.nova} ${t('common.nova')}`;
 const debt=ui.querySelector<HTMLElement>('[data-store-debt]');if(debt){debt.hidden=!save.novaDebt;debt.textContent=save.novaDebt?t('store.refundDebt',{count:save.novaDebt}):'';}
 const message=ui.querySelector('.store-foot>span');if(message)message.textContent=storeMessage||t('store.terms');
}
const applyPurchaseClaims=createPurchaseDelivery(()=>save,()=>writeSave(save),billing);
const novaRecovery=createNovaRecovery<Race>({
 wallet:()=>save,
 canRestore:r=>screen==='revive'&&race===r&&r.failed&&r.revives<SURVIVAL.maxRevives,
 restore:r=>r.revive(),persist:()=>writeSave(save),purchase:id=>billing.purchase(id),
 deliver:applyPurchaseClaims,prepare:async()=>{await Promise.allSettled([...purchaseSyncs]);await sound.unlock().catch(()=>{});},
 busyChanged:busy=>{if(busy){ui.querySelectorAll<HTMLButtonElement>('.run-summary button').forEach(b=>b.disabled=true);const b=ui.querySelector('.nova-continue strong');if(b)b.textContent=t('recovery.processing');}}
});
async function continueWithNova(buy=false){
 if(screen!=='revive'||!race||recoveryBusy()||purchasingProduct||buy&&recoveryAwaitingPayment)return;
 const returningRace=race,offer=buy?recoveryOffer(save,billing.current.products):undefined;
 if(buy&&!offer&&!canSpendNova(save.journey.nova))return;
 recoveryNotice='';recoveryAwaitingPayment=false;purchasingProduct=offer?.id;
 document.body.classList.add('billing-open');
 try{
  const result=await novaRecovery.continue(returningRace,offer?.id);
  if(result.status==='restored'){await finishRestore();return;}
  if(result.status==='cancelled')recoveryNotice=t('recovery.cancelled');
  else if(result.status==='pending'){recoveryAwaitingPayment=true;recoveryNotice=t('recovery.pending');}
  else if(result.status==='deliveryRetry')recoveryNotice=t('store.deliveryRetry');
  else if(result.status==='saveFailed')recoveryNotice=t('event.saveFailed');
  else if(result.status==='notEnough')recoveryNotice=t('revive.notEnough');
  else if(result.status==='failed')recoveryNotice=t(result.reason==='network_error'?'store.networkError':result.reason==='product_unavailable'?'store.unavailable':'store.failed');
 }catch{recoveryNotice=t('store.failed');}
 finally{
  document.body.classList.remove('billing-open');purchasingProduct=undefined;
  if(screen==='revive'&&race===returningRace)revivePrompt();
 }
}
function refreshRecoveryButton(){
 if(screen!=='revive'||recoveryBusy())return;
 if(recoveryAwaitingPayment&&canSpendNova(save.journey.nova)){recoveryAwaitingPayment=false;recoveryNotice='';const note=ui.querySelector('.recovery-status');if(note)note.textContent='';}
 const button=ui.querySelector('.nova-continue');if(button)button.outerHTML=novaRecoveryButton(save,billing.current,false,recoveryAwaitingPayment);
}

async function buyNova(productId:NovaProductId){
  if(screen!=='store'||purchasingProduct)return;
  purchasingProduct=productId;storeMessage='';store();
  document.body.classList.add('billing-open');
  try{
    const result=await billing.purchase(productId);
    if(result.pending)storeMessage=t('store.pending');
    else if(result.purchased){try{const delivered=await applyPurchaseClaims();storeMessage=delivered?t('store.delivered',{count:delivered}):t('store.syncComplete');if(delivered&&save.vibration)navigator.vibrate?.([25,35,65]);sound.play('goal');}catch{storeMessage=t('store.deliveryRetry');}}
    else if(result.reason!=='cancelled')storeMessage=t(result.reason==='network_error'?'store.networkError':result.reason==='product_unavailable'?'store.unavailable':'store.failed');
  }finally{
    document.body.classList.remove('billing-open');
    purchasingProduct=undefined;
    await billing.refresh();
    if(screen==='store')store();
  }
}
function syncPurchases(showMessage=true):Promise<void>{
 if(novaRecovery.busy)return Promise.resolve();
 const task=performPurchaseSync(showMessage).finally(()=>purchaseSyncs.delete(task));
 purchaseSyncs.add(task);return task;
}
async function performPurchaseSync(showMessage:boolean){
 const synced=await billing.sync(showMessage);
 if(novaRecovery.busy)return;
 if(showMessage)await billing.refresh();
 try{
  const delivered=await applyPurchaseClaims();
  if(showMessage)storeMessage=delivered?t('store.delivered',{count:delivered}):t(!synced||billing.current.reason==='network_error'?'store.networkError':billing.current.ready?'store.syncComplete':'store.unavailable');
 }catch{if(showMessage)storeMessage=t('store.deliveryRetry');}
 if(screen==='store')store();else if(screen==='revive')refreshRecoveryButton();
}
async function initializeCommerce(){await billing.observeClaims(()=>{if(novaRecovery.busy)return;void syncPurchases(false).then(()=>{if(novaRecovery.busy)return;if(screen==='home')home();else if(screen==='revive')revivePrompt();});}).catch(()=>{});await billing.initialize();await syncPurchases(false);if(screen==='store')store();else if(screen==='home')home();else if(screen==='revive')refreshRecoveryButton();}
// Recover delayed payments even when Play does not deliver a callback, and
// reconcile refunds while the player leaves the app open in the menu.
let commercePolling=false;
setInterval(()=>{
 if(commercePolling||document.hidden||purchasingProduct||novaRecovery.busy||!['home','store','revive'].includes(screen)||document.querySelector('.nova-ad-dialog'))return;
 commercePolling=true;
 const before=save.journey.nova;
 void syncPurchases(false).then(()=>{if(novaRecovery.busy)return;if(before!==save.journey.nova){if(screen==='home')home();else if(screen==='revive')revivePrompt();}}).finally(()=>{commercePolling=false;});
},60000);
function revivePrompt(){
  if(!race||novaRecovery.busy)return;
  checkpointBike();const r=race,canRecover=r.revives<SURVIVAL.maxRevives,record=saveRunProgress(save,r);
  persist();if(!canRecover)runTelemetry.end('death');
  setScreen(canRecover?'revive':'result');sound.update(false,0);
  const canPay=canSpendNova(save.journey.nova);if(canPay&&recoveryAwaitingPayment){recoveryAwaitingPayment=false;recoveryNotice='';}
  ui.innerHTML=`<section class="run-summary" aria-label="${t('run.summary')}">
    <header class="run-summary-head"><span>${brandWordmark}<i>/</i> ${t('run.report')}</span></header>
    <div class="run-summary-body">
      <div class="run-report">${canRecover?'<div class="run-pilot" aria-hidden="true"><img src="/textures/nova-pilot-cutout.png" alt=""/></div>':''}<div class="eyebrow">${routeText(r.route.id,'name')} · ${clock(r.elapsed)}</div><h2>${canRecover?t('event.signalLost'):t('results.title')}</h2>
        <div class="run-distance"><strong>${fmt(r.z)}</strong><span>${t('run.metres')}</span></div>
        <div class="run-record ${record?'is-record':''}">${record?t('run.newBest'):t('run.best',{distance:fmt(save.journey.distance)})}</div>
        <div class="run-metrics"><div><span>${t('hud.score')}</span><strong>${fmt(r.score)}</strong></div><div><span>${t('run.aliens')}</span><strong>${r.combat.kills}</strong></div><div><span>${t('results.bestCombo')}</span><strong>${r.bestCombo}<small>×</small></strong></div><div><span>${t('common.energy')}</span><strong>${r.energy}</strong></div></div>
        <div class="run-objectives">${r.goals.size} / ${RUN_GOALS.length} ${t('run.objectives')}</div>${garageRun(save.bikeProgress!)}
      </div>
      <aside class="run-recovery"><div class="eyebrow">${canRecover?(SURVIVAL.maxRevives-r.revives===1?t('run.lastChance'):t('run.notOver')):t('run.next')}</div><h3>${canRecover?t('run.reignite'):t('run.stars')}</h3><p>${canRecover?t('run.recoveryBody'):t('run.finalBody')}</p>
      ${canRecover?`<div class="revive-actions">${novaRecoveryButton(save,billing.current,recoveryBusy(),recoveryAwaitingPayment)}<button class="ad-continue" data-action="reviveAd" disabled><span class="ad-play">▶</span><span><strong>${t('run.watch')}</strong><small data-ad-label>${t('revive.connecting')}</small></span></button></div><p class="recovery-status" role="status" aria-live="polite">${recoveryNotice||(!canPay?t('recovery.need',{count:Math.max(0,NOVA_REVIVE_COST-save.journey.nova)}):'')}${!canPay&&save.novaDebt?' '+t('store.refundDebt',{count:save.novaDebt}):''}</p><div class="run-recovery-foot"><span>${t(SURVIVAL.maxRevives-r.revives===1?'run.remainingOne':'run.remaining',{count:SURVIVAL.maxRevives-r.revives})}</span><button data-action="store">${t('run.store')}</button></div>`:`<div class="run-final-mark"><div class="run-final-portrait"><img src="/textures/nova-pilot-cutout.png" alt=""/></div><div><span>${t('run.none')}</span><small>${t('run.newFlight')}</small></div></div>`}</aside>
    </div><footer class="run-summary-footer"><button class="secondary" data-action="home">${upper(t('common.mainMenu'))}</button><span>${canRecover?t('run.safe'):t('run.ready')}</span><button class="primary" data-action="restart">${t('results.flyAgain')} ${arrow}</button></footer>
  </section>`;
  if(recoveryBusy())ui.querySelectorAll<HTMLButtonElement>('.run-summary button').forEach(b=>b.disabled=true);
  if(canRecover&&!recoveryBusy()){void refreshReviveAd();void billing.refresh().then(refreshRecoveryButton);}
}
async function refreshReviveAd(){const status=await rewardedAds.refresh(),button=ui.querySelector<HTMLButtonElement>('[data-action="reviveAd"]'),label=button?.querySelector<HTMLElement>('[data-ad-label]');if(screen!=='revive'||!button||!label||recoveryBusy())return;button.disabled=!status.ready;label.textContent=status.ready?t('revive.adReady'):status.configured?t('revive.loadingAd'):t('revive.unavailable');if(!status.ready&&status.configured)setTimeout(()=>{if(screen==='revive')void refreshReviveAd();},1200);}
async function finishRestore(){
 const returningRace=race;
 // Store/payment and rewarded-ad sheets may suspend audio after the initial tap.
 // Reopen it after returning, before the engine, music and recovery effects start.
 if(appActive&&!document.hidden)await sound.unlock().catch(()=>{});
 if(screen!=='revive'||race!==returningRace)return;
 setScreen('race');drawHud();updateHud();sound.update(true,race!.speed);dispatchEvents();
 if(save.vibration)navigator.vibrate?.([25,35,70]);toast(t('revive.restored'));
 if(!appActive||document.hidden){resumeAfterBackground=true;pause();}
}
async function restoreRun(spendNova=false){
 if(spendNova){await continueWithNova();return;}
 if(screen!=='revive'||!race||recoveryBusy())return;
 const returningRace=race;await sound.unlock().catch(()=>{});
 if(screen==='revive'&&race===returningRace&&race.revive())await finishRestore();
}
async function watchReviveAd(){
 if(screen!=='revive'||recoveryBusy())return;
 const returningRace=race;recoveryAdPending=true;recoveryNotice='';
 ui.querySelectorAll<HTMLButtonElement>('.run-summary button').forEach(b=>b.disabled=true);
 const label=ui.querySelector<HTMLElement>('[data-ad-label]');if(label)label.textContent=t('revive.watching');
 try{const result=await rewardedAds.show();recoveryAdPending=false;
  if(screen!=='revive'||race!==returningRace)return;
  if(result.rewarded){await restoreRun();return;}recoveryNotice=t('revive.adFailed');
 }catch{recoveryNotice=t('revive.adFailed');}
 finally{recoveryAdPending=false;if(screen==='revive'&&race===returningRace)revivePrompt();}
}
function toast(text:string){if(thermalToast&&noticeTime>0)return;noticeTime=2.3;if(hud.notice&&screen==='race'){hud.notice.textContent=text;hud.notice.classList.add('show');}}
function replayHudAnimation(el:HTMLElement,name:string){el.classList.remove(name);void el.offsetWidth;el.classList.add(name);}
function updateRewardHud(r:Race){
  const scorePanel=hud.score.parentElement as HTMLElement,oldScore=Number(hud.score.dataset.value??r.score);
  if(r.score>oldScore){scorePanel.dataset.gain='+'+fmt(r.score-oldScore);replayHudAnimation(scorePanel,'score-earned');}
  hud.score.dataset.value=String(r.score);
  const missionPanel=hud.distance.parentElement as HTMLElement,milestone=Math.floor(r.z/250),oldMilestone=Number(hud.distance.dataset.milestone??milestone);
  if(milestone>oldMilestone&&milestone>0){missionPanel.dataset.milestone=t('hud.milestone',{distance:fmt(milestone*250)});replayHudAnimation(missionPanel,'distance-earned');}
  hud.distance.dataset.milestone=String(milestone);
}
function setHudText(el:HTMLElement,value:string){if(el.textContent!==value)el.textContent=value;}
function setHudHtml(el:HTMLElement,value:string){if(el.innerHTML!==value)el.innerHTML=value;}
function setHudFill(el:HTMLElement,value:number){const transform='scaleX('+Math.max(0,Math.min(1,value)).toFixed(4)+')';if(el.style.transform!==transform)el.style.transform=transform;}
function updateHud(){if(!race)return;const r=race;updateSupportHud(ui,r);const distanceText=fmt(r.z)+' ';if(hud.distance.firstChild!.nodeValue!==distanceText)hud.distance.firstChild!.nodeValue=distanceText;setHudText(hud.score,fmt(r.score));setHudText(hud.time,clock(r.elapsed));setHudFill(hud.progress,stageProgress(r.z));setHudText(hud['stage-label'],routeText(r.route.id,'name'));setHudText(hud.sector,r.z<2600?t(r.z<45?'departure.lab':r.z<260?'departure.street':r.z<1070?'departure.city':r.z<1450?'departure.climb':r.z<2180?'departure.clouds':'departure.space'):routeText(r.route.id,'subtitle'));if(hud.lives.dataset.health!==String(r.health)){hud.lives.dataset.health=String(r.health);setHudHtml(hud.lives,Array.from({length:SURVIVAL.maxHealth},(_,i)=>'<span class="'+(i<r.health?'heart-full':'heart-empty')+'">♥</span>').join(''));}hud.lives.setAttribute('aria-label',t('hud.healthAria',{current:r.health,max:SURVIVAL.maxHealth}));setHudText(hud.multiplier,'x'+r.multiplier);setHudText(hud.combo,r.combo?t(r.combo===1?'hud.cleanPassOne':'hud.cleanPassMany',{count:r.combo}):t('hud.cleanLine'));setHudText(hud.speed,String(Math.round(r.speed*3.6)));setHudHtml(hud.power,r.shield?'◈ '+r.shield+'/'+SURVIVAL.shieldHits+' '+t('hud.shield')+' · '+Math.ceil(r.shieldTime)+' '+t('common.seconds'):r.boost>0?'↗ '+t('hud.boost'):'◇ '+t('common.energy')+' <b>'+r.energy+'</b>');
  updateRewardHud(r);
  const healthLabel=hud.lives.nextElementSibling;
  if(healthLabel)setHudText(healthLabel as HTMLElement,t(r.health<=1?'hud.healthCritical':r.health===2?'hud.healthLow':'hud.health'));
  const goal=RUN_GOALS.find(g=>!r.goals.has(g.id));setHudText(hud['goal-label'],goal?goalText(goal.id):t(r.z<50000?'horizon.target':'horizon.reached'));setHudText(hud['goal-value'],goal?Math.min(goal.target,Math.floor(r[goal.stat]))+' / '+goal.target+' · +'+goal.points+' '+t('common.points'):fmt(Math.min(r.z,50000))+' / '+fmt(50000)+' M');setHudFill(hud['goal-fill'],goal?r[goal.stat]/goal.target:r.z/50000);setHudText(hud['reward-next'],r.shield?t('hud.shield')+' · '+r.shield+' '+(r.shield===1?t('hud.hit'):t('hud.hits'))+' / '+Math.ceil(r.shieldTime)+' '+t('common.seconds'):t('hud.shieldOnTrack'));
  for(let i=0;i<2;i++)hud['charge'+i].style.setProperty('--charge',String(i<r.charges?1:i===r.charges?r.recharge/TUNE.recharge:0));
  ui.querySelectorAll<HTMLElement>('[data-face]').forEach(e=>e.classList.toggle('active',Number(e.dataset.face)===r.surface));
  (hud.turbo as HTMLButtonElement).disabled=r.ship.active||!r.boostCharge||r.boost>0;hud.turbo.classList.toggle('ready',!!r.boostCharge);setHudText(hud['turbo-status'],r.boost>0?t('common.turbo')+' · '+r.boost.toFixed(1)+' '+t('common.seconds'):r.boostCharge?t('hud.turboReady'):r.turboEnergy+' / '+TUNE.energyForTurbo+' '+t('common.energy'));setHudFill(hud['turbo-charge'],r.boost>0?r.boost/(TUNE.boostDuration+r.overdrive.extended):r.boostCharge?1:r.turboEnergy/TUNE.energyForTurbo);ui.classList.toggle('turbo-active',r.boost>0);updateRunnerHud(ui,r);updateHunterHud(ui,r);updateVanguardHud(ui,r);updateTitanHud(ui,r);updatePhantomHud(ui,r);updateSingularityHud(ui,r);
  setHudFill(hud.heat,1-r.combat.heat/100);hud.fire.classList.toggle('overheated',r.combat.locked);hud.fire.classList.toggle('phased',!!phaseActive(r));const target=r.combat.enemies.find(e=>e.active&&e.hp>0&&e.surface===r.surface&&e.z>r.z&&e.z-r.z<COMBAT.range);setHudText(hud['target-status'],r.combat.locked?t('hud.cooling')+' · '+r.combat.rearmSeconds(r).toFixed(1)+' '+t('common.seconds'):target?(target.age<ENEMY_ENTRY?t('hud.incoming'):enemyText(target.kind)+' · '+target.hp+' '+t('hud.armor')):t('hud.readyToFire'));
  hud.fire.classList.toggle('target-locked',!!target&&!r.combat.locked);
  const ability=ui.querySelector<HTMLElement>('#ignition-status');if(ability){ability.hidden=!!r.training||r.ship.active||!!r.riftTransit;ability.dataset.ready=String(r.combat.ignition.ready);ability.dataset.venting=String(r.combat.ignition.flash>0);ability.dataset.recharging=String(r.combat.ignition.rechargeRemaining>0);setHudText(ability,ignitionStatus(r));}
  setHudText(hud['lane-dots'],[-1,0,1].map(l=>l===r.lane?'▰':'▱').join(' '));
  const next=r.gates.find(g=>g.z+TUNE.collisionHalfWidth>=r.z),rift=r.rifts.find(item=>!r.resolvedRifts.has(item.id)&&item.z>=r.z&&item.z-r.z<170);let hint='';
  meteorHud(ui,r,sound);
  if(r.ship.notice){toast(t(r.ship.notice==='VESPER RESTORED'?'ship.restored':'ship.ascending'));sound.play('boost');r.ship.notice='';}
  if(r.ship.active)hint=r.ship.elapsed<1?t('ship.deploy'):r.ship.elapsed>11?t('ship.landing')+Math.ceil(14-r.ship.elapsed)+' S':t('ship.mode')+Math.ceil(14-r.ship.elapsed)+t('ship.cannons');
  else if(r.ship.core&&r.ship.core.z-r.z<200)hint=t('ship.core')+Math.ceil(r.ship.core.z-r.z)+' M · '+t('rift.surface')+' '+(r.ship.core.surface+1)+' · '+(r.ship.core.lane<0?t('rift.left'):r.ship.core.lane>0?t('rift.right'):t('rift.center'));
  else if(r.riftTransit)hint=r.riftTransit.mode==='enter'?t('rift.entering'):t('rift.emerging');
  else if(r.z<85)hint=t('hud.outerControls');
  else if(r.riftChallenge){hint=t('rift.stabilize',{seconds:Math.ceil(r.riftChallenge.remaining),lane:r.riftChallenge.targetLane<0?t('rift.left'):r.riftChallenge.targetLane>0?t('rift.right'):t('rift.center')});}
  else if(rift){const diff=wrap(rift.surface-r.surface);hint=t('rift.approach',{kind:t(`rift.${rift.kind}` as import('./i18n').TranslationKey),distance:Math.ceil(rift.z-r.z),reward:rift.points});if(diff!==0)hint+=' / '+(diff===1?t('hud.shiftRight'):diff===3?t('hud.shiftLeft'):t('hud.shiftTwice'));}
  else if(next&&next.z-r.z<115){const diff=wrap(next.safe-r.surface);hint=`${obstacleText(next.kind)} · ${Math.max(0,Math.ceil(next.z-r.z))} M  /  ${diff===0?t('hud.safeLine'):diff===1?t('hud.shiftRight'):diff===3?t('hud.shiftLeft'):t('hud.shiftTwice')}`;}
  const energyLane=next?.energyLane??0;setHudText(hud['lane-hint'],r.riftTransit?'':r.riftChallenge?t('rift.holdLane',{lane:r.riftChallenge.targetLane<0?t('rift.left'):r.riftChallenge.targetLane>0?t('rift.right'):t('rift.center')}):rift&&rift.surface===r.surface?(rift.lane===r.lane?t('rift.locked'):rift.lane<r.lane?t('rift.moveLeft'):t('rift.moveRight')):next&&next.z-r.z<115?(energyLane===r.lane?t('hud.energyLane'):energyLane<r.lane?t('hud.energyLeft'):t('hud.energyRight')):'');
  const transit=r.riftTransit,transitPhase=transit?Math.min(1,transit.elapsed/1.8):0,transitIntensity=Math.sin(Math.PI*transitPhase);ui.classList.toggle('rift-transit',!!transit);hud['rift-overlay'].style.setProperty('--rift-phase',String(transitPhase));hud['rift-overlay'].style.setProperty('--rift-intensity',String(transitIntensity));hud['rift-overlay'].classList.toggle('active',!!r.riftChallenge||r.riftFlash>0);hud['rift-overlay'].classList.toggle('transit',!!transit);hud['rift-overlay'].classList.toggle('exit',transit?.mode==='exit'||(transit?.mode==='enter'&&transit.jumped));hud['rift-overlay'].classList.toggle('black',!!r.riftChallenge||transit?.rift.kind==='black');
  hud['rift-guide'].classList.toggle('visible',!!rift||!!r.riftChallenge||!!transit);hud['rift-guide'].classList.toggle('black',!!r.riftChallenge||transit?.rift.kind==='black');setHudHtml(hud['rift-guide'],transit?`<small>${transit.mode==='enter'&&!transit.jumped?t('rift.horizonLock'):t('rift.emergence')}</small><strong>${transit.mode==='enter'&&!transit.jumped?t('rift.folding'):t('rift.exitOpen')}</strong><span>${Math.round(transitPhase*100)}% · +${fmt(transit.rift.jump)} M</span>`:r.riftChallenge?`<small>${t('rift.trial')}</small><strong>${Math.ceil(r.riftChallenge.remaining)} ${t('common.seconds')} · ${r.riftChallenge.targetLane<0?t('rift.left'):r.riftChallenge.targetLane>0?t('rift.right'):t('rift.center')} ${t('common.lane')}</strong><span>+${fmt(r.riftChallenge.rift.points)} ${t('common.points')}</span>`:rift?`<small>${t('rift.signal')}</small><strong>${t(`rift.${rift.kind}` as import('./i18n').TranslationKey)} · ${Math.ceil(rift.z-r.z)} M</strong><span>${t('rift.surface')} ${rift.surface+1} · ${rift.lane<0?t('rift.left'):rift.lane>0?t('rift.right'):t('rift.center')} ${t('common.lane')} · +${fmt(rift.points)} ${t('common.points')}</span>`:'');
  setHudText(hud.tutorial,hint);hud.tutorial.classList.toggle('visible',!!hint);
  if(screen==='race'){setHudHtml(hud.countdown,'');drawLesson(ui,lesson);}
  if(thermalNotice.take(appActive&&screen==='race'&&save.quality==='auto'&&world.thermal.state!=='nominal'&&!ui.classList.contains('rift-transit'))){
    thermalToast=true;noticeTime=5;hud.notice.textContent=t('hud.thermalNotice');
    hud.notice.setAttribute('role','status');hud.notice.classList.add('show','thermal-notice');
  }
  if(noticeTime<=0){hud.notice.classList.remove('show','thermal-notice');thermalToast=false;}setHudText(hud.perf,save.quality==='auto'&&fps?`${Math.round(fps)} FPS · ${ratio.toFixed(2)}×`:'');
}
function dispatchEvents(){const gainingOverdrive=race!.events.some(e=>e.type==='overdrive');if(lesson?.events(race!.events)){runTelemetry.lessonStep(['movement','surface','fire','turbo'][lesson.step],'completed');sound.play(lesson.step===3?'lessonComplete':'lessonStep');if(save.vibration)navigator.vibrate?.(lesson.step===3?[18,35,25]:12);}runTelemetry.events(race!.events);for(const e of race!.events){if(e.type==='supportUnlocked'){save.earthSupportUnlocked=true;persist();}if(e.type==='supportReady'){if(save.vibration)navigator.vibrate?.([20,45,20]);}if(e.type==='supportCalled')toast(t('support.incoming'));if(e.type==='supportBlocked')toast(t('support.blocked'));if(e.type==='supportEnded')toast(t('support.departed'));if(e.type==='kill'&&e.training){sound.play('kill');world.pulse('kill');continue;}if(e.type==='encounter'&&e.kind){console.info('ION_ENCOUNTER '+JSON.stringify({at:performance.now(),z:race!.z,kind:e.kind}));const found=recordAlien(save.alienLog,e.kind);if(found.discovered){persist();ui.querySelector('.alien-discovery')?.remove();const card=document.createElement('div');card.className='alien-discovery';card.setAttribute('role','status');card.style.setProperty('--alien','#'+ENEMY_TYPES[e.kind].color.toString(16).padStart(6,'0'));card.innerHTML=`<small>${t('archive.new')}</small><strong>${alienLore(e.kind).name}</strong>`;ui.querySelector('.left-instruments')?.append(card);setTimeout(()=>card.remove(),2400);}continue;}if(e.type==='kill'&&e.kind){const result=recordAlien(save.alienLog,e.kind,true);if(result.bonus){race!.score+=result.bonus;e.value=(e.value??0)+result.bonus;}persist(true);}if(e.type!=='supportEnded'&&!(e.type==='energy'&&gainingOverdrive))sound.play(e.type==='supportDeparting'?'supportEnded':e.type.startsWith('rift')?(e.type==='riftComplete'?'goal':'warp'):e.type==='health'&&!e.value?'clean':e.type,race!.overdrive.earned);if(e.type==='kill'){toast(t('event.enemyDestroyed',{points:e.value??0}));if(save.vibration)navigator.vibrate?.([18,25,35]);}if(e.type==='riftEnter'){toast(t('rift.entered',{distance:e.distance??0,points:e.value??0}));if(save.vibration)navigator.vibrate?.([20,25,45]);}if(e.type==='riftChallenge')toast(t('rift.challenge'));if(e.type==='riftShift'&&save.vibration)navigator.vibrate?.(18);if(e.type==='riftComplete'){toast(t('rift.complete',{points:e.value??0}));if(save.vibration)navigator.vibrate?.([35,35,80]);}if(e.type==='singularityOpen'&&save.vibration)navigator.vibrate?.([16,25,30]);if(e.type==='singularityReady'&&save.vibration)navigator.vibrate?.(12);if(e.type==='phaseStart'&&save.vibration)navigator.vibrate?.([10,20,12]);if(e.type==='siegeReady'&&save.vibration)navigator.vibrate?.(12);if(e.type==='siegeBeam'&&save.vibration)navigator.vibrate?.([18,25,30]);if(e.type==='guardBlock'&&save.vibration)navigator.vibrate?.([12,20,8]);if(e.type==='guardReady'&&save.vibration)navigator.vibrate?.(10);if(e.type==='targetLock'&&save.vibration)navigator.vibrate?.([10,25,10]);if(e.type==='overdrive'&&save.vibration)navigator.vibrate?.(14);if(e.type==='heatVent'&&save.vibration)navigator.vibrate?.(14);world.pulse(e.type,e.value);if(['energy','clean','goal','shield','kill','riftEnter','riftComplete'].includes(e.type)&&hud.feedback){hud.feedback.textContent=e.type==='riftComplete'?t('rift.reward',{points:e.value??0}):e.type==='riftEnter'?t('rift.jump'):e.type==='kill'?t('event.destroyed',{points:e.value??0}):e.type==='energy'?t('event.energy',{points:e.value??0,turbo:race!.boostCharge?t('event.turboCharged'):t('event.turboPercent',{percent:Math.round(race!.turboEnergy/TUNE.energyForTurbo*100)})}):e.type==='clean'?t('event.cleanPass'):e.type==='goal'?t('event.goalComplete'):t('hud.shield');hud.feedback.classList.remove('pop');void hud.feedback.offsetWidth;hud.feedback.classList.add('pop');}if(e.type==='denied')toast(t('event.shiftRecharging'));if(e.type==='shield')toast(t('event.shieldCollected',{hits:SURVIVAL.shieldHits,seconds:SURVIVAL.shieldDuration}));if(e.type==='shieldHit')toast(e.value?t('event.shieldHitsLeft',{hits:e.value}):t('event.shieldBroken'));if(e.type==='shieldExpired')toast(t('event.shieldExpired'));if(e.type==='health'){toast(e.value?t('event.healthAdded',{amount:e.value}):t('event.healthFull'));if(e.value&&hud.lives){updateHud();hud.lives.dataset.gain='+'+e.value;hud.lives.classList.remove('health-gained');void hud.lives.offsetWidth;hud.lives.classList.add('health-gained');if(save.vibration)navigator.vibrate?.([12,25,28]);if(!matchMedia('(prefers-reduced-motion: reduce)').matches){hud.lives.animate([{transform:'scale(1)',filter:'brightness(1)'},{transform:'scale(1.12)',filter:'brightness(2)',offset:.18},{transform:'scale(1)',filter:'brightness(1)'}],{delay:320,duration:550,easing:'ease-out'});hud.lives.children[race!.health-1]?.animate([{transform:'skewX(-15deg) scaleY(.2)',background:'#edfff8'},{transform:'skewX(-15deg) scaleY(1.7)',background:'#edfff8',offset:.3},{transform:'skewX(-15deg) scaleY(1)',background:'#87e4ce'}],{delay:320,duration:500,easing:'ease-out'});}}}if(e.type==='turboReady')toast(t('event.turboUnlocked'));if(e.type==='boost')toast(t('event.turboEngaged'));if(e.type==='goal'){const g=RUN_GOALS[e.value!];toast(t('event.goalToast',{goal:upper(goalText(g.id)),points:g.points}));}if(e.type==='stage')toast(routeText(race!.route.id,'name')+' / '+upper(routeText(race!.route.id,'subtitle')));if(e.type==='hit'){hud.flash?.classList.add('hit');setTimeout(()=>hud.flash?.classList.remove('hit'),350);if(save.vibration)navigator.vibrate?.(70);toast(race!.health>0?t('event.hit',{health:race!.health}):t('event.signalLost'));}if(e.type==='fail'){setScreen('crash');crashTime=.65;}}race!.events=[];if(unlockEventHorizon(save,race!.z)){const p=save.bikeProgress!;p.unlocked=7;p.selected=7;persist();rankAwards.enqueue(7);}} 
function shift(dir:number){if(screen!=='race')return;race!.changeLane(dir);dispatchEvents();}
window.addEventListener('pointerdown',e=>{if(screen!=='race'||!race||e.button!==0)return;const target=e.target as Element;
 const fire=target.closest<HTMLElement>('#fire');if(!fire||firePointer!==undefined)return;
 e.preventDefault();firePointer=e.pointerId;const box=fire.getBoundingClientRect();fireOrigin={x:e.clientX,y:e.clientY,radius:box.width*FIRE_PAD.travel,aimX:world.aimScreen.x,aimY:world.aimScreen.y};fire.setPointerCapture(e.pointerId);world.pointAt(race,fireOrigin.aimX,fireOrigin.aimY);race.pressFire();dispatchEvents();ui.classList.add('shooting');
});
window.addEventListener('pointermove',e=>{if(e.pointerId!==firePointer||screen!=='race'||!race)return;e.preventDefault();const dx=(e.clientX-fireOrigin.x)/fireOrigin.radius,dy=(e.clientY-fireOrigin.y)/fireOrigin.radius,length=Math.hypot(dx,dy),scale=Math.pow(Math.min(1,length),FIRE_PAD.response)/Math.max(.0001,length),x=dx*scale,y=dy*scale;lesson?.aim(length);world.pointAt(race,fireOrigin.aimX+x*FIRE_PAD.rangeX,fireOrigin.aimY+y*FIRE_PAD.rangeY);hud.fire.style.setProperty('--aim-x',x*fireOrigin.radius*.65+'px');hud.fire.style.setProperty('--aim-y',y*fireOrigin.radius*.65+'px');},{passive:false});
window.addEventListener('pointerup',e=>{if(e.pointerId===firePointer)stopFire(false);});window.addEventListener('pointercancel',e=>{if(e.pointerId===firePointer)stopFire();});ui.addEventListener('lostpointercapture',e=>{if(e.pointerId===firePointer)stopFire();});window.addEventListener('keyup',e=>{if(e.code==='Space'&&firePointer===undefined&&race)race.firing=false;if(race&&firePointer===undefined){if(['KeyJ','KeyL'].includes(e.code))race.aimX=0;if(['KeyI','KeyK'].includes(e.code))race.aimY=0;}});window.addEventListener('blur',()=>stopFire());
ui.addEventListener('click',e=>{if(recoveryBusy())return;const el=(e.target as Element).closest<HTMLElement>('[data-action],[data-route]');if(!el)return;switch(el.dataset.action){case'singularity':if(screen==='race'&&race?.activateSingularity()){dispatchEvents();updateSingularityHud(ui,race);}break;case'earthSupport':if(screen==='race'&&race?.support.activate(race))dispatchEvents();break;case'skipLesson':if(lesson?.active)runTelemetry.lessonStep(['movement','surface','fire','turbo'][lesson.step],'skipped');lesson?.skip();drawLesson(ui,lesson);break;case'learnControls':toggleTutorialReplay(save);persist();{const back=previous;settings();previous=back;}break;case'reminders':void toggleReminders(()=>{if(screen==='settings'){const prev=previous;settings();previous=prev;}});break;case'flipAlien':flipAlienCard(el);break;case'analytics':void telemetry.setChoice(!telemetry.enabled).then(()=>{runTelemetry.end('privacy_changed');const prev=previous;settings();previous=prev;}).catch(()=>toast(t('analytics.error')));break;case'adPrivacy':void rewardedAds.showPrivacyOptions();break;case'turbo':if(screen==='race'){race!.activateTurbo();dispatchEvents();}break;case'bikeAbilities':openBikeAbilities(save.bikeProgress!);break;case'garage':garage();break;case'garagePreview':{const tier=Number(el.dataset.tier);if(Number.isInteger(tier)&&tier>=0&&tier<=save.bikeProgress!.unlocked)garage(tier);break;}case'garageEquip':equipBike(Number(el.dataset.tier));break;case'garageRotate':world.rotateGarage(Number(el.dataset.turn));break;case'home':home();break;case'routes':routes();break;case'aliens':aliens();break;case'settings':settings();break;case'store':openStore();break;case'storeBack':closeStore();break;case'novaAd':openNovaAdDialog(save,()=>{if(screen==='store')store();else if(screen==='revive')revivePrompt();});break;case'buyNova':if(el.dataset.product)void buyNova(el.dataset.product as NovaProductId);break;case'restorePurchases':void syncPurchases();break;case'exit':exitGame();break;case'launch':case'restart':void launch();break;case'pause':pause();break;case'resume':beginCountdown();break;case'reviveNova':void restoreRun(true);break;case'buyContinue':void continueWithNova(true);break;case'reviveAd':void watchReviveAd();break;case'musicSuggestions':save.musicSuggestions=save.musicSuggestions===false;musicOfferSession.reset();if(!save.musicSuggestions){void toggleMusicMode(el,false);}else{persist();const back=previous;settings();previous=back;}break;case'dismissMusicOffer':musicOfferSession.dismiss();updateMusicOffer();break;case'enableMusicMode':void toggleMusicMode(el,true);break;case'music':if(musicModeActive)break;save.music=!save.music;sound.musicEnabled=save.music;persist();{const prev=previous;settings();previous=prev;}break;case'sound':save.sound=!save.sound;sound.enabled=save.sound;persist();{const prev=previous;settings();previous=prev;}break;case'vibration':save.vibration=!save.vibration;persist();{const prev=previous;settings();previous=prev;}break;case'settingsBack':closeSettings();break;}});
ui.addEventListener('input',e=>{
 const el=e.target as HTMLInputElement;if(el.id!=='effects-volume')return;
 save.effectsVolume=Number(el.value)/100;sound.setEffectsVolume(save.effectsVolume);
 el.parentElement!.querySelector('output')!.textContent=el.value+'%';persist(true);
});
ui.addEventListener('change',e=>{world.invalidate();const el=e.target as HTMLSelectElement;if(el.id==='effects-volume'){persist();return;}if(el.id==='menu-track'){save.menuTrack=cleanMenuTrack(el.value);sound.setMenuTrack(save.menuTrack);persist();return;}if(el.id==='livery'){save.livery=el.value==='event-horizon'&&save.eventHorizonUnlocked?'event-horizon':'classic';save.bikeProgress!.selected=save.livery==='event-horizon'?7:0;sound.evolution=save.bikeProgress!.selected;world.bike.userData.setEvolution(save.bikeProgress!.selected);persist();}if(el.id==='controls'){save.controls=el.value as Save['controls'];applyControls();persist();}if(el.id==='button-size'){save.buttonSize=el.value as Save['buttonSize'];applyControls();persist();}if(el.id==='quality'){save.quality=el.value;world.setQuality(save.quality);persist();}if(el.id==='language'){save.language=el.value as Save['language'];setLocale(save.language);persist();const prev=previous;settings();previous=prev;}});
window.addEventListener('keydown',e=>{if(e.repeat||recoveryBusy())return;if(screen==='race'&&race&&firePointer===undefined){if(['KeyJ','KeyL','KeyI','KeyK'].includes(e.code))lesson?.aim(1);if(e.code==='KeyJ')race.aimX=-.55;if(e.code==='KeyL')race.aimX=.55;if(e.code==='KeyI')race.aimY=.55;if(e.code==='KeyK')race.aimY=-.55;}if(['a','A'].includes(e.key)){e.preventDefault();shift(-1);}if(['d','D'].includes(e.key)){e.preventDefault();shift(1);}if(['ArrowLeft','ArrowRight'].includes(e.key)&&screen==='race'){e.preventDefault();race!.changeLane(e.key==='ArrowLeft'?-1:1);dispatchEvents();}if(e.code==='KeyQ'&&screen==='race'){e.preventDefault();if(race?.activateSingularity()){dispatchEvents();updateSingularityHud(ui,race);}}if(e.code==='KeyE'&&screen==='race'&&race?.support.activate(race))dispatchEvents();if(e.code.startsWith('Shift')&&screen==='race'){race!.activateTurbo();dispatchEvents();}if(e.code==='Space'&&screen==='race'){e.preventDefault();race!.pressFire();dispatchEvents();}if(e.key==='Escape'){if(document.querySelector('dialog[open]'))return;if(screen==='race'||screen==='countdown')pause();else if(screen==='pause')beginCountdown();else if(screen==='settings')closeSettings();else if(screen==='store')closeStore();else if(!loading)home();}});
function background(){if(!appActive)return;checkpointBike();runTelemetry.background(screen);const willPause=screen==='race'||screen==='countdown';resumeAfterBackground=resumeAfterBackground||willPause;appActive=false;frames.setActive(false);pause();sound.suspend();if(save&&!willPause)persist();}
function foreground(){if(document.hidden)return;appActive=true;if(menuMusicScreen()&&sound.musicEnabled&&!sound.musicMode)void sound.unlock().then(syncMenuMusic).catch(()=>{});frames.setActive(framesReady);void thermalMonitor?.refresh();void powerMonitor?.refresh();void externalMusicMonitor?.refresh();void refreshReminders().then(()=>{if(screen==='settings'){const prev=previous;settings();previous=prev;}});last=performance.now();if(screen==='pause'&&resumeAfterBackground)beginCountdown();resumeAfterBackground=false;void syncPurchases(false);}
document.addEventListener('click',e=>{
 const button=(e.target as Element).closest<HTMLButtonElement>('button');
 if(!appActive||!button||button.disabled||button.getAttribute('aria-disabled')==='true')return;
 // Driving controls already have their own gameplay effects.
 if(button.matches('#fire,#turbo,.steer,[data-action="earthSupport"],[data-action="singularity"]'))return;
 sound.uiClick();
});
document.addEventListener('visibilitychange',()=>{document.hidden?background():foreground();});
window.addEventListener('resize',()=>{if(innerHeight>innerWidth)pause();});
window.addEventListener('ion-audio-focus-lost',()=>{pause();sound.suspend();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();});
canvas.addEventListener('webglcontextrestored',()=>{location.reload();});
function frame(now:number){if(!appActive){last=now;return false;}const raw=Math.max(0,(now-last)/1000);const dt=Math.min(.075,raw);last=now;timer+=dt;noticeTime-=dt;
  if(screen==='crash'){crashTime-=dt;if(crashTime<=0)revivePrompt();}
  if(screen==='countdown'){countdown-=dt;setHudHtml(hud.countdown,`<div class="countdown-inner"><span>${race!.z>0?t('countdown.returning'):t('countdown.launch')}</span><b>${Math.max(1,Math.ceil(countdown))}</b></div>`);if(countdown<=0){setScreen('race');hud.countdown.innerHTML='';}}
  const cpuStart=performance.now();
  if(screen==='race'){if(lesson?.active)runTelemetry.lessonStep(['movement','surface','fire','turbo'][lesson.step],'shown');world.flushAim(race!);accumulator+=dt;while(accumulator>=1/120&&screen==='race'){lesson?.tick(1/120);race!.step(1/120);accumulator-=1/120;dispatchEvents();runTelemetry.update(race!,1/120);}runTelemetry.frame(raw);}
  if(screen==='race'||screen==='countdown'){if(timer>.05){updateHud();timer=0;}}
  if(screen==='race'){checkpointBike(false);if(now-masterySavedAt>5000){masterySavedAt=now;persist(true);}}
  rankAwards.update(dt,screen==='race',ui);
  if(screen==='garage')world.render(0);
  sound.update(screen==='race',race?.speed??0);
  const cpuMs=performance.now()-cpuStart;
  const racing=screen==='race';
  if(racing!==wasRacing){world.resetPerformance();lastProfileRender=0;perfSamples=[];perfReportAt=now;renderElapsed=0;wasRacing=racing;}
  renderElapsed+=dt;
  if(!world.menu&&screen!=='store'&&screen!=='loading'&&(!racing||world.renderDue(now))){
    world.render(screen==='settings'||screen==='pause'||screen==='result'||screen==='crash'||screen==='revive'?0:renderElapsed,race);
    renderElapsed=0;if(racing){world.measure(now);
      perfSamples.push([lastProfileRender?now-lastProfileRender:raw*1000,cpuMs,world.profile.updateMs,world.profile.submitMs,world.profile.calls,world.profile.triangles,now]);
      lastProfileRender=now;
      if(now-perfReportAt>5000&&perfSamples.length>5){
        const means=perfSamples[0].map((_,i)=>perfSamples.reduce((sum,row)=>sum+row[i],0)/perfSamples.length);
        const intervals=perfSamples.map(row=>row[0]).sort((a,b)=>a-b);
        console.info('ION_PERF '+JSON.stringify({at:now,stalls:perfSamples.filter(row=>row[0]>50).slice(-12).map(row=>({at:row[6],ms:row[0]})),p95Ms:intervals[Math.ceil(intervals.length*.95)-1],maxMs:intervals[intervals.length-1],over50Ms:intervals.filter(ms=>ms>50).length,z:Math.round(race!.z),frames:perfSamples.length,renderIntervalMs:means[0],gpuMs:world.gpuTimer.milliseconds,cpuMs:means[1],updateMs:means[2],submitMs:means[3],calls:means[4],triangles:means[5],ratio:world.pixelRatio,level:world.adaptive.effectiveLevel,thermal:world.thermal.state,target:world.adaptive.targetFps}));
        perfSamples=[];perfReportAt=now;
      }
    }
  }
  return screen==='race'||screen==='countdown'||screen==='crash';
}
async function init(){if((import.meta as ImportMeta & {env:{VITE_ION_BENCH?:string}}).env.VITE_ION_BENCH==='1'){await (await import('./render-benchmark')).runRenderBenchmark(canvas,ui);return;}await telemetry.init();runTelemetry.recover();save=await readSave();save.bikeProgress=cleanBikeProgress(save.bikeProgress,save);await writeSave(save);await refreshReminders();setLocale(save.language);canvas.setAttribute('aria-label',t('canvas.label'));document.querySelector('#rotate-title')!.textContent=t('rotate.title');document.querySelector('#rotate-body')!.textContent=t('rotate.body');applyControls();sound.enabled=save.sound;sound.musicEnabled=save.music;sound.setMenuTrack(save.menuTrack);try{await sound.setMusicMode(musicModeActive===true,save.effectsVolume??.65);}catch(error){musicModeActive=false;await sound.setMusicMode(false).catch(()=>{});console.warn('Music mode unavailable',error);}try{world=new World(canvas);}catch(e){ui.innerHTML=`<section class="modal"><h2>${t('error.graphicsTitle')}</h2><p>${t('error.graphicsBody')}</p></section>`;console.error(e);return;}await Promise.all([novaArtwork.prepare().catch(error=>console.warn('Nova artwork preparation failed',error)),studioIntro(ui),world.loadArtwork(p=>studioProgress(ui,p)).catch(e=>console.error('Artwork loading failed',e))]);world.requestFrame=()=>frames.invalidate();world.thermalReductionCallback=()=>thermalNotice.request();world.setQuality(save.quality);thermalMonitor=monitorThermals(state=>world.setThermalState(state));powerMonitor=monitorPower(lowPower=>world.setLowPower(lowPower));externalMusicMonitor=monitorExternalMusic(externalMusicChanged);world.performanceCallback=(f,p)=>{fps=f;ratio=p;};home();void initializeCommerce();void rewardedAds.initialize().then(()=>{if(screen==='settings'){const back=previous;settings();previous=back;}});
  if(Capacitor.isNativePlatform()){
    await App.addListener('pause',background);
    await App.addListener('resume',foreground);
    await App.addListener('appStateChange',({isActive})=>isActive?foreground():background());
    if(Capacitor.getPlatform()==='android')await App.addListener('backButton',()=>{if(recoveryBusy())return;const abilities=document.querySelector<HTMLDialogElement>('.bike-abilities-dialog[open]');if(abilities){abilities.close();return;}const adDialog=document.querySelector('.nova-ad-dialog');if(adDialog){adDialog.dispatchEvent(new Event('cancel',{cancelable:true}));return;}if(screen==='race'||screen==='countdown')pause();else if(screen==='pause')beginCountdown();else if(screen==='home')exitGame();else if(screen==='settings')closeSettings();else if(screen==='store')closeStore();else if(!loading)home();});
  }
  if((import.meta as ImportMeta & {env:{VITE_ION_DIAG?:string}}).env.VITE_ION_DIAG==='1'){
    if(new URLSearchParams(location.search).get('musicOffer')==='1')externalMusicChanged({supported:true,playing:true});
    Object.assign(window,{ionDiagnostic:{world,ui,sound,frames,getRace:()=>race,reset:(z=9800)=>{race=new Race(ROUTES[0].seed);race.z=z;race.invulnerable=100000;race.ensureCourse();accumulator=0;renderElapsed=0;lastProfileRender=0;perfSamples=[];perfReportAt=performance.now();drawHud();setScreen('race');world.menu=false;},pause}});
  }
  last=performance.now();framesReady=true;frames.setActive(appActive&&!document.hidden);if(shipPreviewMode()||revivePreviewMode())void launch();
}
void init();










ui.addEventListener('keydown',e=>{const card=(e.target as Element).closest<HTMLElement>('[data-action="flipAlien"]');if(card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(!e.repeat)flipAlienCard(card);}});

ui.addEventListener('click',e=>{
 if(!(e.target as Element).closest('[data-action="privacyInfo"]'))return;
 if(document.querySelector('.privacy-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='privacy-dialog';
 dialog.setAttribute('aria-labelledby','privacy-title');
 dialog.innerHTML=`<h2 id="privacy-title">${t('settings.privacyTitle')}</h2><div class="privacy-copy"><p>${t('settings.privacy')}</p><nav class="privacy-links"><a href="https://example.invalid/privacy" target="_blank" rel="noopener noreferrer">${t('settings.privacyPolicy')} ↗</a><a href="https://example.invalid/support" target="_blank" rel="noopener noreferrer">${t('settings.support')} ↗</a></nav><details><summary>${t('settings.privacyDataTitle')}</summary><p>${t('settings.privacyAnalytics')}</p><p>${t('settings.privacyAds')}</p><p>${t('settings.privacyControl')}</p></details><details><summary>${t('settings.privacyLicencesTitle')}</summary><p>${t('settings.privacyTextures')}</p><p>${t('settings.privacyJupiter')}</p><p>${t('settings.privacySoftware')}</p></details></div><button class="primary">${t('common.done')}</button>`;
 dialog.querySelector('button')!.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 document.body.append(dialog);dialog.showModal();
});

ui.addEventListener('pointerdown',e=>{const el=(e.target as Element).closest<HTMLElement>('.garage-turntable');if(screen!=='garage'||!el)return;garagePointer=e.pointerId;garagePointerX=e.clientX;el.setPointerCapture(e.pointerId);});
ui.addEventListener('pointermove',e=>{if(screen!=='garage'||e.pointerId!==garagePointer)return;world.rotateGarage((e.clientX-garagePointerX)*.012);garagePointerX=e.clientX;const el=ui.querySelector('.garage-turntable');el?.setAttribute('aria-valuenow',String(Math.round(Math.atan2(Math.sin(world.garageAngle),Math.cos(world.garageAngle))*180/Math.PI)));});
ui.addEventListener('pointerup',()=>{garagePointer=undefined;});ui.addEventListener('pointercancel',()=>{garagePointer=undefined;});
ui.addEventListener('keydown',e=>{if(screen!=='garage'||!(e.target as Element).matches('.garage-turntable'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();world.rotateGarage(e.key==='ArrowLeft'?-.2:.2);}});
