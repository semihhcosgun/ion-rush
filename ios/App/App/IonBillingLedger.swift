import Foundation

struct IonPurchaseClaim: Codable, Equatable {
    let id: String
    let productId: String
    let nova: Int
}

/// Persist delivery before exposing a claim, and acknowledge only after the
/// game's saved balance is durable. StoreKit remains unfinished until then.
struct IonBillingLedger: Codable {
    static let products = ["example_nova_5": 5, "example_nova_15": 15, "example_nova_40": 40]
    static let order = ["example_nova_5", "example_nova_15", "example_nova_40"]
    var pending: [String: IonPurchaseClaim] = [:]
    var completed: Set<String> = []
    var delivered: [String: IonPurchaseClaim]? = [:]
    // Optional for journals written before refund reconciliation existed.
    var revocations: [String: IonPurchaseClaim]? = [:]

    mutating func record(transactionID: UInt64, productID: String, verified: Bool, revoked: Bool) -> Bool {
        let id = "apple-\(transactionID)"
        guard verified, let nova = Self.products[productID], !revoked else { return false }
        guard !completed.contains(id), pending[id] == nil, revocations?[id] == nil else { return false }
        pending[id] = IonPurchaseClaim(id: id, productId: productID, nova: nova)
        return true
    }
    mutating func revoke(transactionID: UInt64, productID: String, verified: Bool) -> Bool {
        guard verified, let nova = Self.products[productID] else { return false }
        let id = "apple-\(transactionID)"
        let claim = IonPurchaseClaim(id: id, productId: productID, nova: nova)
        let changed = revocations?[id] != claim || pending[id] != nil || delivered?[id] != nil
        if revocations == nil { revocations = [:] }
        revocations?[id] = claim
        pending.removeValue(forKey: id)
        delivered?.removeValue(forKey: id)
        return changed
    }
    mutating func acknowledge(_ ids: [String]) -> [String] {
        var acknowledged: [String] = []
        for id in Set(ids) where pending[id] != nil {
            let claim = pending.removeValue(forKey: id)!
            if delivered == nil { delivered = [:] }
            delivered?[id] = claim
            completed.insert(id); acknowledged.append(id)
        }
        return acknowledged
    }
    func persisted(to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(self).write(to: url, options: .atomic)
    }
    static func load(from url: URL) throws -> Self {
        guard FileManager.default.fileExists(atPath: url.path) else { return Self() }
        return try JSONDecoder().decode(Self.self, from: Data(contentsOf: url))
    }
}
