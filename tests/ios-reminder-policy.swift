import Foundation

@main
struct ReminderChecks {
    static var calendar: Calendar = {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Istanbul")!; return c
    }()
    static func at(_ day: Int, _ hour: Int, calendar c: Calendar = calendar) -> Date {
        c.date(from: DateComponents(year: 2026, month: 9, day: day, hour: hour))!
    }
    static func next(_ now: Date, _ active: Date, _ mask: Int = 0, _ history: [Date] = []) -> IonReminderPolicy.Plan? {
        IonReminderPolicy.next(now: now, lastActive: active, sentMask: mask, history: history, calendar: calendar)
    }
    static func main() throws {
        let active = at(1,15)
        var history: [Date] = [], mask = 0
        for i in 0..<3 {
            let p = next(active,active,mask,history)!
            precondition(p.stage == i && p.at == at([2,4,8][i],15))
            history.append(p.at); mask |= 1 << i
        }
        precondition(next(at(20,15),active,mask,history) == nil)
        precondition(next(at(1,23),at(1,23))!.at == at(3,10))
        precondition(next(at(2,2),at(1,2))!.at == at(2,10))
        precondition(next(at(2,23),active)!.at == at(3,10))
        let fractional = at(1,15).addingTimeInterval(0.25)
        precondition(next(fractional,fractional)!.at == at(2,15).addingTimeInterval(1))
        let quietBoundary = at(1,21).addingTimeInterval(-0.25)
        precondition(next(quietBoundary,quietBoundary)!.at == at(3,10))
        precondition(next(at(6,12),at(6,12),0,[at(1,15),at(3,15),at(5,15)])!.at == at(8,15))
        precondition(next(at(7,12),at(1,12),0,[at(7,11)])!.at == at(8,11))
        precondition(next(at(15,12),at(1,12))!.stage == 2)
        let coalesced = IonReminderPolicy.sequence(now: at(15,12),lastActive: at(1,12),history: [],calendar: calendar)
        precondition(coalesced.count == 1 && coalesced[0].at == at(15,12))

        for daysAgo in 0...14 {
            let now = at(20,23), last = now.addingTimeInterval(-Double(daysAgo)*IonReminderPolicy.day)
            let delivered = [at(15,15),at(17,15),at(19,15)]
            let planned = IonReminderPolicy.sequence(now: now,lastActive: last,history: delivered,calendar: calendar)
            let all = delivered + planned.map(\.at)
            for p in planned {
                let hour = calendar.component(.hour,from: p.at)
                precondition(hour >= 10 && hour < 21)
                precondition(all.filter { $0 < p.at && $0 > p.at.addingTimeInterval(-7*IonReminderPolicy.day) }.count < 3)
                precondition(all.filter { $0 < p.at }.allSatisfy { p.at.timeIntervalSince($0) >= IonReminderPolicy.day })
            }
        }
        var tokyo = calendar; tokyo.timeZone = TimeZone(identifier: "Asia/Tokyo")!
        let safe = IonReminderPolicy.daytime(at(8,15),calendar: tokyo)
        precondition(tokyo.component(.hour,from: safe) == 10 && safe > at(8,15))
        var ny = calendar; ny.timeZone = TimeZone(identifier: "America/New_York")!
        let beforeDST = ny.date(from: DateComponents(year:2026,month:3,day:7,hour:15))!
        let dstPlan = IonReminderPolicy.sequence(now: beforeDST,lastActive: beforeDST,history: [],calendar: ny)
        precondition(dstPlan[0].at.timeIntervalSince(beforeDST) == IonReminderPolicy.day)

        var state = IonReminderState()
        state.enabled = true; state.asked = true; state.best = 12_345; state.language = "tr"
        state.scheduled = [IonScheduledReminder(id:"dismissed",stage:0,at:at(2,15)),
                           IonScheduledReminder(id:"future",stage:1,at:at(4,15))]
        state.reconcile(now:at(3,15),delivered:[])
        precondition(state.history == [IonReminderDelivery(id:"dismissed",at:at(2,15))])
        precondition(state.scheduled.isEmpty) // Cancelling future slots doesn't count as delivery.
        state.reconcile(now:at(3,20),delivered:[IonReminderDelivery(id:"dismissed",at:at(3,16))])
        precondition(state.history.count == 1 && state.history[0].at == at(3,16))
        let saved = try JSONDecoder().decode(IonReminderState.self,from:JSONEncoder().encode(state))
        precondition(saved.enabled && saved.asked && saved.best == 12_345 && saved.language == "tr")
        state.reconcile(now:at(11,16),delivered:[]); precondition(state.history.isEmpty)

        for language in ["en","tr","es","pt-BR","de","fr"] {
            let copy = IonReminderCopy.forLanguage(language)
            precondition(copy.titles.count == 3 && copy.titles.allSatisfy { !$0.isEmpty })
            for stage in 0..<3 { precondition(!copy.body(stage:stage,best:0,language:language).isEmpty) }
            let record = copy.body(stage:1,best:12_345,language:language)
            precondition(!record.contains("{record}") && record.contains("12"))
        }
        precondition(IonReminderCopy.normalizeLocale(" PT_br ") == "pt-BR")
        precondition(IonReminderCopy.normalizeLocale("TR-tr") == "tr")
        precondition(IonReminderCopy.normalizeLocale("ja") == "en")
        precondition(IonReminderCopy.forLanguage("en").body(stage:1,best:12_345,language:"en").contains("12,345"))
        precondition(IonReminderCopy.forLanguage("tr").body(stage:1,best:12_345,language:"tr").contains("12.345"))
        print("iOS reminders: 1/3/7 days, quiet hours, daily/weekly caps, delayed coalescing, return history, persistence and six languages passed.")
    }
}
