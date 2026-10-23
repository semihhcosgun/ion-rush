import Foundation

/// Matches Android's elapsed-day cadence, local quiet hours and rolling limits.
enum IonReminderPolicy {
    static let day: TimeInterval = 86_400
    static let days = [1, 3, 7]
    struct Plan: Equatable { let stage: Int; let at: Date }

    static func daytime(_ date: Date, calendar: Calendar = .current) -> Date {
        let hour = calendar.component(.hour, from: date)
        guard hour < 10 || hour >= 21 else { return date }
        let base = hour >= 21 ? calendar.date(byAdding: .day, value: 1, to: date)! : date
        return calendar.date(bySettingHour: 10, minute: 0, second: 0, of: base)!
    }

    static func next(now: Date, lastActive: Date, sentMask: Int, history: [Date],
                     calendar: Calendar = .current) -> Plan? {
        var stage: Int?
        for i in days.indices where sentMask & (1 << i) == 0 {
            if stage == nil || lastActive.addingTimeInterval(Double(days[i]) * day) <= now { stage = i }
        }
        guard let stage else { return nil }
        var at = max(now, lastActive.addingTimeInterval(Double(days[stage]) * day))
        for sent in history { at = max(at, sent.addingTimeInterval(day)) }
        for _ in 0...history.count {
            at = daytime(at, calendar: calendar)
            let recent = history.filter { $0 > at.addingTimeInterval(-7 * day) }
            guard recent.count >= 3, let oldest = recent.min() else { break }
            at = oldest.addingTimeInterval(7 * day)
        }
        // Calendar triggers use whole seconds. Round up so truncation cannot
        // shorten the daily limit or deliver on the quiet-hours boundary.
        at = daytime(Date(timeIntervalSince1970: ceil(at.timeIntervalSince1970)), calendar: calendar)
        return Plan(stage: stage, at: at)
    }

    /// iOS delivers locally without waking our app, so reserve all three slots.
    static func sequence(now: Date, lastActive: Date, history: [Date],
                         calendar: Calendar = .current) -> [Plan] {
        var plans: [Plan] = [], reserved = history, mask = 0
        while let plan = next(now: now, lastActive: lastActive, sentMask: mask,
                              history: reserved, calendar: calendar) {
            plans.append(plan); reserved.append(plan.at)
            mask |= (1 << (plan.stage + 1)) - 1
        }
        return plans
    }
}

struct IonReminderDelivery: Codable, Equatable {
    let id: String
    let at: Date
}
struct IonScheduledReminder: Codable {
    let id: String
    let stage: Int
    let at: Date
}
struct IonReminderState: Codable {
    var enabled = false
    var asked = false
    var best: Int64 = 0
    var language = "en"
    var lastActive = Date()
    var history: [IonReminderDelivery] = []
    var scheduled: [IonScheduledReminder] = []

    mutating func reconcile(now: Date, delivered: [IonReminderDelivery]) {
        var dates: [String: Date] = [:]
        for item in history + delivered {
            dates[item.id] = max(dates[item.id] ?? item.at, item.at)
        }
        // Dismissed notifications no longer appear in Notification Center.
        // Count elapsed reservations conservatively so dismissing never resets limits.
        for item in scheduled where item.at <= now {
            dates[item.id] = max(dates[item.id] ?? item.at, item.at)
        }
        history = dates.filter { $0.value > now.addingTimeInterval(-7 * IonReminderPolicy.day) }
            .map { IonReminderDelivery(id: $0.key, at: $0.value) }.sorted { $0.at < $1.at }
        scheduled = []
    }
}
