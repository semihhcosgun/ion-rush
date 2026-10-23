import Capacitor
import UIKit
import UserNotifications

final class IonFlightReminders: NSObject, UNUserNotificationCenterDelegate, NotificationHandlerProtocol {
    static let shared = IonFlightReminders()
    static let prefix = "ion.flight-reminder."
    private let center = UNUserNotificationCenter.current()
    private let queue = DispatchQueue(label: "com.nullshiftlab.ionrush.reminders")
    private let storageKey = "ion.flight-reminders.state"
    private var state: IonReminderState
    private var foreground = true
    private var revision = 0
    private var consentRevision = 0

    private override init() {
        if let data = UserDefaults.standard.data(forKey: "ion.flight-reminders.state"),
           let saved = try? JSONDecoder().decode(IonReminderState.self, from: data) { state = saved }
        else { state = IonReminderState() }
        super.init()
    }

    func start() { center.delegate = self }
    private func save() {
        if let data = try? JSONEncoder().encode(state) { UserDefaults.standard.set(data, forKey: storageKey) }
    }
    private static func allowed(_ settings: UNNotificationSettings) -> Bool {
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral: return true
        default: return false
        }
    }

    func status(_ completion: @escaping ([String: Any]) -> Void) {
        center.getNotificationSettings { settings in
            self.queue.async {
                completion(["enabled": self.state.enabled, "asked": self.state.asked,
                            "allowed": Self.allowed(settings)])
            }
        }
    }

    func enable(_ completion: @escaping (Error?) -> Void) {
        queue.async {
            self.consentRevision += 1; let consent = self.consentRevision
            self.state.asked = true; self.save()
            self.center.requestAuthorization(options: [.alert, .sound]) { _, error in
                self.center.getNotificationSettings { settings in
                    self.queue.async {
                        guard consent == self.consentRevision else { completion(nil); return }
                        self.state.enabled = error == nil && Self.allowed(settings)
                        self.save(); self.rebuild { completion(error) }
                    }
                }
            }
        }
    }

    func disable(_ completion: @escaping () -> Void) {
        queue.async {
            self.consentRevision += 1
            self.state.asked = true; self.state.enabled = false; self.save()
            self.rebuild(completion)
        }
    }

    func updateBest(_ best: Double, language: String, completion: @escaping () -> Void) {
        queue.async {
            self.state.best = best.isFinite ? Int64(min(max(0, best.rounded(.down)), 9_007_199_254_740_991)) : 0
            self.state.language = IonReminderCopy.normalizeLocale(language); self.save()
            if self.foreground { completion() } else { self.rebuild(completion) }
        }
    }

    func active() { transition(active: true, completion: {}) }
    func inactive(completion: @escaping () -> Void) { transition(active: false, completion: completion) }
    private func transition(active: Bool, completion: @escaping () -> Void) {
        queue.async {
            self.foreground = active; self.state.lastActive = Date(); self.save()
            self.rebuild(completion)
        }
    }

    /// Called only on our serial queue. Every asynchronous pass has a generation
    /// so returning, opting out, or changing language cannot add stale requests.
    private func rebuild(_ completion: @escaping () -> Void) {
        revision += 1; let generation = revision
        center.getDeliveredNotifications { delivered in
            self.center.getPendingNotificationRequests { pending in
                self.center.getNotificationSettings { settings in
                    self.queue.async {
                        guard generation == self.revision else { completion(); return }
                        let ownDelivered = delivered.filter { $0.request.identifier.hasPrefix(Self.prefix) }
                        let ownPending = pending.filter { $0.identifier.hasPrefix(Self.prefix) }
                        let now = Date()
                        self.state.reconcile(now: now, delivered: ownDelivered.map {
                            IonReminderDelivery(id: $0.request.identifier, at: $0.date)
                        })
                        self.center.removePendingNotificationRequests(withIdentifiers: ownPending.map(\.identifier))
                        self.center.removeDeliveredNotifications(withIdentifiers: ownDelivered.map { $0.request.identifier })
                        self.save()
                        guard !self.foreground, self.state.enabled, Self.allowed(settings) else { completion(); return }
                        let plans = IonReminderPolicy.sequence(now: now, lastActive: self.state.lastActive,
                                                               history: self.state.history.map(\.at))
                        self.add(plans, index: 0, generation: generation, completion: completion)
                    }
                }
            }
        }
    }

    private func add(_ plans: [IonReminderPolicy.Plan], index: Int, generation: Int,
                     completion: @escaping () -> Void) {
        guard generation == revision, index < plans.count else { completion(); return }
        let plan = plans[index]
        let id = Self.prefix + UUID().uuidString + ".\(plan.stage)"
        let copy = IonReminderCopy.forLanguage(state.language)
        let content = UNMutableNotificationContent()
        content.title = copy.titles[plan.stage]
        content.body = copy.body(stage: plan.stage, best: state.best, language: state.language)
        content.sound = .default
        content.threadIdentifier = "ion-flight-reminders"
        content.userInfo = ["kind": "flightReminder", "stage": plan.stage]
        // Floating local calendar components preserve daytime hours after travel.
        let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: plan.at)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
        state.scheduled.append(IonScheduledReminder(id: id, stage: plan.stage, at: plan.at)); save()
        center.add(request) { error in
            self.queue.async {
                if generation != self.revision || error != nil {
                    self.center.removePendingNotificationRequests(withIdentifiers: [id])
                    self.state.scheduled.removeAll { $0.id == id }; self.save()
                }
                if let error { NSLog("ION RUSH reminder scheduling failed: %@", error.localizedDescription) }
                self.add(plans, index: index + 1, generation: generation, completion: completion)
            }
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler(willPresent(notification: notification))
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        didReceive(response: response)
        completionHandler()
    }

    func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        // Never interrupt an active run with a return-to-game reminder.
        notification.request.identifier.hasPrefix(Self.prefix) ? [] : [.banner, .list, .sound]
    }

    func didReceive(response: UNNotificationResponse) {
        if response.notification.request.identifier.hasPrefix(Self.prefix) {
            queue.async {
                self.state.history.append(IonReminderDelivery(id: response.notification.request.identifier,
                                                              at: response.notification.date))
                self.save()
            }
            // The standard notification action opens the app. Scene activation
            // clears the remaining reminders and restarts inactivity timing.
        }
    }
}

@objc(IonRemindersPlugin)
public class IonRemindersPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "IonRemindersPlugin"
    public let jsName = "IonReminders"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateBest", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]
    override public func load() {
        bridge?.notificationRouter.localNotificationHandler = IonFlightReminders.shared
    }
    @objc func status(_ call: CAPPluginCall) { IonFlightReminders.shared.status { call.resolve($0) } }
    @objc func enable(_ call: CAPPluginCall) {
        IonFlightReminders.shared.enable { error in
            if let error { call.reject("Could not request notifications", nil, error) }
            else { self.status(call) }
        }
    }
    @objc func disable(_ call: CAPPluginCall) { IonFlightReminders.shared.disable { self.status(call) } }
    @objc func updateBest(_ call: CAPPluginCall) {
        IonFlightReminders.shared.updateBest(call.getDouble("best") ?? 0, language: call.getString("language") ?? "en") { call.resolve() }
    }
    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let path: String
            if #available(iOS 16.0, *) { path = UIApplication.openNotificationSettingsURLString }
            else { path = UIApplication.openSettingsURLString }
            guard let url = URL(string: path) else { call.reject("Notification settings unavailable"); return }
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened { call.resolve() } else { call.reject("Could not open notification settings") }
            }
        }
    }
}
