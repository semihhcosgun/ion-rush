package com.example.ionrush;

import android.os.Build;
import android.os.PowerManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name="IonThermal")
public class IonThermalPlugin extends Plugin {
    private PowerManager power;
    private PowerManager.OnThermalStatusChangedListener listener;
    private BroadcastReceiver powerReceiver;

    @Override public void load() {
        power = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
        if (Build.VERSION.SDK_INT >= 29 && power != null) {
            listener = value -> notifyListeners("thermalStateChanged", status(value), true);
            try { power.addThermalStatusListener(getContext().getMainExecutor(), listener); }
            catch (RuntimeException unavailable) { listener = null; }
        }
        powerReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                notifyListeners("powerStateChanged", powerStatus(), true);
            }
        };
        try {
            ContextCompat.registerReceiver(getContext(), powerReceiver,
                new IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED);
        } catch (RuntimeException unavailable) { powerReceiver = null; }
    }

    private JSObject status(int value) {
        if (value < PowerManager.THERMAL_STATUS_NONE || value > PowerManager.THERMAL_STATUS_SHUTDOWN) return unsupported();
        String state = value >= PowerManager.THERMAL_STATUS_CRITICAL ? "critical"
            : value >= PowerManager.THERMAL_STATUS_SEVERE ? "serious"
            : value >= PowerManager.THERMAL_STATUS_LIGHT ? "fair" : "nominal";
        JSObject out = new JSObject();
        out.put("supported", true);out.put("state", state);return out;
    }

    @PluginMethod public void getStatus(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 29 && power != null) {
            try { call.resolve(status(power.getCurrentThermalStatus())); }
            catch (RuntimeException unavailable) { call.resolve(unsupported()); }
        } else {
            call.resolve(unsupported());
        }
    }

    private JSObject unsupported() {
        JSObject out = new JSObject();out.put("supported", false);out.put("state", "nominal");return out;
    }

    private JSObject powerStatus() {
        JSObject out = new JSObject();out.put("supported", power != null);
        if (power != null) {
            try { out.put("lowPower", power.isPowerSaveMode()); }
            catch (RuntimeException unavailable) { out.put("supported", false); }
        }
        return out;
    }
    @PluginMethod public void getPowerStatus(PluginCall call) { call.resolve(powerStatus()); }

    @Override protected void handleOnDestroy() {
        if (powerReceiver != null) {
            try { getContext().unregisterReceiver(powerReceiver); }
            catch (RuntimeException unavailable) { /* Already unregistered. */ }
            powerReceiver = null;
        }
        if (Build.VERSION.SDK_INT >= 29 && power != null && listener != null) {
            try { power.removeThermalStatusListener(listener); }
            catch (RuntimeException unavailable) { /* The service has already stopped. */ }
            listener = null;
        }
        super.handleOnDestroy();
    }
}
