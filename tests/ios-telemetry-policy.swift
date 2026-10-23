import Foundation

@main
struct PolicyChecks {
    static func main() {
        let release = IonTelemetryPolicy(testBuild: false, simulator: false, qaRequested: false)
        precondition(release.allowsUpload(configured: true, consent: true))
        precondition(!release.allowsUpload(configured: false, consent: true))
        precondition(!release.allowsUpload(configured: true, consent: false))
        let debug = IonTelemetryPolicy(testBuild: true, simulator: false, qaRequested: false)
        precondition(!debug.allowsUpload(configured: true, consent: true))
        let qa = IonTelemetryPolicy(testBuild: true, simulator: false, qaRequested: true)
        precondition(qa.qaUpload && qa.allowsUpload(configured: true, consent: true))
        precondition(!qa.allowsUpload(configured: true, consent: false))
        for testBuild in [true, false] {
            let sim = IonTelemetryPolicy(testBuild: testBuild, simulator: true, qaRequested: true)
            precondition(!sim.qaUpload && !sim.allowsUpload(configured: true, consent: true))
        }
        precondition(IonTelemetryPolicy.validEvent(name: "run_start", params: ["distance": 42, "run_id": "test"]))
        precondition(!IonTelemetryPolicy.validEvent(name: "unknown", params: [:]))
        precondition(!IonTelemetryPolicy.validEvent(name: "run_start", params: ["bad key": 1]))
        precondition(!IonTelemetryPolicy.validEvent(name: "run_start", params: ["distance": Double.nan]))
        precondition(!IonTelemetryPolicy.validEvent(name: "run_start", params: ["distance": true]))
        precondition(!IonTelemetryPolicy.validEvent(name: "run_start", params: ["run_id": String(repeating: "x", count: 101)]))
        precondition(!IonTelemetryPolicy.validEvent(name: "run_start", params: ["nested": ["value": 1]]))
        let tooMany = Dictionary(uniqueKeysWithValues: (0..<26).map { ("p\($0)", $0 as Any) })
        precondition(!IonTelemetryPolicy.validEvent(name: "run_checkpoint", params: tooMany))
        print("iOS telemetry: consent, QA isolation and payload checks passed.")
    }
}
