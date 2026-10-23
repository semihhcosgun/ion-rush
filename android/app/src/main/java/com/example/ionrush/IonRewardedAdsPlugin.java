package com.example.ionrush;

import android.app.Activity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name="IonRewardedAds")
public class IonRewardedAdsPlugin extends Plugin {
    private RewardedAd rewardedAd;
    private ConsentInformation consentInformation;
    private boolean adsInitialized=false;
    private boolean loading=false;

    @PluginMethod public void initialize(PluginCall call) {
        Activity activity=getActivity();
        activity.runOnUiThread(()->{
            consentInformation=UserMessagingPlatform.getConsentInformation(activity);
            ConsentRequestParameters params=new ConsentRequestParameters.Builder().build();
            consentInformation.requestConsentInfoUpdate(activity,params,
                ()->UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity,formError->{
                    if(consentInformation.canRequestAds())startAds(activity);
                    call.resolve(statusObject(formError==null?null:"consent_form_error"));
                }),
                requestError->{
                    if(consentInformation.canRequestAds())startAds(activity);
                    call.resolve(statusObject("consent_update_error"));
                });
        });
    }

    private void startAds(Activity activity) {
        if(adsInitialized){loadRewarded();return;}
        MobileAds.initialize(activity,initializationStatus->{adsInitialized=true;loadRewarded();});
    }

    private void loadRewarded() {
        if(loading||rewardedAd!=null||!adsInitialized)return;
        loading=true;
        AdRequest request=new AdRequest.Builder().build();
        RewardedAd.load(getContext(),getContext().getString(R.string.ion_rewarded_ad_unit_id),request,new RewardedAdLoadCallback(){
            @Override public void onAdLoaded(RewardedAd ad){loading=false;rewardedAd=ad;}
            @Override public void onAdFailedToLoad(LoadAdError error){loading=false;rewardedAd=null;}
        });
    }

    private JSObject statusObject(String reason) {
        JSObject result=new JSObject();
        result.put("configured",adsInitialized);
        result.put("ready",rewardedAd!=null);
        result.put("privacyOptionsRequired",consentInformation!=null&&consentInformation.getPrivacyOptionsRequirementStatus()==ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED);
        if(reason!=null)result.put("reason",reason);
        return result;
    }

    @PluginMethod public void status(PluginCall call) {
        getActivity().runOnUiThread(()->{if(rewardedAd==null)loadRewarded();call.resolve(statusObject(null));});
    }

    @PluginMethod public void show(PluginCall call) {
        getActivity().runOnUiThread(()->{
            RewardedAd ad=rewardedAd;
            if(ad==null){loadRewarded();JSObject result=new JSObject();result.put("rewarded",false);result.put("reason","not_ready");call.resolve(result);return;}
            rewardedAd=null;
            AtomicBoolean earned=new AtomicBoolean(false);
            ad.setFullScreenContentCallback(new FullScreenContentCallback(){
                @Override public void onAdDismissedFullScreenContent(){JSObject result=new JSObject();result.put("rewarded",earned.get());if(!earned.get())result.put("reason","not_completed");call.resolve(result);loadRewarded();}
                @Override public void onAdFailedToShowFullScreenContent(AdError error){JSObject result=new JSObject();result.put("rewarded",false);result.put("reason","show_failed");call.resolve(result);loadRewarded();}
            });
            ad.show(getActivity(),rewardItem->earned.set(true));
        });
    }

    @PluginMethod public void showPrivacyOptions(PluginCall call) {
        getActivity().runOnUiThread(()->UserMessagingPlatform.showPrivacyOptionsForm(getActivity(),formError->{JSObject result=new JSObject();result.put("shown",formError==null);call.resolve(result);}));
    }
}
