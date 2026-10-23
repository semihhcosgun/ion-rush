import UIKit
import FacebookCore

private final class IonMetaSDKClient: IonMetaAttributionClient {
    func start() {
        // Use only the app's install/activation endpoint. No IDFA, purchases,
        // codeless events, gameplay mirroring, login, or AEM deep-link collection.
        Settings.shared.loggingBehaviors = []
        Settings.shared.appID = "1462228882437432"
        Settings.shared.displayName = "ION RUSH"
        Settings.shared.clientToken = IonMetaAttribution.clientToken
        Settings.shared.isAutoLogAppEventsEnabled = false
        Settings.shared.isAdvertiserIDCollectionEnabled = false
        Settings.shared.isEventDataUsageLimited = true
        Settings.shared.isSKAdNetworkReportEnabled = true
        ApplicationDelegate.shared.application(UIApplication.shared, didFinishLaunchingWithOptions: nil)
        AppEvents.shared.flushBehavior = .explicitOnly
    }
    func activate() {
        Settings.shared.isSKAdNetworkReportEnabled = true
        AppEvents.shared.activateApp()
        AppEvents.shared.flush()
    }
    func suspend() {
        Settings.shared.isAutoLogAppEventsEnabled = false
        Settings.shared.isAdvertiserIDCollectionEnabled = false
        Settings.shared.isSKAdNetworkReportEnabled = false
        AppEvents.shared.flushBehavior = .explicitOnly
    }
}

enum IonMetaAttribution {
    static var clientToken: String? {
        guard let url = Bundle.main.url(forResource: "MetaClientToken", withExtension: "txt"),
              let value = try? String(contentsOf: url, encoding: .utf8) else { return nil }
        let token = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard token.range(of: "^[A-Za-z0-9_-]{16,255}$", options: .regularExpression) != nil else { return nil }
        return token
    }
    static var configured: Bool { clientToken != nil }
    private static let controller: IonMetaAttributionController = {
        #if DEBUG
        let testBuild = true
        #else
        let testBuild = (Bundle.main.object(forInfoDictionaryKey: "IONTelemetryQA") as? NSString)?.boolValue ?? false
        #endif
        #if targetEnvironment(simulator)
        let simulator = true
        #else
        let simulator = false
        #endif
        return IonMetaAttributionController(
            policy: IonMetaAttributionPolicy(testBuild: testBuild, simulator: simulator),
            client: IonMetaSDKClient())
    }()
    static func setEnabled(_ enabled: Bool) {
        DispatchQueue.main.async {
            controller.setEnabled(enabled, configured: configured)
            writeDebugStatus()
        }
    }
    static func becameActive() {
        controller.becameActive()
        writeDebugStatus()
    }
    static func becameInactive() { controller.becameInactive() }
    private static func writeDebugStatus() {
        #if DEBUG
        let status: [String: Any] = ["configured": configured,
            "enabled": controller.enabled, "sdkStarted": controller.started,
            "active": controller.active, "testBuild": controller.policy.testBuild,
            "simulator": controller.policy.simulator, "advertiserIDCollection": false]
        if let url = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first,
           let data = try? JSONSerialization.data(withJSONObject: status, options: .sortedKeys) {
            try? data.write(to: url.appendingPathComponent("meta-attribution-status.json"), options: .atomic)
        }
        #endif
    }
}
