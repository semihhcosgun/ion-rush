package com.example.ionrush;

import android.Manifest;
import android.os.Build;
import android.content.Intent;
import android.provider.Settings;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;

@CapacitorPlugin(name="IonReminders",permissions={@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public class IonRemindersPlugin extends Plugin {
    @Override public void load(){FlightReminders.channel(getContext());}
    @PluginMethod public void status(PluginCall call){
        JSObject out=new JSObject();out.put("enabled",FlightReminders.prefs(getContext()).getBoolean("enabled",false));
        out.put("asked",FlightReminders.prefs(getContext()).getBoolean("asked",false));out.put("allowed",FlightReminders.allowed(getContext()));call.resolve(out);
    }
    @PluginMethod public void updateBest(PluginCall call){
        long best=Math.max(0,call.getDouble("best",0.0).longValue());
        FlightReminders.prefs(getContext()).edit().putLong("best",best).putString("language",ReminderCopy.normalizeLocale(call.getString("language"))).apply();FlightReminders.channel(getContext());call.resolve();
    }
    @PluginMethod public void disable(PluginCall call){
        FlightReminders.prefs(getContext()).edit().putBoolean("asked",true).putBoolean("enabled",false).apply();FlightReminders.cancel(getContext());status(call);
    }
    @PluginMethod public void enable(PluginCall call){
        FlightReminders.prefs(getContext()).edit().putBoolean("asked",true).apply();
        if(Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=PermissionState.GRANTED){requestPermissionForAlias("notifications",call,"permissionResult");return;}
        finishEnable(call);
    }
    @PermissionCallback private void permissionResult(PluginCall call){finishEnable(call);}
    private void finishEnable(PluginCall call){
        boolean allowed=FlightReminders.allowed(getContext());
        FlightReminders.prefs(getContext()).edit().putBoolean("enabled",allowed).apply();
        if(allowed)FlightReminders.schedule(getContext());else FlightReminders.cancel(getContext());status(call);
    }
    @PluginMethod public void openSettings(PluginCall call){
        Intent intent=new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getContext().getPackageName());
        getActivity().startActivity(intent);call.resolve();
    }
}
