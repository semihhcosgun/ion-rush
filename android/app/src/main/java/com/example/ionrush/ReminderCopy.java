package com.example.ionrush;

import java.util.Locale;

// Notification text follows the language selected in the game, even after restart.
final class ReminderCopy {
    final String channel;
    final String description;
    final String[] titles;
    private final String[] bodies;
    private final String recordBody;

    private ReminderCopy(String channel,String description,String[] titles,String[] bodies,String recordBody){
        this.channel=channel;this.description=description;this.titles=titles;this.bodies=bodies;this.recordBody=recordBody;
    }

    static String normalizeLocale(String value){
        if(value==null)return "en";
        String base=value.trim().replace('_','-').toLowerCase(Locale.ROOT).split("-",2)[0];
        switch(base){case "tr":case "es":case "de":case "fr":return base;case "pt":return "pt-BR";default:return "en";}
    }

    String body(int stage,long best,String language){
        if(stage!=1||best<=0)return bodies[stage];
        String record=String.format(Locale.forLanguageTag(normalizeLocale(language)),"%,d",best);
        return recordBody.replace("{record}",record);
    }

    static ReminderCopy forLanguage(String language){
        switch(normalizeLocale(language)){
            case "tr":return new ReminderCopy("Uçuş hatırlatmaları","Sıradaki uçuşuna bir davet.",
                new String[]{"KOKPİTİN SENİ BEKLİYOR","REKORUNUN ÖTESİNE","TEK YOL. YENİ BİR BAŞLANGIÇ."},
                new String[]{"Bilinmeyene doğru yeni bir uçuşa hazır mısın?","Ufkun ötesinde yeni bir rekor seni bekliyor.","Dünya’dan yola çık. Bakalım bu yolculuk seni nereye götürecek."},
                "Rekorun {record} m. Ne kadar daha ileri gidebilirsin?");
            case "es":return new ReminderCopy("Recordatorios de vuelo","Una invitación a tu próximo vuelo.",
                new String[]{"TU CABINA TE ESPERA","SUPERA TU RÉCORD","UNA PISTA. UN NUEVO COMIENZO."},
                new String[]{"¿Listo para otro vuelo hacia lo desconocido?","Un nuevo récord personal te espera más allá del horizonte.","Sal de la Tierra. Descubre adónde te lleva este viaje."},
                "Tu récord es de {record} m. ¿Cuánto más lejos puedes llegar?");
            case "pt-BR":return new ReminderCopy("Lembretes de voo","Um convite para seu próximo voo.",
                new String[]{"SUA CABINE ESPERA POR VOCÊ","SUPERE SEU RECORDE","UMA PISTA. UM NOVO COMEÇO."},
                new String[]{"Pronto para outro voo rumo ao desconhecido?","Um novo recorde pessoal espera além do horizonte.","Parta da Terra. Descubra aonde esta jornada leva você."},
                "Seu recorde é de {record} m. Quanto mais longe você consegue ir?");
            case "de":return new ReminderCopy("Flugerinnerungen","Eine Einladung zu deinem nächsten Flug.",
                new String[]{"DEIN COCKPIT WARTET","ÜBER DEINEN REKORD HINAUS","EINE STRECKE. EIN NEUER ANFANG."},
                new String[]{"Bereit für einen neuen Flug ins Unbekannte?","Eine neue Bestleistung wartet jenseits des Horizonts.","Starte von der Erde. Entdecke, wohin dich diese Reise führt."},
                "Dein Rekord liegt bei {record} m. Wie viel weiter kommst du?");
            case "fr":return new ReminderCopy("Rappels de vol","Une invitation à ton prochain vol.",
                new String[]{"TON COCKPIT T’ATTEND","DÉPASSE TON RECORD","UNE PISTE. UN NOUVEAU DÉPART."},
                new String[]{"Prêt pour un nouveau vol vers l’inconnu ?","Un nouveau record personnel t’attend au-delà de l’horizon.","Pars de la Terre. Découvre où ce voyage te mène."},
                "Ton record est de {record} m. Jusqu’où peux-tu aller ?");
            default:return new ReminderCopy("Flight reminders","An invitation back to your next flight.",
                new String[]{"YOUR COCKPIT IS WAITING","BEYOND YOUR BEST","ONE ROAD. A NEW BEGINNING."},
                new String[]{"Ready for another flight into the unknown?","A new personal best is waiting beyond the horizon.","Start from Earth. See where this journey takes you."},
                "Your record is {record} m. How much farther can you go?");
        }
    }
}
