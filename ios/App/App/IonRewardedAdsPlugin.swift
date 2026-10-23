import Capacitor
import GoogleMobileAds
import UserMessagingPlatform

@objc(IonRewardedAdsPlugin)
public class IonRewardedAdsPlugin: CAPPlugin, CAPBridgedPlugin, FullScreenContentDelegate {
    public let identifier = "IonRewardedAdsPlugin"
    public let jsName = "IonRewardedAds"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showPrivacyOptions", returnType: CAPPluginReturnPromise)
    ]
    private var ad: RewardedAd?
    private var loadedAt: Date?
    private var loading = false
    private var initializing = false
    private var initialized = false
    private var presenting = false
    private var earned = false
    private var showCall: CAPPluginCall?
    private var lastReason = "not_initialized"
    private var consentGeneration = 0
    private var unitID: String {
        // Opt in only for archives exported with testFlightInternalTestingOnly.
        #if DEBUG || ION_REWARDED_AD_DEMO
        return "ca-app-pub-3940256099942544/1712485313"
        #else
        return Bundle.main.object(forInfoDictionaryKey: "IONRewardedAdUnitID") as? String ?? ""
        #endif
    }
    private var configured: Bool {
        #if DEBUG || ION_REWARDED_AD_DEMO
        return true
        #else
        let appID = Bundle.main.object(forInfoDictionaryKey: "GADApplicationIdentifier") as? String ?? ""
        return appID.hasPrefix("ca-app-pub-") && appID.contains("~") && unitID.hasPrefix("ca-app-pub-")
            && !appID.contains("3940256099942544") && !unitID.contains("3940256099942544")
        #endif
    }
    @MainActor private func snapshot() -> [String: Any] {
        if let loadedAt, Date().timeIntervalSince(loadedAt) > 3_500 { ad = nil; self.loadedAt = nil }
        return ["configured": configured, "ready": ad != nil && !presenting && ConsentInformation.shared.canRequestAds,
                "privacyOptionsRequired": ConsentInformation.shared.privacyOptionsRequirementStatus == .required,
                "reason": configured ? lastReason : "not_configured"]
    }
    @MainActor private func preload() {
        guard configured, initialized, ConsentInformation.shared.canRequestAds, !loading, !presenting, ad == nil else { return }
        loading = true; lastReason = "loading"
        let generation = consentGeneration
        Task { @MainActor [weak self] in
            guard let self else { return }
            defer {
                self.loading = false
                if generation != self.consentGeneration { self.preload() }
            }
            do {
                let loaded = try await RewardedAd.load(with: self.unitID, request: Request())
                guard generation == self.consentGeneration, ConsentInformation.shared.canRequestAds else { self.lastReason = "consent_required"; return }
                self.ad = loaded; self.loadedAt = Date(); loaded.fullScreenContentDelegate = self
                self.lastReason = "ready"
            } catch { self.lastReason = "load_failed" }
        }
    }
    @objc func initialize(_ call: CAPPluginCall) {
        Task { @MainActor [weak self] in
            guard let self else { call.resolve(["configured": false, "ready": false]); return }
            guard self.configured, !self.initializing else { call.resolve(self.snapshot()); return }
            if self.initialized { self.preload(); call.resolve(self.snapshot()); return }
            self.initializing = true
            defer { self.initializing = false }
            let config = MobileAds.shared.requestConfiguration
            config.setPublisherFirstPartyIDEnabled(false)
            config.publisherPrivacyPersonalizationState = .disabled
            config.maxAdContentRating = .general
            do {
                try await ConsentInformation.shared.requestConsentInfoUpdate(with: RequestParameters())
                try await ConsentForm.loadAndPresentIfRequired(from: self.bridge?.viewController)
            } catch { self.lastReason = "consent_unavailable" }
            if ConsentInformation.shared.canRequestAds {
                await MobileAds.shared.start()
                self.initialized = true; self.preload()
            }
            call.resolve(self.snapshot())
        }
    }
    @objc func status(_ call: CAPPluginCall) {
        Task { @MainActor in
            let result = self.snapshot(); self.preload(); call.resolve(result)
        }
    }
    @objc func show(_ call: CAPPluginCall) {
        Task { @MainActor in
            _ = self.snapshot()
            guard !self.presenting else { call.resolve(["rewarded": false, "reason": "ad_in_progress"]); return }
            guard ConsentInformation.shared.canRequestAds, let ad = self.ad,
                  let controller = self.bridge?.viewController else {
                self.preload(); call.resolve(["rewarded": false, "reason": "not_ready"]); return
            }
            do { try ad.canPresent(from: controller) }
            catch { self.ad = nil; self.loadedAt = nil; self.preload(); call.resolve(["rewarded": false, "reason": "show_failed"]); return }
            self.presenting = true; self.earned = false; self.showCall = call
            // Currency/revive is granted only after the SDK's earned-reward callback.
            ad.present(from: controller) { [weak self] in self?.earned = true }
        }
    }
    @MainActor private func finishPresentation(reason: String) {
        let call = showCall; showCall = nil
        let reward = earned; earned = false; presenting = false; ad = nil; loadedAt = nil
        call?.resolve(["rewarded": reward, "reason": reward ? "completed" : reason])
        preload()
    }
    public func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        Task { @MainActor in self.finishPresentation(reason: "closed") }
    }
    public func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        Task { @MainActor in self.finishPresentation(reason: "show_failed") }
    }
    @objc func showPrivacyOptions(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard !self.presenting, ConsentInformation.shared.privacyOptionsRequirementStatus == .required else {
                call.resolve(["shown": false]); return
            }
            self.consentGeneration += 1; self.ad = nil; self.loadedAt = nil
            do {
                try await ConsentForm.presentPrivacyOptionsForm(from: self.bridge?.viewController)
                self.preload(); call.resolve(["shown": true])
            } catch { self.preload(); call.resolve(["shown": false]) }
        }
    }
}
