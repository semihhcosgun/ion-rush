import XCTest
import StoreKit
import StoreKitTest

@MainActor
final class StoreKitIntegrationTests: XCTestCase {
    private func verifiedTransaction(_ id: UInt64, revoked: Bool = false) async throws -> VerificationResult<Transaction> {
        // The local store applies transaction/receipt changes asynchronously.
        // Wait for the signed state, not only the legacy test-session state.
        for _ in 0..<100 {
            for await verification in Transaction.all {
                if case .verified(let item) = verification, item.id == id,
                   (item.revocationDate != nil) == revoked { return verification }
            }
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        throw NSError(domain: "StoreKitFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: "Verified StoreKit state did not arrive for transaction \(id), revoked=\(revoked)"])
    }

    private func buy(_ session: SKTestSession, _ productID: String) async throws -> Transaction {
        let transaction = try await session.buyProduct(identifier: productID)
        _ = try await verifiedTransaction(transaction.id)
        return transaction
    }

    private func refund(_ session: SKTestSession, _ _transaction: Transaction) async throws {
        try session.refundTransaction(identifier: UInt(_transaction.id))
        _ = try await verifiedTransaction(_transaction.id, revoked: true)
    }

    private var testBillings: [IonStoreBilling] = []

    private func relaunchedBilling(_ url: URL) -> IonStoreBilling {
        let billing = IonStoreBilling(ledgerURL: url)
        testBillings.append(billing)
        return billing
    }

    private func stopAllObservers() async {
        // StoreKitTest shares one environment and reuses transaction IDs after
        // clearTransactions. Drain listeners before resetting the next fixture.
        let observers = testBillings.compactMap { $0.stopObservation() }
        for observer in observers { await observer.value }
        testBillings = []
    }

    private func fixture(_ body: (SKTestSession, IonStoreBilling, URL) async throws -> Void) async throws {
        let session = try SKTestSession(configurationFileNamed: "NOVA")
        session.resetToDefaultState()
        session.askToBuyEnabled = false
        session.interruptedPurchasesEnabled = false
        session.disableDialogs = true
        session.clearTransactions()
        try await AppStore.sync()
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let url = directory.appendingPathComponent("billing.json")
        let billing = IonStoreBilling(ledgerURL: url)
        testBillings.append(billing)
        do { try await body(session, billing, url) }
        catch { await stopAllObservers(); throw error }
        await stopAllObservers()
    }

    func testCatalogAndAllThreeConsumablesDeliverAndFinish() async throws {
        try await fixture { session, billing, _ in
            let status = await billing.initialize()
            XCTAssertEqual(status["ready"] as? Bool, true)
            let products = try XCTUnwrap(status["products"] as? [[String: Any]])
            XCTAssertEqual(products.count, 3)
            XCTAssertTrue(products.allSatisfy { ($0["available"] as? Bool) == true && ($0["price"] as? String) != "—" })
            for id in IonBillingLedger.order {
                let transaction = try await self.buy(session, id)
                var verification: VerificationResult<Transaction>?
                for await entry in Transaction.unfinished {
                    if case .verified(let item) = entry, item.id == transaction.id { verification = entry; break }
                }
                let verified = try XCTUnwrap(verification)
                let result = await billing.processPurchase(.success(verified), for: id)
                XCTAssertEqual(result["purchased"] as? Bool, true, id)
            }
            let claims = try billing.claims()
            XCTAssertEqual(claims.count, 3)
            XCTAssertEqual(claims.compactMap { $0["nova"] as? Int }.reduce(0, +), 60)
            let completed = try await billing.complete(claims.compactMap { $0["id"] as? String })
            XCTAssertEqual(completed, 3)
            XCTAssertTrue(try billing.claims(excluding: Set(claims.compactMap { $0["id"] as? String })).isEmpty)
            var unfinished = 0
            for await _ in Transaction.unfinished { unfinished += 1 }
            XCTAssertEqual(unfinished, 0)
        }
    }

    func testCancellationAndPendingNeverCreateCurrency() async throws {
        try await fixture { _, billing, _ in
            _ = await billing.initialize()
            let cancelled = await billing.processPurchase(.userCancelled, for: "example_nova_5")
            XCTAssertEqual(cancelled["purchased"] as? Bool, false)
            XCTAssertEqual(cancelled["reason"] as? String, "cancelled")
            let pending = await billing.processPurchase(.pending, for: "example_nova_15")
            XCTAssertEqual(pending["pending"] as? Bool, true)
            XCTAssertTrue(try billing.claims().isEmpty)
        }
    }

    func testExternalPurchaseArrivesThroughTransactionUpdates() async throws {
        try await fixture { session, billing, _ in
            _ = await billing.initialize()
            XCTAssertTrue(try billing.claims().isEmpty)
            let delivered = expectation(description: "External verified purchase received")
            billing.onClaimsChanged = { delivered.fulfill() }
            _ = try await self.buy(session, "example_nova_15")
            await fulfillment(of: [delivered], timeout: 10)
            XCTAssertEqual(try billing.claims().first?["nova"] as? Int, 15)
        }
    }

    func testRestartRecoversUnfinishedDeliveryWithoutDuplicate() async throws {
        try await fixture { session, billing, url in
            _ = await billing.initialize()
            _ = try await self.buy(session, "example_nova_40")
            try await billing.recover()
            let initial = try billing.claims()
            XCTAssertEqual(initial.count, 1)
            await billing.stopObservation()?.value
            let relaunched = self.relaunchedBilling(url)
            try await relaunched.recover()
            XCTAssertEqual(try relaunched.claims().first?["id"] as? String, initial.first?["id"] as? String)
            _ = try await relaunched.complete(initial.compactMap { $0["id"] as? String })
            try await relaunched.recover()
            XCTAssertTrue(try relaunched.claims(excluding: Set(initial.compactMap { $0["id"] as? String })).isEmpty)
        }
    }

    func testCrashAfterAcknowledgmentBeforeFinishDoesNotAwardAgain() async throws {
        try await fixture { session, billing, url in
            _ = await billing.initialize()
            _ = try await self.buy(session, "example_nova_5")
            try await billing.recover()
            let claims = try billing.claims()
            XCTAssertEqual(claims.count, 1)
            await billing.stopObservation()?.value
            // Simulate the exact durable state between acknowledgment and finish.
            var persisted = try IonBillingLedger.load(from: url)
            _ = persisted.acknowledge(claims.compactMap { $0["id"] as? String })
            try persisted.persisted(to: url)
            let relaunched = self.relaunchedBilling(url)
            try await relaunched.recover()
            XCTAssertTrue(try relaunched.claims(excluding: Set(claims.compactMap { $0["id"] as? String })).isEmpty)
            var unfinished = 0
            for await _ in Transaction.unfinished { unfinished += 1 }
            XCTAssertEqual(unfinished, 0)
        }
    }
    func testCompletedReceiptRepairsLostWebWalletSave() async throws {
        try await fixture { session, billing, url in
            _ = await billing.initialize()
            _ = try await self.buy(session, "example_nova_15")
            try await billing.recover()
            let claim = try XCTUnwrap(try billing.claims().first)
            let id = try XCTUnwrap(claim["id"] as? String)
            _ = try await billing.complete([id])
            await billing.stopObservation()?.value
            let relaunched = self.relaunchedBilling(url)
            // The app's atomic receipt journal survives a lost Preferences write.
            XCTAssertEqual(try relaunched.claims().first?["nova"] as? Int, 15)
            XCTAssertTrue(try relaunched.claims(excluding: [id]).isEmpty)
            let repeated = try await relaunched.complete([id])
            XCTAssertEqual(repeated, 0)
        }
    }

    func testAskToBuyApprovalAfterPendingEmitsDurableClaimOnce() async throws {
        try await fixture { session, billing, url in
            _ = await billing.initialize()
            session.askToBuyEnabled = true
            let result = await billing.purchase("example_nova_15")
            XCTAssertEqual(result["pending"] as? Bool, true)
            XCTAssertTrue(try billing.claims().isEmpty)
            let pending = try XCTUnwrap(session.allTransactions().first)
            let approved = expectation(description: "Delayed approval saved and announced")
            var events = 0
            billing.onClaimsChanged = {
                events += 1
                XCTAssertEqual(try? IonBillingLedger.load(from: url).pending.values.first?.nova, 15)
                approved.fulfill()
            }
            try session.approveAskToBuyTransaction(identifier: pending.identifier)
            await fulfillment(of: [approved], timeout: 10)
            try await billing.recover()
            XCTAssertEqual(events, 1)
            let claims = try billing.claims()
            XCTAssertEqual(claims.count, 1)
            XCTAssertEqual(claims.first?["nova"] as? Int, 15)
            _ = try await billing.complete(claims.compactMap { $0["id"] as? String })
            try await billing.recover()
            XCTAssertEqual(events, 1)
        }
    }

    func testAskToBuyDeclineNeverEmitsClaimOrRefund() async throws {
        try await fixture { session, billing, _ in
            _ = await billing.initialize()
            session.askToBuyEnabled = true
            let result = await billing.purchase("example_nova_5")
            XCTAssertEqual(result["pending"] as? Bool, true)
            let pending = try XCTUnwrap(session.allTransactions().first)
            var events = 0
            billing.onClaimsChanged = { events += 1 }
            try session.declineAskToBuyTransaction(identifier: pending.identifier)
            try await billing.recover()
            XCTAssertTrue(try billing.claims().isEmpty)
            XCTAssertTrue(try billing.revocations(matching: ["apple-\(pending.identifier)"]).isEmpty)
            XCTAssertEqual(events, 0)
        }
    }

    func testRefundBeforeFirstDeliverySuppressesGrantAcrossRestart() async throws {
        try await fixture { session, billing, url in
            // No observer or delivery runs until after the store finalizes the refund.
            let transaction = try await self.buy(session, "example_nova_5")
            try await self.refund(session, transaction)
            try await billing.recover()
            let id = "apple-\(transaction.id)"
            XCTAssertTrue(try billing.claims().isEmpty)
            XCTAssertEqual(try billing.revocations(matching: [id]).first?["nova"] as? Int, 5)
            await billing.stopObservation()?.value
            let relaunched = self.relaunchedBilling(url)
            try await relaunched.recover()
            XCTAssertTrue(try relaunched.claims().isEmpty)
            XCTAssertEqual(try relaunched.revocations(matching: [id]).count, 1)
        }
    }

    func testFinishedRefundEmitsEventOnlyAfterDurableRevocationOnSync() async throws {
        try await fixture { session, billing, url in
            _ = await billing.initialize()
            let transaction = try await self.buy(session, "example_nova_15")
            try await billing.recover()
            let id = "apple-\(transaction.id)"
            _ = try await billing.complete([id])
            let refund = expectation(description: "Verified finished refund saved and announced")
            var events = 0
            billing.onClaimsChanged = {
                events += 1
                let persisted = try? IonBillingLedger.load(from: url)
                XCTAssertEqual(persisted?.revocations?[id]?.nova, 15)
                XCTAssertNil(persisted?.delivered?[id])
                refund.fulfill()
            }
            try await self.refund(session, transaction)
            try await billing.recover()
            await fulfillment(of: [refund], timeout: 10)
            XCTAssertTrue(try billing.claims().isEmpty)
            XCTAssertEqual(try billing.revocations(matching: [id]).first?["id"] as? String, id)
            try await billing.recover()
            try await billing.recover()
            XCTAssertEqual(events, 1)
        }
    }

    func testMissedFinishedRefundRecoveredFromHistoryOnSync() async throws {
        try await fixture { session, billing, url in
            _ = await billing.initialize()
            let transaction = try await self.buy(session, "example_nova_40")
            try await billing.recover()
            let id = "apple-\(transaction.id)"
            _ = try await billing.complete([id])
            await billing.stopObservation()?.value
            try await self.refund(session, transaction)
            let relaunched = self.relaunchedBilling(url)
            let synced = await relaunched.sync(userInitiated: false)
            XCTAssertTrue(synced)
            XCTAssertTrue(try relaunched.claims().isEmpty)
            XCTAssertEqual(try relaunched.revocations(matching: [id]).first?["nova"] as? Int, 40)
            XCTAssertTrue(try relaunched.revocations(matching: ["foreign-id"]).isEmpty)
        }
    }

    func testFinishedUnrevokedHistoryNeverRegrantsWithFreshJournal() async throws {
        try await fixture { session, billing, _ in
            let transaction = try await self.buy(session, "example_nova_15")
            await transaction.finish()
            var foundFinished = false
            for await verification in Transaction.all {
                if case .verified(let item) = verification, item.id == transaction.id { foundFinished = true }
            }
            XCTAssertTrue(foundFinished, "The full-history setting must be exercised by this test")
            try await billing.recover()
            XCTAssertTrue(try billing.claims().isEmpty)
            XCTAssertTrue(try billing.revocations(matching: ["apple-\(transaction.id)"]).isEmpty)
        }
    }

    func testUnverifiedPurchaseNeverCreatesGrant() async throws {
        try await fixture { session, billing, _ in
            let transaction = try await self.buy(session, "example_nova_5")
            let result = await billing.processPurchase(.success(.unverified(transaction, .invalidSignature)), for: "example_nova_5")
            XCTAssertEqual(result["purchased"] as? Bool, false)
            XCTAssertEqual(result["reason"] as? String, "verification_failed")
            XCTAssertTrue(try billing.claims().isEmpty)
        }
    }

    func testFailedJournalWriteRetriesWithoutPrematureEvent() async throws {
        try await fixture { session, billing, url in
            _ = await billing.initialize()
            let directory = url.deletingLastPathComponent()
            try Data("blocking parent".utf8).write(to: directory)
            var events = 0
            billing.onClaimsChanged = { events += 1 }
            _ = try await self.buy(session, "example_nova_5")
            do { try await billing.recover(); XCTFail("Expected durable write to fail") }
            catch { }
            XCTAssertEqual(events, 0)
            XCTAssertThrowsError(try billing.claims())
            try FileManager.default.removeItem(at: directory)
            try await billing.recover()
            XCTAssertEqual(events, 1)
            XCTAssertEqual(try billing.claims().first?["nova"] as? Int, 5)
        }
    }

    func testUnfinishedRefundRecoveredByMenuSyncEmitsDurableEvent() async throws {
        try await fixture { session, billing, url in
            _ = await billing.initialize()
            let transaction = try await self.buy(session, "example_nova_5")
            try await billing.recover()
            let id = "apple-\(transaction.id)"
            XCTAssertEqual(try billing.claims().count, 1)
            let refunded = expectation(description: "Verified unfinished refund update")
            billing.onClaimsChanged = {
                XCTAssertEqual(try? IonBillingLedger.load(from: url).revocations?[id]?.nova, 5)
                refunded.fulfill()
            }
            try await self.refund(session, transaction)
            try await billing.recover()
            await fulfillment(of: [refunded], timeout: 10)
            XCTAssertTrue(try billing.claims().isEmpty)
        }
    }

    func testUnverifiedRefundCannotRemoveDurableGrant() async throws {
        try await fixture { session, billing, _ in
            // Feed the same observer entry point without starting an observer.
            let transaction = try await self.buy(session, "example_nova_15")
            try await billing.receive(.verified(transaction))
            let id = "apple-\(transaction.id)"
            try await self.refund(session, transaction)
            var refunded: Transaction?
            for await verification in Transaction.all {
                if case .verified(let item) = verification, item.id == transaction.id, item.revocationDate != nil { refunded = item }
            }
            let finalized = try XCTUnwrap(refunded)
            var events = 0
            billing.onClaimsChanged = { events += 1 }
            try await billing.receive(.unverified(finalized, .invalidSignature))
            XCTAssertEqual(try billing.claims().count, 1)
            XCTAssertTrue(try billing.revocations(matching: [id]).isEmpty)
            XCTAssertEqual(events, 0)
            try await billing.receive(.verified(finalized))
            XCTAssertTrue(try billing.claims().isEmpty)
            XCTAssertEqual(try billing.revocations(matching: [id]).first?["nova"] as? Int, 15)
            XCTAssertEqual(events, 1)
        }
    }

}
