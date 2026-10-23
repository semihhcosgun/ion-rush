package com.example.ionrush;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.AudioPlaybackConfiguration;
import android.media.MediaPlayer;
import android.media.SoundPool;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@CapacitorPlugin(name="IonMusicAudio")
public class IonMusicAudioPlugin extends Plugin {
    private SoundPool pool;
    private MediaPlayer soundtrack;
    private MediaPlayer menuTrack;
    private final Map<String,MediaPlayer> menuTracks = new HashMap<>();
    private String menuTrackId = "ion-heart";
    private final Handler musicHandler = new Handler(Looper.getMainLooper());
    private Runnable musicFade;
    private boolean raceWanted = false, menuWanted = false;
    private float raceLevel = 0, menuLevel = 0;
    private final Map<String,Integer> sounds = new HashMap<>();
    private final Set<Integer> ready = new HashSet<>(), streams = new LinkedHashSet<>();
    private PluginCall loading;
    private boolean enabled = false, foreground = true;
    private Boolean externalMusic;
    private int engineStream = 0, variation = 0;
    private long duckUntil = 0;
    private AudioManager manager;
    private AudioManager.AudioPlaybackCallback callback;

    @Override public void load() {
        manager = (AudioManager)getContext().getSystemService(Context.AUDIO_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && manager != null) {
            callback = new AudioManager.AudioPlaybackCallback() {
                @Override public void onPlaybackConfigChanged(List<AudioPlaybackConfiguration> configurations) { publishStatus(); }
            };
            manager.registerAudioPlaybackCallback(callback,new Handler(Looper.getMainLooper()));
        }
    }
    private JSObject status() {
        boolean supported = Build.VERSION.SDK_INT >= 26 && manager != null, playing = false;
        if (supported) {
            // Our own effects AND soundtrack use USAGE_GAME, so they cannot trigger the offer.
            for (AudioPlaybackConfiguration config : manager.getActivePlaybackConfigurations()) {
                int usage = config.getAudioAttributes().getUsage();
                if (usage == AudioAttributes.USAGE_MEDIA) { playing = true; break; }
            }
        }
        JSObject result = new JSObject(); result.put("supported",supported); result.put("playing",playing); return result;
    }
    private void publishStatus() {
        JSObject value = status(); boolean playing = value.optBoolean("playing");
        if (externalMusic == null || externalMusic != playing) { externalMusic = playing;notifyListeners("externalMusicChanged",value); }
    }
    @PluginMethod public void getStatus(PluginCall call) { getActivity().runOnUiThread(() -> call.resolve(status())); }
    @PluginMethod public void configure(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            release(); enabled = call.getBoolean("enabled", false);
            if (!enabled) { call.resolve(); return; }
            try {
                // Never take focus away from the user's music player.
                AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
                pool = new SoundPool.Builder().setMaxStreams(24).setAudioAttributes(attributes).build();
                loading = call;
                pool.setOnLoadCompleteListener((loaded,id,status) -> getActivity().runOnUiThread(() -> {
                    if (loaded != pool || loading == null) return;
                    if (status != 0) { PluginCall pending = loading; release(); enabled = false; pending.reject("Effect loading failed"); return; }
                    ready.add(id);
                    if (ready.size() == sounds.size()) { PluginCall pending = loading; loading = null; pending.resolve(); }
                }));
                for (String folder : new String[]{"game-effects","music-mode"}) {
                    String base = "public/audio/"+folder;
                    for (String file : getContext().getAssets().list(base)) {
                        if (!file.endsWith(".wav")) continue;
                        try (AssetFileDescriptor descriptor = getContext().getAssets().openFd(base+"/"+file)) {
                            int id = pool.load(descriptor,1); if(id == 0) throw new IllegalStateException("Invalid effect");
                            sounds.put(folder+":"+file.substring(0,file.length()-4),id);
                        }
                    }
                }
                soundtrack = prepareMusic("ion-race-loop.wav");
                menuTracks.put("ion-heart",prepareMusic("ion-menu-ion-heart.wav"));
                menuTracks.put("before-the-jump",prepareMusic("ion-menu-loop.wav"));
                menuTracks.put("afterglow-station",prepareMusic("ion-menu-afterglow.wav"));
                menuTrack = menuTracks.get(menuTrackId);
                if (sounds.isEmpty()) throw new IllegalStateException("Missing effects");
                publishStatus();
            } catch (Exception error) { release(); enabled = false; call.reject("Game audio could not be configured",error); }
        });
    }
    @PluginMethod public void play(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            String kind = call.getString("kind", "");boolean mode = call.getBoolean("musicMode",false);
            int n = (kind.equals("shot") || kind.equals("enemyHit")) ? variation++ % 4 : 0;
            Integer id = sounds.get((mode?"music-mode:":"game-effects:")+kind+(n==0?"":"-"+n));
            if (foreground && enabled && pool != null && id != null && ready.contains(id)) {
                float volume = (float)Math.max(0,Math.min(1,call.getDouble("volume",0.0)));
                int stream = pool.play(id,volume,volume,2,0,1);
                if (stream != 0) { streams.add(stream); if (streams.size()>24) { int oldest=streams.iterator().next();pool.stop(oldest);streams.remove(oldest); } }
                if (!mode && java.util.Arrays.asList("kill","revive","lessonStep","lessonComplete","supportCalled","supportEnded","supportReady","supportBlocked").contains(kind)) {
                    duckUntil = android.os.SystemClock.uptimeMillis()+(kind.equals("revive")?850:kind.equals("supportCalled")?800:450);
                    if(soundtrack!=null && raceWanted){raceLevel=.09f;soundtrack.setVolume(.09f,.09f);}
                }
            }
            call.resolve();
        });
    }
    @PluginMethod public void engine(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (pool == null) { call.resolve(); return; }
            Integer id = sounds.get("music-mode:engine");
            if (!foreground || !enabled || !call.getBoolean("running",false) || id == null || !ready.contains(id)) {
                if (engineStream != 0) pool.stop(engineStream); engineStream = 0;
            } else {
                float volume = (float)Math.max(0,Math.min(1,call.getDouble("volume",0.0))),rate = (float)Math.max(.6,Math.min(2,call.getDouble("rate",1.0)));
                if (engineStream == 0) engineStream = pool.play(id,volume,volume,1,-1,rate);
                else { pool.setVolume(engineStream,volume,volume); pool.setRate(engineStream,rate); }
            }
            String selection = call.getString("menuTrack", "ion-heart");
            String requested = menuTracks.containsKey(selection) ? selection : "ion-heart";
            boolean selectionChanged = !requested.equals(menuTrackId);
            if (selectionChanged && menuTracks.containsKey(requested)) {
                if(musicFade!=null)musicHandler.removeCallbacks(musicFade);musicFade=null;
                if(menuTrack!=null){if(menuTrack.isPlaying())menuTrack.pause();menuTrack.setVolume(0,0);}
                menuTrackId=requested;menuTrack=menuTracks.get(requested);menuWanted=false;menuLevel=0;
            }
            boolean race = foreground && enabled && call.getBoolean("music",false);
            updateMusic(race,foreground && enabled && call.getBoolean("menu",false) && !race,selectionChanged);
            call.resolve();
        });
    }
    private MediaPlayer prepareMusic(String file) throws Exception {
        MediaPlayer player = new MediaPlayer();
        try {
            player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
            try (AssetFileDescriptor descriptor = getContext().getAssets().openFd("public/audio/"+file)) {
                player.setDataSource(descriptor.getFileDescriptor(),descriptor.getStartOffset(),descriptor.getLength());
            }
            player.setLooping(true);player.setVolume(0,0);player.prepare();return player;
        } catch (Exception error) { player.release();throw error; }
    }
    private void updateMusic(boolean race, boolean menu, boolean force) {
        if(soundtrack==null || menuTrack==null)return;
        if(race==raceWanted && menu==menuWanted && !force) {
            if(race && musicFade==null){raceLevel=android.os.SystemClock.uptimeMillis()<duckUntil?.09f:.24f;soundtrack.setVolume(raceLevel,raceLevel);}
            return;
        }
        raceWanted=race;menuWanted=menu;
        if(musicFade!=null)musicHandler.removeCallbacks(musicFade);
        if(race && !soundtrack.isPlaying())soundtrack.start();
        if(menu && !menuTrack.isPlaying())menuTrack.start();
        final float startRace=raceLevel,startMenu=menuLevel;
        musicFade=new Runnable(){
            int step=0;
            @Override public void run(){
                float progress=++step/12f;
                float targetRace=raceWanted?(android.os.SystemClock.uptimeMillis()<duckUntil?.09f:.24f):0;
                raceLevel=startRace+(targetRace-startRace)*progress;
                menuLevel=startMenu+((menuWanted?.2f:0)-startMenu)*progress;
                soundtrack.setVolume(raceLevel,raceLevel);menuTrack.setVolume(menuLevel,menuLevel);
                if(step<12)musicHandler.postDelayed(this,30);
                else {musicFade=null;if(!raceWanted && soundtrack.isPlaying())soundtrack.pause();if(!menuWanted && menuTrack.isPlaying())menuTrack.pause();}
            }
        };
        musicHandler.post(musicFade);
    }
    private void stopAll() { if(musicFade!=null)musicHandler.removeCallbacks(musicFade);musicFade=null;raceWanted=false;menuWanted=false;raceLevel=0;menuLevel=0;if(pool != null) { for(int id:streams)pool.stop(id); if(engineStream!=0)pool.stop(engineStream); } streams.clear();engineStream=0;if(soundtrack!=null){if(soundtrack.isPlaying())soundtrack.pause();soundtrack.setVolume(0,0);}if(menuTrack!=null){if(menuTrack.isPlaying())menuTrack.pause();menuTrack.setVolume(0,0);} }
    @PluginMethod public void stop(PluginCall call) { getActivity().runOnUiThread(() -> { stopAll();call.resolve(); }); }
    private void release() { stopAll();if(pool!=null)pool.release();if(soundtrack!=null)soundtrack.release();for(MediaPlayer track:menuTracks.values())track.release();menuTracks.clear();soundtrack=null;menuTrack=null;pool=null;sounds.clear();ready.clear();loading=null; }
    @Override protected void handleOnPause() { foreground=false;stopAll();super.handleOnPause(); }
    @Override protected void handleOnResume() { foreground=true;publishStatus();super.handleOnResume(); }
    @Override protected void handleOnDestroy() { if(Build.VERSION.SDK_INT>=26 && manager!=null && callback!=null)manager.unregisterAudioPlaybackCallback(callback);release();super.handleOnDestroy(); }
}
