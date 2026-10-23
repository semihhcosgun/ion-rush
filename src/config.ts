export const TUNE=Object.freeze({speed:29,maxCruise:58,speedRampDistance:36000,boostSpeed:66,boostExtra:8,laneDuration:.18,laneSpacing:2.2,shiftDuration:.25,recharge:.95,maxCharges:2,reactionTime:.8,visibility:205,collisionHalfWidth:4,startDistance:176,combo2:3,combo3:8,cleanForShield:6,energyForTurbo:5,boostDuration:3,rewardCooldown:14,rewardWindow:60,maxBoosts:2,maxShields:2,energyPoints:35,gatePoints:100,streamAhead:800,retainBehind:80});
export type ObstacleKind='barrier'|'arm'|'laser'|'block'|'gap'|'shutter'|'mines';
export const KINDS:ObstacleKind[]=['barrier','arm','laser','block','gap','shutter','mines'];
export type RouteId='mercury'|'venus'|'earth'|'luna'|'mars'|'jupiter'|'saturn'|'uranus'|'neptune'|'kuiper'|'void'|'horizon'|'singularity';
export const DEEP_SPACE=Object.freeze({kuiper:20400,interstellar:28000,approach:42000,target:50000});
export interface Route{id:RouteId;color:string;planet:string;length:number;seed:number;kinds:ObstacleKind[];start:number;}
export const ROUTES:Route[]=[
 {id:'earth',color:'#78e9dc',planet:'#247ca0',length:1400,start:0,seed:2249,kinds:['barrier','arm']},
 {id:'luna',color:'#d3dfed',planet:'#929fa9',length:3200,start:1400,seed:2249,kinds:['barrier','arm','laser','block','shutter']},
 {id:'mercury',color:'#ddc1a3',planet:'#93877b',length:5200,start:3200,seed:2249,kinds:KINDS},
 {id:'venus',color:'#ffd698',planet:'#bd9458',length:6800,start:5200,seed:2249,kinds:KINDS},
 {id:'mars',color:'#ff946c',planet:'#ac492a',length:9000,start:6800,seed:2249,kinds:KINDS},
 {id:'jupiter',color:'#eec79a',planet:'#bd865b',length:12000,start:9000,seed:2249,kinds:KINDS},
 {id:'saturn',color:'#ffe0a9',planet:'#c3aa7d',length:15000,start:12000,seed:2249,kinds:KINDS},
 {id:'uranus',color:'#a4f1ef',planet:'#72bcc3',length:17600,start:15000,seed:2249,kinds:KINDS},
 {id:'neptune',color:'#8cabff',planet:'#3455a8',length:20400,start:17600,seed:2249,kinds:KINDS},
 {id:'kuiper',color:'#b6e5ec',planet:'#66828e',length:28000,start:20400,seed:2249,kinds:KINDS},
 {id:'void',color:'#b9a5ff',planet:'#66558d',length:42000,start:28000,seed:2249,kinds:KINDS},
 {id:'horizon',color:'#a9d9ff',planet:'#a5badb',length:50000,start:42000,seed:2249,kinds:KINDS},
 {id:'singularity',color:'#e5c9ff',planet:'#100d21',length:Infinity,start:50000,seed:2249,kinds:KINDS},
];
export const stageAt=(z:number):Route=>ROUTES.find(r=>z<r.length)??ROUTES[ROUTES.length-1];
export const stageProgress=(z:number)=>{const s=stageAt(z);return Number.isFinite(s.length)?(z-s.start)/(s.length-s.start):((z-s.start)%2000)/2000;};
export const BODIES=[{id:'earth',x:-280,y:125,passAt:950,radius:210},{id:'luna',x:180,y:62,passAt:2250,radius:115},{id:'mercury',x:-280,y:125,passAt:4400,radius:200},{id:'venus',x:370,y:140,passAt:6100,radius:280},{id:'mars',x:-355,y:95,passAt:7900,radius:275},{id:'jupiter',x:660,y:220,passAt:11000,radius:510},{id:'saturn',x:-750,y:240,passAt:14000,radius:420},{id:'uranus',x:500,y:170,passAt:16700,radius:340},{id:'neptune',x:-470,y:155,passAt:19400,radius:350}] as const;

export const RUN_GOALS=[
 {id:'clean',target:3,points:150,stat:'cleared'},
 {id:'energy',target:6,points:250,stat:'energy'},
 {id:'combo',target:9,points:350,stat:'bestCombo'},
 {id:'moon',target:1400,points:500,stat:'z'},
 {id:'mars',target:6800,points:750,stat:'z'},
] as const;

export const COMBAT=Object.freeze({enemies:9,bolts:32,telegraph:1.35,range:165,fireInterval:.17,shotHeat:6.25,activeCooling:0,cooling:12.5,rearm:35,boltSpeed:170,enemyBoltSpeed:68,killPoints:180});

/** Early attacks respect the obstacle's safe face; veteran pursuers can hunt the player. */
export const ENEMY_TYPES={
 drone:{rank:1,unlock:450,hp:2,shots:1,interval:.3,color:0xff8158,points:180,cost:1,weight:40,mobility:.7,hover:1.3,attackCooldown:5.4},
 saucer:{rank:2,unlock:900,hp:3,shots:2,interval:.32,color:0xc7a0ff,points:240,cost:1.5,weight:32,mobility:.85,hover:1.12,attackCooldown:4.7},
 manta:{rank:3,unlock:2400,hp:4,shots:2,interval:.24,color:0x9bea85,points:320,cost:2.2,weight:26,mobility:1,hover:1,attackCooldown:4},
 scarab:{rank:4,unlock:4400,hp:5,shots:2,interval:.32,color:0xe6ce74,points:380,cost:2.7,weight:22,mobility:.95,hover:1.1,attackCooldown:4.5},
 wraith:{rank:4,unlock:6800,hp:5,shots:3,interval:.2,color:0x77baff,points:440,cost:3,weight:22,mobility:1.12,hover:.88,attackCooldown:3.3},
 helix:{rank:5,unlock:9200,hp:6,shots:2,interval:.3,color:0xff9878,points:540,cost:3.5,weight:22,mobility:1.15,hover:.92,attackCooldown:4},
 sentinel:{rank:5,unlock:12000,hp:7,shots:3,interval:.22,color:0xffcb70,points:650,cost:4,weight:20,mobility:1.25,hover:.78,attackCooldown:2.8},
 medusa:{rank:6,unlock:14800,hp:6,shots:2,interval:.34,color:0x75f1b6,points:720,cost:3.9,weight:22,mobility:1.08,hover:1,attackCooldown:4.2},
 prism:{rank:6,unlock:17600,hp:6,shots:2,interval:.3,color:0x6cffe4,points:800,cost:4.2,weight:23,mobility:1.32,hover:.8,attackCooldown:3.7},
 comet:{rank:7,unlock:20800,hp:7,shots:3,interval:.16,color:0x73d6ff,points:900,cost:4.5,weight:22,mobility:1.4,hover:.74,attackCooldown:3.7},
 revenant:{rank:7,unlock:24000,hp:8,shots:3,interval:.18,color:0xff68c8,points:1000,cost:4.8,weight:22,mobility:1.38,hover:.72,attackCooldown:3.1},
 oracle:{rank:8,unlock:28500,hp:8,shots:2,interval:.36,color:0x9295ff,points:1150,cost:5.1,weight:22,mobility:1.16,hover:.96,attackCooldown:4.3},
 seraph:{rank:8,unlock:33000,hp:9,shots:3,interval:.3,color:0xbca2ff,points:1300,cost:5.4,weight:20,mobility:1.2,hover:.9,attackCooldown:4.2},
 sovereign:{rank:9,unlock:44000,hp:11,shots:3,interval:.24,color:0xffad55,points:1700,cost:6.2,weight:18,mobility:1.3,hover:.85,attackCooldown:3.9},
 apex:{rank:10,unlock:56000,hp:12,shots:3,interval:.2,color:0xff527f,points:2200,cost:6.8,weight:16,mobility:1.45,hover:.75,attackCooldown:3.5},
} as const;
export const ENEMY_PROGRESSION=Object.freeze({introDistance:650,introWeight:.18,earlyBudget:1.5,moonBudget:3.5,marsBudget:5,deepBudget:10.2,doubleEliteDistance:6000});
export type EnemyKind=keyof typeof ENEMY_TYPES;
export const ENEMY_ENTRY=2.2;
export const AIM=Object.freeze({distance:75,screenX:.28,screenY:.28,deadzone:.06,enemyRadius:4,playerRadius:1.35});
export const PURSUIT=Object.freeze({maxEnemies:6,distance:46,huntDistance:900,huntAge:10,reinforceAge:16,pressureRamp:48,reinforceInterval:16,extraBudget:6,attackStagger:.8,maxWarnings:2,cooldownReduction:.35});
export const FIRE_PAD=Object.freeze({travel:.5,rangeX:.42,rangeY:.38,response:1.55});
export const SURVIVAL=Object.freeze({maxHealth:3,heal:1,shieldHits:2,shieldDuration:12,hitRecovery:.8,pickupEvery:6,pickupOffset:36,pickupReach:.45,pickupPool:8,maxRevives:2,reviveHealth:2,reviveShield:2,reviveGrace:3,reviveClearance:150});
export const FLIGHT=Object.freeze({turnSpeed:.65,turnAcceleration:1.5,reactionMin:.35,reactionSpread:1.05,decisionMin:.65,decisionSpread:1.1,laneSpeed:9,laneAcceleration:22,heightSpeed:12,gapSpeed:42,hoverMin:1.8,hoverSpread:1.7,hoverStiffness:9,dartStiffness:14,dartDuration:1.6,arcDuration:3.4,recoverDuration:1.7,dartWidth:7,arcWidth:10,approach:13,retreat:11});

export const ENCOUNTERS=Object.freeze({waveChance:.6,earlyWaveChance:.4,firstEnemyDistance:450,pickupMinGap:4,pickupGapSpread:3,shieldChance:.5,breathMinGap:2,breathGapSpread:3});

/** Cruise-time pacing; turbo safety is enforced independently by CourseStream. */
export const PACING=Object.freeze({earlySeconds:4.25,lateSeconds:3.15,settleDistance:3200,jitterSeconds:.25,breathSeconds:.55,complexSeconds:.3,maxGapChange:24,blockUnlock:650,laserUnlock:1050});
