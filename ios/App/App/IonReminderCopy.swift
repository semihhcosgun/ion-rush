import Foundation

/// The same six languages and notification messages as Android's ReminderCopy.
struct IonReminderCopy {
    let titles: [String]
    private let bodies: [String]
    private let recordBody: String

    static func normalizeLocale(_ value: String) -> String {
        let base = value.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "_", with: "-").lowercased().split(separator: "-").first.map(String.init) ?? "en"
        switch base {
        case "tr", "es", "de", "fr": return base
        case "pt": return "pt-BR"
        default: return "en"
        }
    }
    func body(stage: Int, best: Int64, language: String) -> String {
        let stage = min(max(stage, 0), 2)
        guard stage == 1, best > 0 else { return bodies[stage] }
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: Self.normalizeLocale(language))
        formatter.maximumFractionDigits = 0
        let record = formatter.string(from: NSNumber(value: best)) ?? String(best)
        return recordBody.replacingOccurrences(of: "{record}", with: record)
    }
    static func forLanguage(_ language: String) -> IonReminderCopy {
        copies[normalizeLocale(language)] ?? copies["en"]!
    }
    private static let copies: [String: IonReminderCopy] = [
        "tr": IonReminderCopy(titles: ["KOKPİTİN SENİ BEKLİYOR", "REKORUNUN ÖTESİNE", "TEK YOL. YENİ BİR BAŞLANGIÇ."],
            bodies: ["Bilinmeyene doğru yeni bir uçuşa hazır mısın?", "Ufkun ötesinde yeni bir rekor seni bekliyor.", "Dünya’dan yola çık. Bakalım bu yolculuk seni nereye götürecek."],
            recordBody: "Rekorun {record} m. Ne kadar daha ileri gidebilirsin?"),
        "es": IonReminderCopy(titles: ["TU CABINA TE ESPERA", "SUPERA TU RÉCORD", "UNA PISTA. UN NUEVO COMIENZO."],
            bodies: ["¿Listo para otro vuelo hacia lo desconocido?", "Un nuevo récord personal te espera más allá del horizonte.", "Sal de la Tierra. Descubre adónde te lleva este viaje."],
            recordBody: "Tu récord es de {record} m. ¿Cuánto más lejos puedes llegar?"),
        "pt-BR": IonReminderCopy(titles: ["SUA CABINE ESPERA POR VOCÊ", "SUPERE SEU RECORDE", "UMA PISTA. UM NOVO COMEÇO."],
            bodies: ["Pronto para outro voo rumo ao desconhecido?", "Um novo recorde pessoal espera além do horizonte.", "Parta da Terra. Descubra aonde esta jornada leva você."],
            recordBody: "Seu recorde é de {record} m. Quanto mais longe você consegue ir?"),
        "de": IonReminderCopy(titles: ["DEIN COCKPIT WARTET", "ÜBER DEINEN REKORD HINAUS", "EINE STRECKE. EIN NEUER ANFANG."],
            bodies: ["Bereit für einen neuen Flug ins Unbekannte?", "Eine neue Bestleistung wartet jenseits des Horizonts.", "Starte von der Erde. Entdecke, wohin dich diese Reise führt."],
            recordBody: "Dein Rekord liegt bei {record} m. Wie viel weiter kommst du?"),
        "fr": IonReminderCopy(titles: ["TON COCKPIT T’ATTEND", "DÉPASSE TON RECORD", "UNE PISTE. UN NOUVEAU DÉPART."],
            bodies: ["Prêt pour un nouveau vol vers l’inconnu ?", "Un nouveau record personnel t’attend au-delà de l’horizon.", "Pars de la Terre. Découvre où ce voyage te mène."],
            recordBody: "Ton record est de {record} m. Jusqu’où peux-tu aller ?"),
        "en": IonReminderCopy(titles: ["YOUR COCKPIT IS WAITING", "BEYOND YOUR BEST", "ONE ROAD. A NEW BEGINNING."],
            bodies: ["Ready for another flight into the unknown?", "A new personal best is waiting beyond the horizon.", "Start from Earth. See where this journey takes you."],
            recordBody: "Your record is {record} m. How much farther can you go?")
    ]
}
