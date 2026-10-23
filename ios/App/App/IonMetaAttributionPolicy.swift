import Foundation

// Meta production events must never come from debug, QA or Simulator runs.
struct IonMetaAttributionPolicy {
    let testBuild: Bool
    let simulator: Bool
    func allowsUpload(consent: Bool, configured: Bool) -> Bool {
        consent && configured && !testBuild && !simulator
    }
}

protocol IonMetaAttributionClient: AnyObject {
    func start()
    func activate()
    func suspend()
}

// A small state machine keeps repeated JS consent calls from duplicating sessions.
final class IonMetaAttributionController {
    let policy: IonMetaAttributionPolicy
    let client: IonMetaAttributionClient
    private(set) var enabled = false
    private(set) var started = false
    private(set) var active = false
    init(policy: IonMetaAttributionPolicy, client: IonMetaAttributionClient) {
        self.policy = policy
        self.client = client
    }
    func setEnabled(_ consent: Bool, configured: Bool) {
        let next = policy.allowsUpload(consent: consent, configured: configured)
        guard next != enabled else { return }
        enabled = next
        if enabled {
            if !started { client.start(); started = true }
            if active { client.activate() }
        } else if started {
            client.suspend()
        }
    }
    func becameActive() {
        guard !active else { return }
        active = true
        if enabled { client.activate() }
    }
    func becameInactive() { active = false }
}
