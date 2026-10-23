import Foundation
import CoreFoundation

// Kept independent of Firebase so consent and payload guards can be tested offline.
struct IonTelemetryPolicy {
    let testBuild: Bool
    let simulator: Bool
    let qaRequested: Bool
    var qaUpload: Bool { testBuild && qaRequested && !simulator }
    func allowsUpload(configured: Bool, consent: Bool) -> Bool {
        configured && consent && !simulator && (!testBuild || qaUpload)
    }

    static let eventNames: Set<String> = [
        "support_used", "tutorial_step", "run_start", "run_end", "run_checkpoint",
        "damage_taken", "pickup_resolved", "turbo_used", "enemy_encounter_start",
        "enemy_encounter_end", "destination_reached", "rift_presented", "rift_entered",
        "rift_ended", "ship_core_presented", "ship_started", "ship_ended", "archive_opened",
        "archive_card_viewed", "app_backgrounded", "performance_summary"
    ]
    static func validEvent(name: String, params: [String: Any]) -> Bool {
        guard eventNames.contains(name), params.count <= 25 else { return false }
        return params.allSatisfy { key, value in
            guard key.range(of: "^[a-z][a-z0-9_]{0,39}$", options: .regularExpression) != nil else { return false }
            if let value = value as? String { return value.count <= 100 }
            if let value = value as? NSNumber {
                return CFGetTypeID(value) != CFBooleanGetTypeID() && value.doubleValue.isFinite
            }
            return false
        }
    }
}
