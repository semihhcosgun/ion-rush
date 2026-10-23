/** OS power saving sheds GPU work at 60 FPS; the player's Battery saver
 * quality option explicitly requests 30 FPS. Neither can relax heat limits. */
export class PowerBudget {
 private lowPower=false;
 private saver=false;
 get active(){return this.lowPower||this.saver;}
 get levelFloor(){return this.active?3:0;}
 get ratioCap(){return this.saver?1:this.lowPower?1.1:Infinity;}
 get maxFps():30|60{return this.saver?30:60;}
 setLowPower(value:boolean){if(value===this.lowPower)return false;this.lowPower=value;return true;}
 setSaver(value:boolean){if(value===this.saver)return false;this.saver=value;return true;}
}
