package com.example.ionrush;

import android.app.*;
import android.content.*;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONArray;
import java.util.*;

public final class FlightReminders extends BroadcastReceiver {
    static final String CHANNEL="flight_reminders";
    static final int ID=7401;
    static volatile boolean foreground=false;
    static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("flight_reminders",Context.MODE_PRIVATE);}
    static String language(Context c){return ReminderCopy.normalizeLocale(prefs(c).getString("language","en"));}
    static void channel(Context c){
        if(Build.VERSION.SDK_INT>=26){
            ReminderCopy copy=ReminderCopy.forLanguage(language(c));
            NotificationChannel channel=new NotificationChannel(CHANNEL,copy.channel,NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription(copy.description);
            channel.enableVibration(false);
            c.getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }
    static boolean allowed(Context c){
        if(!NotificationManagerCompat.from(c).areNotificationsEnabled())return false;
        if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=c.getSystemService(NotificationManager.class).getNotificationChannel(CHANNEL);if(channel!=null&&channel.getImportance()==NotificationManager.IMPORTANCE_NONE)return false;}
        return true;
    }
    static PendingIntent alarm(Context c){return PendingIntent.getBroadcast(c,ID,new Intent(c,FlightReminders.class).setAction("com.example.ionrush.FLIGHT_REMINDER"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    static void cancel(Context c){c.getSystemService(AlarmManager.class).cancel(alarm(c));NotificationManagerCompat.from(c).cancel(ID);}
    static List<Long> history(Context c){
        List<Long> rows=new ArrayList<>();
        try{JSONArray a=new JSONArray(prefs(c).getString("history","[]"));for(int i=0;i<a.length();i++){long t=a.optLong(i);if(t>System.currentTimeMillis()-7*ReminderPolicy.DAY)rows.add(t);}}catch(Exception ignored){}
        return rows;
    }
    static void schedule(Context c){
        c.getSystemService(AlarmManager.class).cancel(alarm(c));
        if(!prefs(c).getBoolean("enabled",false)||!allowed(c))return;
        long now=System.currentTimeMillis();
        ReminderPolicy.Plan plan=ReminderPolicy.next(now,prefs(c).getLong("lastActive",now),prefs(c).getInt("sentMask",0),history(c));
        if(plan!=null)c.getSystemService(AlarmManager.class).set(AlarmManager.RTC_WAKEUP,plan.at,alarm(c));
    }
    static void active(Context c){foreground=true;reset(c);}
    static void inactive(Context c){foreground=false;reset(c);}
    private static void reset(Context c){
        prefs(c).edit().putLong("lastActive",System.currentTimeMillis()).putInt("sentMask",0).apply();
        cancel(c);schedule(c);
    }
    @Override public void onReceive(Context c,Intent intent){
        String action=intent.getAction();
        if(Intent.ACTION_BOOT_COMPLETED.equals(action)||Intent.ACTION_TIME_CHANGED.equals(action)||Intent.ACTION_TIMEZONE_CHANGED.equals(action)||Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)){schedule(c);return;}
        if(!prefs(c).getBoolean("enabled",false)||!allowed(c)){cancel(c);return;}
        if(foreground){reset(c);return;}
        long now=System.currentTimeMillis();List<Long> sent=history(c);
        ReminderPolicy.Plan plan=ReminderPolicy.next(now,prefs(c).getLong("lastActive",now),prefs(c).getInt("sentMask",0),sent);
        if(plan==null)return;
        if(plan.at>now){schedule(c);return;}
        channel(c);
        long best=prefs(c).getLong("best",0);
        String language=language(c);
        ReminderCopy copy=ReminderCopy.forLanguage(language);
        String body=copy.body(plan.stage,best,language);
        Intent launch=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open=PendingIntent.getActivity(c,ID,launch,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification n=new NotificationCompat.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_flight_reminder).setColor(0xFF79E5D5)
            .setContentTitle(copy.titles[plan.stage]).setContentText(body).setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(open).setAutoCancel(true).setOnlyAlertOnce(true).setCategory(NotificationCompat.CATEGORY_REMINDER).build();
        try{NotificationManagerCompat.from(c).notify(ID,n);}catch(SecurityException ignored){cancel(c);return;}
        sent.add(now);
        prefs(c).edit().putString("history",new JSONArray(sent).toString()).putInt("sentMask",prefs(c).getInt("sentMask",0)|((1<<(plan.stage+1))-1)).apply();
        schedule(c);
    }
}
