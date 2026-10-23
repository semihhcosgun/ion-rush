package com.example.ionrush;

import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;
import com.google.firebase.analytics.FirebaseAnalytics;
import com.google.firebase.crashlytics.FirebaseCrashlytics;
import java.util.EnumMap;
import java.util.Iterator;

@CapacitorPlugin(name="IonTelemetry")
public class IonTelemetryPlugin extends Plugin {
    private FirebaseAnalytics analytics;
    private FirebaseCrashlytics crashes;
    private boolean enabled=false;
    private boolean isTestBuild() { return (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE)!=0; }
    private boolean qaUpload() { return isTestBuild() && getContext().getResources().getBoolean(R.bool.ion_telemetry_qa); }
    @Override public void load() {
        if (FirebaseApp.getApps(getContext()).isEmpty()) return;
        analytics=FirebaseAnalytics.getInstance(getContext());
        crashes=FirebaseCrashlytics.getInstance();
        // Collection stays off until the web layer restores the player's explicit preference.
        analytics.setAnalyticsCollectionEnabled(false);
        crashes.setCrashlyticsCollectionEnabled(false);
    }
    @PluginMethod public void status(PluginCall call) {
        JSObject result=new JSObject();result.put("configured",analytics!=null);result.put("testBuild",isTestBuild());result.put("qaUpload",qaUpload());call.resolve(result);
    }
    @PluginMethod public void setEnabled(PluginCall call) {
        enabled=Boolean.TRUE.equals(call.getBoolean("enabled",false))&&(!isTestBuild()||qaUpload())&&analytics!=null;
        if(analytics!=null) {
            EnumMap<FirebaseAnalytics.ConsentType,FirebaseAnalytics.ConsentStatus> consent=new EnumMap<>(FirebaseAnalytics.ConsentType.class);
            consent.put(FirebaseAnalytics.ConsentType.ANALYTICS_STORAGE,enabled?FirebaseAnalytics.ConsentStatus.GRANTED:FirebaseAnalytics.ConsentStatus.DENIED);
            consent.put(FirebaseAnalytics.ConsentType.AD_STORAGE,FirebaseAnalytics.ConsentStatus.DENIED);
            consent.put(FirebaseAnalytics.ConsentType.AD_USER_DATA,FirebaseAnalytics.ConsentStatus.DENIED);
            consent.put(FirebaseAnalytics.ConsentType.AD_PERSONALIZATION,FirebaseAnalytics.ConsentStatus.DENIED);
            analytics.setConsent(consent);analytics.setAnalyticsCollectionEnabled(enabled);
            crashes.setCrashlyticsCollectionEnabled(enabled);
            crashes.setCustomKey("is_test",isTestBuild());
            if(!enabled){analytics.resetAnalyticsData();crashes.deleteUnsentReports();}
        }
        call.resolve();
    }
    @PluginMethod public void logEvent(PluginCall call) {
        if(!enabled||analytics==null){call.reject("Telemetry is disabled");return;}
        String name=call.getString("name","");JSObject values=call.getObject("params",new JSObject());
        if(!name.matches("[a-z][a-z0-9_]{0,39}")||values.length()>25){call.reject("Invalid event");return;}
        Bundle params=new Bundle();Iterator<String> keys=values.keys();
        while(keys.hasNext()){String key=keys.next();Object value=values.opt(key);if(value instanceof Number)params.putDouble(key,((Number)value).doubleValue());else if(value instanceof String)params.putString(key,(String)value);}
        analytics.logEvent(name,params);
        crashes.setCustomKey("last_event",name);
        if(values.has("run_id"))crashes.setCustomKey("run_id",values.optString("run_id"));
        if(values.has("distance"))crashes.setCustomKey("distance",values.optDouble("distance"));
        call.resolve();
    }
    @PluginMethod public void recordError(PluginCall call) {
        if(enabled&&crashes!=null){crashes.setCustomKey("js_stack",call.getString("stack",""));crashes.recordException(new RuntimeException(call.getString("code","javascript_error")));}call.resolve();
    }
}
