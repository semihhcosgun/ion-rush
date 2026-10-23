import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = IonBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        IonMetaAttribution.becameActive()
        IonFlightReminders.shared.active()
    }

    func sceneWillResignActive(_ scene: UIScene) {
        IonMetaAttribution.becameInactive()
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        // Keep enough background time to hand all three local requests to iOS.
        var task = UIBackgroundTaskIdentifier.invalid
        task = UIApplication.shared.beginBackgroundTask(withName: "Flight reminders") {
            if task != .invalid { UIApplication.shared.endBackgroundTask(task); task = .invalid }
        }
        IonFlightReminders.shared.inactive {
            DispatchQueue.main.async {
                if task != .invalid { UIApplication.shared.endBackgroundTask(task); task = .invalid }
            }
        }
    }
}
