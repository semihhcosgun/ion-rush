package com.example.ionrush;

import java.util.Calendar;
import java.util.List;

/** Pure scheduling policy, using the device's current local timezone. */
public final class ReminderPolicy {
    public static final long DAY=24L*60*60*1000;
    private static final int[] DAYS={1,3,7};
    public static final class Plan {
        public final int stage;
        public final long at;
        Plan(int stage,long at){this.stage=stage;this.at=at;}
    }
    public static long daytime(long time){
        Calendar c=Calendar.getInstance();c.setTimeInMillis(time);
        int hour=c.get(Calendar.HOUR_OF_DAY);
        if(hour>=21)c.add(Calendar.DAY_OF_MONTH,1);
        if(hour>=21||hour<10){c.set(Calendar.HOUR_OF_DAY,10);c.set(Calendar.MINUTE,0);c.set(Calendar.SECOND,0);c.set(Calendar.MILLISECOND,0);}
        return c.getTimeInMillis();
    }
    public static Plan next(long now,long lastActive,int sentMask,List<Long> history){
        int stage=-1;
        for(int i=0;i<3;i++){
            if((sentMask&(1<<i))!=0)continue;
            if(stage<0||lastActive+DAYS[i]*DAY<=now)stage=i;
        }
        if(stage<0)return null;
        long at=Math.max(now,lastActive+DAYS[stage]*DAY);
        // Respect actual deliveries across sessions, including delayed alarms.
        for(Long sent:history)at=Math.max(at,sent+DAY);
        for(int pass=0;pass<=history.size();pass++){
            at=daytime(at);int count=0;long oldest=Long.MAX_VALUE;
            for(Long sent:history)if(sent>at-7*DAY){count++;oldest=Math.min(oldest,sent);}
            if(count<3)break;
            at=oldest+7*DAY;
        }
        return new Plan(stage,at);
    }
}
