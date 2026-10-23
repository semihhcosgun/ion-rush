import Foundation

@main struct BillingChecks {
    static func main() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("ledger.json")
        var ledger = try IonBillingLedger.load(from: url)
        precondition(!ledger.record(transactionID: 1,productID:"example_nova_5",verified:false,revoked:false))
        precondition(!ledger.record(transactionID: 1,productID:"example_nova_5",verified:true,revoked:true))
        precondition(!ledger.record(transactionID: 1,productID:"unknown",verified:true,revoked:false))
        precondition(ledger.pending.isEmpty)
        for (i,id) in IonBillingLedger.order.enumerated() {
            precondition(ledger.record(transactionID:UInt64(i+1),productID:id,verified:true,revoked:false))
        }
        precondition(ledger.pending.values.reduce(0){$0+$1.nova} == 60)
        precondition(!ledger.record(transactionID:1,productID:"example_nova_5",verified:true,revoked:false))
        precondition(ledger.pending.count == 3)
        try ledger.persisted(to:url)
        var reloaded = try IonBillingLedger.load(from:url)
        precondition(reloaded.pending == ledger.pending)
        precondition(reloaded.acknowledge(["apple-1","apple-1","unknown"]) == ["apple-1"])
        try reloaded.persisted(to:url)
        var afterCrash = try IonBillingLedger.load(from:url)
        precondition(!afterCrash.record(transactionID:1,productID:"example_nova_5",verified:true,revoked:false))
        precondition(afterCrash.pending.count == 2 && afterCrash.completed.contains("apple-1"))
        precondition(afterCrash.delivered?["apple-1"]?.nova == 5)
        // Before-delivery refunds suppress grants; after-delivery refunds retain
        // their exact identity/quantity across restarts, never replaying a grant.
        precondition(!afterCrash.revoke(transactionID: 2, productID: "example_nova_15", verified: false))
        precondition(!afterCrash.revoke(transactionID: 2, productID: "unknown", verified: true))
        precondition(afterCrash.revoke(transactionID: 2, productID: "example_nova_15", verified: true))
        precondition(afterCrash.pending["apple-2"] == nil)
        precondition(afterCrash.acknowledge(["apple-2"]).isEmpty)
        precondition(!afterCrash.record(transactionID: 2, productID: "example_nova_15", verified: true, revoked: false))
        precondition(afterCrash.revoke(transactionID: 1, productID: "example_nova_5", verified: true))
        precondition(afterCrash.delivered?["apple-1"] == nil)
        precondition(afterCrash.completed.contains("apple-1"))
        precondition(!afterCrash.revoke(transactionID: 1, productID: "example_nova_5", verified: true))
        try afterCrash.persisted(to: url)
        let refunded = try IonBillingLedger.load(from: url)
        precondition(refunded.revocations?["apple-1"]?.nova == 5)
        precondition(refunded.revocations?["apple-2"]?.nova == 15)
        // Both old journal schemas load without inventing or losing purchases.
        for old in [#"{"pending":{},"completed":["apple-99"]}"#,
                    #"{"pending":{},"completed":["apple-99"],"delivered":{"apple-99":{"id":"apple-99","productId":"example_nova_40","nova":40}}}"#] {
            try Data(old.utf8).write(to: url)
            var migrated = try IonBillingLedger.load(from: url)
            precondition(migrated.completed.contains("apple-99"))
            precondition(migrated.revocations == nil)
            precondition(migrated.revoke(transactionID: 99, productID: "example_nova_40", verified: true))
            precondition(migrated.revocations?["apple-99"]?.nova == 40)
            try migrated.persisted(to: url)
            let reloadedMigration = try IonBillingLedger.load(from: url)
            precondition(reloadedMigration.revocations == migrated.revocations)
        }
        try Data("broken".utf8).write(to:url)
        do { _ = try IonBillingLedger.load(from:url); preconditionFailure("A damaged ledger must not reset purchases") }
        catch { }
        print("iOS billing: verified consumables, exact quantities, durable claims, duplicate delivery, crash recovery, verified refunds, pre-delivery suppression, old-journal migration and corrupt-storage protection passed.")
    }
}
