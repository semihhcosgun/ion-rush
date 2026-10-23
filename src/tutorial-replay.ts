import {cleanTutorial,freshTutorial,type TutorialProgress} from './onboarding';
export interface TutorialReplaySave {tutorial?:TutorialProgress;tutorialReplayQueued?:boolean;}
export function toggleTutorialReplay(save:TutorialReplaySave){save.tutorialReplayQueued=save.tutorialReplayQueued!==true;return save.tutorialReplayQueued;}
export function takeTutorialReplay(save:TutorialReplaySave){
 if(save.tutorialReplayQueued!==true)return false;
 save.tutorial=freshTutorial();save.tutorialReplayQueued=false;return true;
}
export function cleanTutorialReplay(value:unknown,progress:TutorialProgress,runs:number,bestDistance:number){
 // Earlier versions queued a replay by immediately wiping progress. A pilot who
 // has flown beyond the bounded guide cannot legitimately be on its first step.
 const legacyReplay=value===undefined&&runs>0&&bestDistance>=1000&&progress.completed===0&&!progress.skipped;
 return {tutorialReplayQueued:value===true||legacyReplay,tutorial:legacyReplay?cleanTutorial(undefined,runs):progress};
}
