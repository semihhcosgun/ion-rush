import Foundation
import StoreKit
import UIKit

@MainActor
final class IonStoreBilling {
    static let shared = IonStoreBilling()
    private var catalog: [String: Product] = [:]
    private var transactions: [String: StoreKit.Transaction] = [:]
    private var observer: Task<Void, Never>?
    private var ledger = IonBillingLedger()
    private var storageError = false
    private var deliveryError = false
    private var purchasing = false
    #if DEBUG
    private var legacyCatalogProbe: IonLegacyCatalogProbe?
    #endif
    var onClaimsChanged: (() -> Void)?
    private let ledgerURL: URL

    init(ledgerURL: URL? = nil) {
        self.ledgerURL = ledgerURL ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("ION RUSH/billing-v1.json")
        do { ledger = try IonBillingLedger.load(from: self.ledgerURL) }
        catch { storageError = true } // Never discard a damaged delivery journal.
    }

    func start() {
        guard observer == nil else { return }
        observer = Task { [weak self] in
            for await result in StoreKit.Transaction.updates {
                guard !Task.isCancelled, let self else { return }
                do { try await self.receive(result) }
                catch { NSLog("ION RUSH purchase delivery will retry: %@", error.localizedDescription) }
            }
        }
    }

    @discardableResult
    func stopObservation() -> Task<Void, Never>? {
        let active = observer
        active?.cancel()
        observer = nil
        return active
    }

    private func commit(_ changed: IonBillingLedger) throws {
        guard !storageError else { throw CocoaError(.fileReadCorruptFile) }
        do { try changed.persisted(to: ledgerURL); ledger = changed; deliveryError = false }
        catch { deliveryError = true; throw error }
    }

    func receive(_ result: VerificationResult<StoreKit.Transaction>, refundsOnly: Bool = false) async throws {
        guard case .verified(let transaction) = result,
              transaction.productType == .consumable,
              IonBillingLedger.products[transaction.productID] != nil else { return }
        #if !DEBUG
        if #available(iOS 16.0, *), transaction.environment == .xcode { return }
        #endif
        let id = "apple-\(transaction.id)"
        if transaction.revocationDate != nil {
            var changed = ledger
            if changed.revoke(transactionID: transaction.id, productID: transaction.productID, verified: true) {
                // Persist the verified refund before finishing or telling the wallet.
                try commit(changed)
                onClaimsChanged?()
            }
            transactions.removeValue(forKey: id)
            await transaction.finish()
            return
        }
        // History is for refunds only. Never turn already-finished consumables
        // into new grants, including after a reinstall or a lost local journal.
        guard !refundsOnly else { return }
        if ledger.completed.contains(id) || ledger.revocations?[id] != nil { await transaction.finish(); return }
        var changed = ledger
        if changed.record(transactionID: transaction.id, productID: transaction.productID,
                          verified: true, revoked: false) {
            try commit(changed)
            transactions[id] = transaction
            onClaimsChanged?()
        } else {
            transactions[id] = transaction // Retry acknowledgment of an existing pending grant.
        }
    }

    func recover() async throws {
        start()
        // Scan verified revocations only, even when full consumable history is
        // enabled. Unfinished transactions are the sole source of new grants.
        for await result in StoreKit.Transaction.all { try await receive(result, refundsOnly: true) }
        for await result in StoreKit.Transaction.unfinished { try await receive(result) }
    }

    func products() async -> [String: Any] {
        do {
            #if DEBUG
            NSLog("IONBilling catalog request bundle=%@ ids=%@ paymentsAllowed=%d", Bundle.main.bundleIdentifier ?? "unknown", IonBillingLedger.order.joined(separator: ","), AppStore.canMakePayments)
            #endif
            let fetched = try await Product.products(for: IonBillingLedger.order)
            #if DEBUG
            NSLog("IONBilling catalog batch count=%ld products=%@", fetched.count, fetched.map { "\($0.id):\($0.type)" }.joined(separator: ","))
            if fetched.isEmpty {
                // Read-only probes distinguish a cached batch result from
                // individual catalog responses. They never grant currency.
                for id in IonBillingLedger.order {
                    do {
                        let single = try await Product.products(for: [id])
                        NSLog("IONBilling catalog single id=%@ count=%ld products=%@", id, single.count, single.map { "\($0.id):\($0.type)" }.joined(separator: ","))
                    } catch {
                        let failure = error as NSError
                        NSLog("IONBilling catalog single id=%@ errorDomain=%@ errorCode=%ld", id, failure.domain, failure.code)
                    }
                }
            }
            #endif
            catalog = Dictionary(uniqueKeysWithValues: fetched.filter { $0.type == .consumable }.map { ($0.id, $0) })
            #if DEBUG
            if catalog.isEmpty, legacyCatalogProbe == nil {
                legacyCatalogProbe = IonLegacyCatalogProbe()
                legacyCatalogProbe?.start()
            }
            #endif
            return status(reason: catalog.isEmpty ? "product_unavailable" : nil)
        } catch {
            #if DEBUG
            let failure = error as NSError
            NSLog("IONBilling catalog batch errorDomain=%@ errorCode=%ld", failure.domain, failure.code)
            #endif
            catalog = [:]; return status(reason: "network_error")
        }
    }

    func initialize() async -> [String: Any] {
        do { try await recover() }
        catch { return status(reason: "delivery_retry") }
        return await products()
    }

    private func status(reason: String? = nil) -> [String: Any] {
        let allowed = AppStore.canMakePayments && !storageError
        var result: [String: Any] = ["configured": true, "ready": allowed && !catalog.isEmpty,
            "products": IonBillingLedger.order.map { id -> [String: Any] in
                ["id": id, "nova": IonBillingLedger.products[id]!, "price": catalog[id]?.displayPrice ?? "—",
                 "available": allowed && catalog[id] != nil]
            }]
        if let reason { result["reason"] = reason }
        if !allowed { result["reason"] = storageError ? "delivery_retry" : "payments_disabled" }
        return result
    }

    func purchase(_ id: String, presentingIn controller: UIViewController? = nil) async -> [String: Any] {
        guard IonBillingLedger.products[id] != nil else { return ["purchased": false, "reason": "unknown_product"] }
        guard !purchasing else { return ["purchased": false, "reason": "purchase_in_progress"] }
        guard !storageError, AppStore.canMakePayments else { return ["purchased": false, "reason": "payments_disabled"] }
        purchasing = true; defer { purchasing = false }
        if catalog[id] == nil { _ = await products() }
        guard let product = catalog[id] else { return ["purchased": false, "reason": "product_unavailable"] }
        do {
            let result: Product.PurchaseResult
            if #available(iOS 18.2, *), let controller {
                result = try await product.purchase(confirmIn: controller)
            } else if #available(iOS 17.0, *), let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) {
                result = try await product.purchase(confirmIn: scene)
            } else {
                result = try await product.purchase()
            }
            return await processPurchase(result, for: id)
        } catch { return ["purchased": false, "reason": error is URLError ? "network_error" : "purchase_failed"] }
    }

    func processPurchase(_ result: Product.PurchaseResult, for id: String) async -> [String: Any] {
        switch result {
        case .success(let result):
            guard case .verified(let transaction) = result, transaction.productID == id,
                  transaction.revocationDate == nil else {
                return ["purchased": false, "reason": "verification_failed"]
            }
            do { try await receive(result) }
            catch { return ["purchased": true, "reason": "delivery_retry"] }
            let id = "apple-\(transaction.id)"
            guard ledger.revocations?[id] == nil, ledger.pending[id] != nil || ledger.completed.contains(id) else {
                return ["purchased": false, "reason": "verification_failed"]
            }
            return ["purchased": true]
        case .pending: return ["purchased": false, "pending": true, "reason": "pending"]
        case .userCancelled: return ["purchased": false, "reason": "cancelled"]
        @unknown default: return ["purchased": false, "reason": "purchase_failed"]
        }
    }

    func sync(userInitiated: Bool) async -> Bool {
        do {
            // AppStore.sync can request credentials; never call it on launch/resume.
            if userInitiated { try await AppStore.sync() }
            try await recover(); return true
        } catch { return false }
    }

    func claims(excluding deliveredIDs: Set<String> = []) throws -> [[String: Any]] {
        guard !storageError, !deliveryError else { throw CocoaError(.fileReadCorruptFile) }
        // Completed receipts repair a lost Preferences write after a process crash.
        // Keep pending receipts even when the web wallet knows them, so it can
        // retry native acknowledgment without adding currency again.
        let replay = (ledger.delivered ?? [:]).values.filter { !deliveredIDs.contains($0.id) }
        return (Array(ledger.pending.values) + replay).sorted { $0.id < $1.id }.map {
            ["id": $0.id, "productId": $0.productId, "nova": $0.nova]
        }
    }

    func complete(_ ids: [String]) async throws -> Int {
        var changed = ledger
        let acknowledged = changed.acknowledge(ids)
        guard !acknowledged.isEmpty else { return 0 }
        try commit(changed)
        for id in acknowledged {
            if let transaction = transactions.removeValue(forKey: id) { await transaction.finish() }
        }
        // A crash before finish is recovered from Transaction.unfinished using
        // the durable completed IDs, without creating another NOVA claim.
        return acknowledged.count
    }

    func revocations(matching knownIDs: Set<String>) throws -> [[String: Any]] {
        guard !storageError, !deliveryError else { throw CocoaError(.fileReadCorruptFile) }
        return (ledger.revocations ?? [:]).values.filter { knownIDs.contains($0.id) }
            .sorted { $0.id < $1.id }.map {
                ["id": $0.id, "productId": $0.productId, "nova": $0.nova]
            }
    }
}

#if DEBUG
/// An independent, read-only StoreKit 1 query distinguishes an empty Apple
/// catalog from StoreKit 2 decoding or the game's consumable filtering.
private final class IonLegacyCatalogProbe: NSObject, SKProductsRequestDelegate {
    private var request: SKProductsRequest?
    func start() {
        let query = SKProductsRequest(productIdentifiers: Set(IonBillingLedger.order))
        request = query
        query.delegate = self
        query.start()
        NSLog("IONBilling legacy catalog request started")
    }
    func productsRequest(_ request: SKProductsRequest, didReceive response: SKProductsResponse) {
        NSLog("IONBilling legacy catalog count=%ld ids=%@ invalidIds=%@", response.products.count,
              response.products.map(\.productIdentifier).joined(separator: ","), response.invalidProductIdentifiers.joined(separator: ","))
        self.request = nil
    }
    func request(_ request: SKRequest, didFailWithError error: Error) {
        let failure = error as NSError
        NSLog("IONBilling legacy catalog errorDomain=%@ errorCode=%ld", failure.domain, failure.code)
        self.request = nil
    }
}
#endif
