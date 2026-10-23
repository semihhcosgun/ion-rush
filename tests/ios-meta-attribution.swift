import Foundation
final class FakeMeta: IonMetaAttributionClient {
    var starts = 0, activations = 0, suspensions = 0
    func start() { starts += 1 }
    func activate() { activations += 1 }
    func suspend() { suspensions += 1 }
}
@main struct Checks {
    static func main() {
        for debug in [true, false] { for simulator in [true, false] {
            let client = FakeMeta()
            let c = IonMetaAttributionController(policy: .init(testBuild: debug, simulator: simulator), client: client)
            c.becameActive(); c.setEnabled(true, configured: true)
            precondition(client.starts == ((!debug && !simulator) ? 1 : 0))
        } }
        let client = FakeMeta()
        let c = IonMetaAttributionController(policy: .init(testBuild: false, simulator: false), client: client)
        c.becameActive(); c.setEnabled(true, configured: false); c.setEnabled(false, configured: true)
        precondition(client.starts == 0 && client.activations == 0)
        c.setEnabled(true, configured: true); c.setEnabled(true, configured: true); c.becameActive()
        precondition(client.starts == 1 && client.activations == 1)
        c.becameInactive(); c.becameActive(); precondition(client.activations == 2)
        c.setEnabled(false, configured: true); c.becameInactive(); c.becameActive()
        precondition(client.activations == 2 && client.suspensions == 1)
        c.setEnabled(true, configured: true); precondition(client.starts == 1 && client.activations == 3)
        c.setEnabled(false, configured: true); c.becameInactive(); c.setEnabled(true, configured: true)
        precondition(client.activations == 3); c.becameActive()
        precondition(client.activations == 4 && client.starts == 1)
        print("Meta release isolation, opt-out, missing credentials, session deduplication and re-enable passed.")
    }
}
