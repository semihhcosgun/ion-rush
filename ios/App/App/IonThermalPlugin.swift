import Capacitor
import Foundation

@objc(IonThermalPlugin)
public class IonThermalPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "IonThermalPlugin"
    public let jsName = "IonThermal"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPowerStatus", returnType: CAPPluginReturnPromise)
    ]
    private var observer: NSObjectProtocol?
    private var powerObserver: NSObjectProtocol?

    public override func load() {
        // Reading first enables ProcessInfo's thermal notifications.
        _ = ProcessInfo.processInfo.thermalState
        observer = NotificationCenter.default.addObserver(
            forName: ProcessInfo.thermalStateDidChangeNotification,
            object: nil, queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            self.notifyListeners("thermalStateChanged", data: self.status(), retainUntilConsumed: true)
        }
        powerObserver = NotificationCenter.default.addObserver(
            forName: .NSProcessInfoPowerStateDidChange,
            object: nil, queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            self.notifyListeners("powerStateChanged", data: self.powerStatus(), retainUntilConsumed: true)
        }
    }

    private func status() -> [String: Any] {
        let state: String
        switch ProcessInfo.processInfo.thermalState {
        case .nominal: state = "nominal"
        case .fair: state = "fair"
        case .serious: state = "serious"
        case .critical: state = "critical"
        @unknown default: return ["supported": false, "state": "nominal"]
        }
        return ["supported": true, "state": state]
    }

    @objc func getStatus(_ call: CAPPluginCall) { call.resolve(status()) }
    private func powerStatus() -> [String: Any] {
        ["supported": true, "lowPower": ProcessInfo.processInfo.isLowPowerModeEnabled]
    }
    @objc func getPowerStatus(_ call: CAPPluginCall) { call.resolve(powerStatus()) }
    deinit {
        if let observer { NotificationCenter.default.removeObserver(observer) }
        if let powerObserver { NotificationCenter.default.removeObserver(powerObserver) }
    }
}
