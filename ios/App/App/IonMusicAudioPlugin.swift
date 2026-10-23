import Capacitor
import AVFAudio
import UIKit

@objc(IonMusicAudioPlugin)
public class IonMusicAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "IonMusicAudioPlugin"
    public let jsName = "IonMusicAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "engine", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise)
    ]
    private var enabled = false
    private var needsActivation = true
    private var voices: [AVAudioPlayer] = []
    private var players: [String: [AVAudioPlayer]] = [:]
    private var enginePlayer: AVAudioPlayer?
    private var soundtrack: AVAudioPlayer?
    private var menuTracks: [String: AVAudioPlayer] = [:]
    private var menuTrackId = "ion-heart"
    private var menuTrack: AVAudioPlayer?
    private var raceWanted = false
    private var menuWanted = false
    private var musicRevision = 0
    private var observers: [NSObjectProtocol] = []
    private var timer: Timer?
    private var externalMusic: Bool?
    private var variation = 0
    private var duckUntil = Date.distantPast

    public override func load() {
        for name in [UIApplication.willResignActiveNotification, AVAudioSession.interruptionNotification] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] note in
                if name == UIApplication.willResignActiveNotification || (note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt) == AVAudioSession.InterruptionType.began.rawValue { self?.stopAll(); self?.needsActivation = true }
            })
        }
        for name in [UIApplication.didBecomeActiveNotification, AVAudioSession.silenceSecondaryAudioHintNotification] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in self?.publishStatus() })
        }
        // Some mixing players do not emit the secondary-audio hint. Check only while foregrounded.
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            if UIApplication.shared.applicationState == .active { self?.publishStatus() }
        }
    }
    private func status() -> [String: Any] {
        let audio = AVAudioSession.sharedInstance()
        let result: [String: Any] = ["supported": true, "playing": audio.isOtherAudioPlaying || audio.secondaryAudioShouldBeSilencedHint]
        #if DEBUG
        // Debug-only local diagnostics: external detection flags and our bundled menu player state.
        if let root = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first {
            let snapshot: [String: Any] = ["otherAudio": audio.isOtherAudioPlaying, "secondaryHint": audio.secondaryAudioShouldBeSilencedHint, "playing": result["playing"]!, "checkedAt": Date().timeIntervalSince1970,
                "menuTrack": menuTrackId, "menuPlaying": menuTrack?.isPlaying ?? false,
                "menuTime": menuTrack?.currentTime ?? 0, "menuDuration": menuTrack?.duration ?? 0,
                "menuLoops": menuTrack?.numberOfLoops ?? 0, "menuVolume": menuTrack?.volume ?? 0,
                "menuFile": menuTrack?.url?.lastPathComponent ?? "", "menuWanted": menuWanted]
            if let data = try? JSONSerialization.data(withJSONObject: snapshot) { try? data.write(to: root.appendingPathComponent("music-audio-status.json"), options: .atomic) }
        }
        #endif
        return result
    }
    private func publishStatus() {
        let value = status()["playing"] as? Bool ?? false
        if externalMusic != value { externalMusic = value; notifyListeners("externalMusicChanged", data: ["supported": true, "playing": value]) }
    }
    @objc func getStatus(_ call: CAPPluginCall) { DispatchQueue.main.async { call.resolve(self.status()) } }
    private func session() throws {
        // Keep the user's player at its chosen volume; no exclusive playback or ducking.
        let audio = AVAudioSession.sharedInstance()
        try audio.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try audio.setActive(true)
        needsActivation = false
    }
    @objc func configure(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.stopAll(); self.enabled = call.getBool("enabled") ?? false
            do {
                if self.enabled { try self.session(); if self.players.isEmpty { try self.preparePlayers() } }
                else { try AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation]) }
                self.publishStatus(); call.resolve()
            } catch { self.enabled = false; call.reject("Game audio could not be configured", nil, error) }
        }
    }
    private func preparePlayers() throws {
        guard let root = Bundle.main.resourceURL?.appendingPathComponent("public/audio") else { throw NSError(domain: "IonMusicAudio", code: 1) }
        var prepared: [String: [AVAudioPlayer]] = [:]
        for folder in ["game-effects", "music-mode"] {
            for url in try FileManager.default.contentsOfDirectory(at: root.appendingPathComponent(folder), includingPropertiesForKeys: nil) where url.pathExtension == "wav" {
                let name = url.deletingPathExtension().lastPathComponent
                if name == "engine" {
                    let player = try AVAudioPlayer(contentsOf: url); player.numberOfLoops = -1; player.enableRate = true; player.prepareToPlay(); enginePlayer = player
                } else {
                    prepared[folder + ":" + name] = try (0..<2).map { _ in let player = try AVAudioPlayer(contentsOf: url); player.prepareToPlay(); return player }
                }
            }
        }
        let music = try AVAudioPlayer(contentsOf: root.appendingPathComponent("ion-race-loop.wav")); music.numberOfLoops = -1; music.volume = 0.24; music.prepareToPlay(); soundtrack = music
        let theme = try AVAudioPlayer(contentsOf: root.appendingPathComponent("ion-menu-ion-heart.wav")); theme.numberOfLoops = -1; theme.volume = 0; theme.prepareToPlay(); menuTracks["ion-heart"] = theme
        let menu = try AVAudioPlayer(contentsOf: root.appendingPathComponent("ion-menu-loop.wav")); menu.numberOfLoops = -1; menu.volume = 0; menu.prepareToPlay(); menuTracks["before-the-jump"] = menu
        let alternate = try AVAudioPlayer(contentsOf: root.appendingPathComponent("ion-menu-afterglow.wav")); alternate.numberOfLoops = -1; alternate.volume = 0; alternate.prepareToPlay(); menuTracks["afterglow-station"] = alternate
        menuTrack = menuTracks[menuTrackId]
        players = prepared
    }
    @objc func play(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.enabled, UIApplication.shared.applicationState == .active, let kind = call.getString("kind") else { call.resolve(); return }
            let mode = call.getBool("musicMode") ?? false
            let n = ["shot", "enemyHit"].contains(kind) ? self.variation % 4 : 0; self.variation += 1
            let key = (mode ? "music-mode:" : "game-effects:") + kind + (n == 0 ? "" : "-\(n)")
            guard let pool = self.players[key], let player = pool.first(where: { !$0.isPlaying }) ?? pool.first else { call.resolve(); return }
            if self.needsActivation { do { try self.session() } catch { call.reject("Audio activation failed", nil, error); return } }
            self.voices.removeAll(where: { !$0.isPlaying || $0 === player })
            if self.voices.count >= 24 { self.voices.removeFirst().stop() }; self.voices.append(player)
            player.stop(); player.currentTime = 0; player.volume = Float(max(0, min(1, call.getDouble("volume") ?? 0))); player.play()
            if !mode && ["kill", "revive", "lessonStep", "lessonComplete", "supportCalled", "supportEnded", "supportReady", "supportBlocked"].contains(kind) {
                self.duckUntil = Date().addingTimeInterval(kind == "revive" ? 0.85 : kind == "supportCalled" ? 0.8 : 0.45); self.soundtrack?.volume = 0.09
            }
            call.resolve()
        }
    }
    @objc func engine(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let selection = call.getString("menuTrack") ?? "ion-heart"
            let requested = self.menuTracks[selection] != nil ? selection : "ion-heart"
            let selectionChanged = requested != self.menuTrackId
            if selectionChanged, let next = self.menuTracks[requested] {
                self.menuTrack?.pause(); self.menuTrack?.volume = 0
                self.menuTrackId = requested; self.menuTrack = next; self.menuWanted = false; self.musicRevision += 1
            }
            let active = self.enabled && UIApplication.shared.applicationState == .active
            if active && self.needsActivation && (call.getBool("running") == true || call.getBool("music") == true || call.getBool("menu") == true) { do { try self.session() } catch { call.reject("Audio activation failed", nil, error); return } }
            if active && call.getBool("running") == true, let player = self.enginePlayer {
                player.volume = Float(max(0, min(1, call.getDouble("volume") ?? 0)))
                player.rate = Float(max(0.6, min(2, call.getDouble("rate") ?? 1)))
                if !player.isPlaying { player.play() }
            } else { self.enginePlayer?.stop() }
            self.updateMusic(race: active && call.getBool("music") == true, menu: active && call.getBool("menu") == true && call.getBool("music") != true, force: selectionChanged)
            call.resolve()
        }
    }
    private func updateMusic(race: Bool, menu: Bool, force: Bool = false) {
        if race == raceWanted && menu == menuWanted && !force {
            if race { soundtrack?.setVolume(Date() < duckUntil ? 0.09 : 0.24, fadeDuration: 0.12) }
            return
        }
        raceWanted = race; menuWanted = menu; musicRevision += 1
        let revision = musicRevision
        if race, let player = soundtrack { if !player.isPlaying { player.volume = 0; player.play() }; player.setVolume(Date() < duckUntil ? 0.09 : 0.24, fadeDuration: 0.32) }
        else { soundtrack?.setVolume(0, fadeDuration: 0.32) }
        if menu, let player = menuTrack { if !player.isPlaying { player.volume = 0; player.play() }; player.setVolume(0.2, fadeDuration: 0.32) }
        else { menuTrack?.setVolume(0, fadeDuration: 0.32) }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.36) { [weak self] in
            guard let self, revision == self.musicRevision else { return }
            if !self.raceWanted { self.soundtrack?.pause() }
            if !self.menuWanted { self.menuTrack?.pause() }
        }
    }
    private func stopAll() { musicRevision += 1; raceWanted = false; menuWanted = false; for pool in players.values { for player in pool { player.stop() } }; voices.removeAll(); enginePlayer?.stop(); soundtrack?.pause(); soundtrack?.volume = 0; menuTrack?.pause(); menuTrack?.volume = 0 }
    @objc func stop(_ call: CAPPluginCall) { DispatchQueue.main.async { self.stopAll(); call.resolve() } }
    deinit { timer?.invalidate(); for observer in observers { NotificationCenter.default.removeObserver(observer) } }
}
