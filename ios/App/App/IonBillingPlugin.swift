import Capacitor
import Foundation

@objc(IonBillingPlugin)
public class IonBillingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "IonBillingPlugin"
    public let jsName = "IonBilling"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "claims", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "completeClaims", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "revocations", returnType: CAPPluginReturnPromise)
    ]
    override public func load() {
        Task { @MainActor [weak self] in
            IonStoreBilling.shared.onClaimsChanged = { [weak self] in self?.notifyListeners("claimsChanged", data: [:]) }
            IonStoreBilling.shared.start()
        }
    }
    @objc func initialize(_ call: CAPPluginCall) { Task { @MainActor in call.resolve(await IonStoreBilling.shared.initialize()) } }
    @objc func products(_ call: CAPPluginCall) { Task { @MainActor in call.resolve(await IonStoreBilling.shared.products()) } }
    @objc func purchase(_ call: CAPPluginCall) {
        Task { @MainActor in call.resolve(await IonStoreBilling.shared.purchase(call.getString("productId") ?? "", presentingIn: self.bridge?.viewController)) }
    }
    @objc func sync(_ call: CAPPluginCall) {
        Task { @MainActor in call.resolve(["synced": await IonStoreBilling.shared.sync(userInitiated: call.getBool("userInitiated") ?? false)]) }
    }
    @objc func claims(_ call: CAPPluginCall) {
        Task { @MainActor in
            do { call.resolve(["claims": try IonStoreBilling.shared.claims(excluding: Set(call.getArray("knownIds", String.self) ?? []))]) }
            catch { call.reject("Purchase delivery storage is unavailable", nil, error) }
        }
    }
    @objc func completeClaims(_ call: CAPPluginCall) {
        Task { @MainActor in
            do { call.resolve(["completed": try await IonStoreBilling.shared.complete(call.getArray("ids", String.self) ?? [])]) }
            catch { call.reject("Could not persist purchase delivery", nil, error) }
        }
    }
    @objc func revocations(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                let knownIDs = Set(call.getArray("knownIds", String.self) ?? [])
                call.resolve(["configured": true, "revocations": try IonStoreBilling.shared.revocations(matching: knownIDs)])
            } catch { call.reject("Refund delivery storage is unavailable", nil, error) }
        }
    }
}
