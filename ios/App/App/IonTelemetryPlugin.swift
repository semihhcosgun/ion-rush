import Capacitor
import FirebaseCore
import FirebaseAnalytics
import FirebaseCrashlytics

enum IonTelemetryRuntime {
    static let policy: IonTelemetryPolicy = {
        #if DEBUG || targetEnvironment(simulator)
        let testBuild = true
        #else
        let testBuild = false
        #endif
        #if targetEnvironment(simulator)
        let simulator = true
        #else
        let simulator = false
        #endif
        let qa = (Bundle.main.object(forInfoDictionaryKey: "IONTelemetryQA") as? NSString)?.boolValue ?? false
        return IonTelemetryPolicy(testBuild: testBuild, simulator: simulator, qaRequested: qa)
    }()
    private(set) static var configured = false
    private(set) static var enabled = false

    static func configure() {
        // Simulators never initialize Firebase or upload gameplay/crash data.
        guard !policy.simulator,
              let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
              let options = FirebaseOptions(contentsOfFile: path),
              options.bundleID == Bundle.main.bundleIdentifier,
              options.projectID == "ionrush", options.googleAppID.contains(":ios:"),
              !(options.apiKey ?? "").isEmpty else { return }
        FirebaseApp.configure(options: options)
        configured = true
        // Suspend while JS restores consent; do not erase offline reports or rotate
        // the analytics identifier on every consenting player's app launch.
        Analytics.setAnalyticsCollectionEnabled(false)
        Crashlytics.crashlytics().setCrashlyticsCollectionEnabled(false)
    }

    static func setEnabled(_ consent: Bool) {
        enabled = policy.allowsUpload(configured: configured, consent: consent)
        IonMetaAttribution.setEnabled(consent)
        guard configured else { return }
        Analytics.setConsent([
            .analyticsStorage: enabled ? .granted : .denied,
            .adStorage: .denied, .adUserData: .denied, .adPersonalization: .denied
        ])
        Analytics.setAnalyticsCollectionEnabled(enabled)
        let crashes = Crashlytics.crashlytics()
        crashes.setCrashlyticsCollectionEnabled(enabled)
        crashes.setCustomValue(policy.testBuild ? 1 : 0, forKey: "is_test")
        if !enabled {
            Analytics.resetAnalyticsData()
            crashes.deleteUnsentReports()
        }
    }
}

@objc(IonTelemetryPlugin)
public class IonTelemetryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "IonTelemetryPlugin"
    public let jsName = "IonTelemetry"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recordError", returnType: CAPPluginReturnPromise)
    ]

    @objc func status(_ call: CAPPluginCall) {
        call.resolve(["configured": IonTelemetryRuntime.configured,
                      "testBuild": IonTelemetryRuntime.policy.testBuild,
                      "qaUpload": IonTelemetryRuntime.policy.qaUpload])
    }
    @objc func setEnabled(_ call: CAPPluginCall) {
        IonTelemetryRuntime.setEnabled(call.getBool("enabled") ?? false)
        call.resolve()
    }
    @objc func logEvent(_ call: CAPPluginCall) {
        guard IonTelemetryRuntime.enabled else { call.reject("Telemetry is disabled"); return }
        let name = call.getString("name") ?? ""
        var params: [String: Any] = call.getObject("params") ?? [:]
        guard IonTelemetryPolicy.validEvent(name: name, params: params) else {
            call.reject("Invalid event"); return
        }
        // Native build identity wins even if the JS payload was tampered with.
        params["is_test"] = IonTelemetryRuntime.policy.testBuild ? 1 : 0
        params["app_version"] = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown"
        // Firebase's stream identifies iOS; leave room for full checkpoint payloads.
        guard IonTelemetryPolicy.validEvent(name: name, params: params) else {
            call.reject("Invalid event metadata"); return
        }
        Analytics.logEvent(name, parameters: params)
        let crashes = Crashlytics.crashlytics()
        crashes.setCustomValue(name, forKey: "last_event")
        if let run = params["run_id"] { crashes.setCustomValue(run, forKey: "run_id") }
        if let distance = params["distance"] { crashes.setCustomValue(distance, forKey: "distance") }
        call.resolve()
    }
    @objc func recordError(_ call: CAPPluginCall) {
        guard IonTelemetryRuntime.enabled else { call.resolve(); return }
        let code = call.getString("code") ?? "javascript_error"
        let allowed = ["javascript_error", "unhandled_rejection"]
        let sanitized = allowed.contains(code) ? code : "javascript_error"
        Crashlytics.crashlytics().setCustomValue(String((call.getString("stack") ?? "").prefix(3000)), forKey: "js_stack")
        Crashlytics.crashlytics().record(error: NSError(domain: "IONJavaScript", code: 1,
            userInfo: [NSLocalizedDescriptionKey: sanitized]))
        call.resolve()
    }
}
