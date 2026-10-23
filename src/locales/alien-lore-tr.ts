import type {EnemyKind} from '../config';
export const alienLoreTr = {
  "scarab": {
    "name": "KUM BÖCEĞİ",
    "role": "Zırhlı izci",
    "region": "Merkür",
    "detail": "Pirinç renkli kabuğu, kehribar rengi iki gözü örter. Yavaş ve kararlı atışlarla ilerler.",
    "counter": "Geniş gövdesine ateş etmeyi sürdür; hedef ışığı belirdiğinde yer değiştir.",
    "rarity": "AVCI"
  },
  "helix": {
    "name": "KÖZ SARMALI",
    "role": "Sarmal taktikçi",
    "region": "Jüpiter",
    "detail": "Mercan renkli kanatlar, inci gibi bir reaktörün çevresinde döner. Yaklaşırken iki şeridi hedef alır.",
    "counter": "Uyarı çizgisi olmayan şeridi seç; ikiye ayrılan atışı kaçışını takip etmez.",
    "rarity": "SEÇKİN"
  },
  "medusa": {
    "name": "YEŞİM MEDUSA",
    "role": "Süzülen pusucu",
    "region": "Satürn / Uranüs",
    "detail": "Yeşim renkli gövdesinden ışıklı uzantılar sarkar. Sakin hareketleri, iki şeridi hedefleyen yaylımını gizler.",
    "counter": "Süzülen uzantılara değil, şeritlerdeki uyarı çizgilerine bak.",
    "rarity": "EGZOTİK"
  },
  "comet": {
    "name": "KUYRUKLU MIZRAK",
    "role": "Hızlı saldırgan",
    "region": "Kuiper Kuşağı",
    "detail": "Parlak iki egzoz izi bırakan, buz mavisi bir mızrak. Kısa aralıklarla üç atış yapar.",
    "counter": "Atılırken nişanını üzerinde tut. İşaretli şeritten çık, sonra karşılık ver.",
    "rarity": "EGZOTİK"
  },
  "oracle": {
    "name": "BOŞLUK KÂHİNİ",
    "role": "Yörünge taktikçisi",
    "region": "Derin uzay",
    "detail": "Dikkatle izleyen parlak gözünü üç çivit mavisi halka çevreler. Ateş etmeden önce iki şeridi işaretler.",
    "counter": "Boş kalan üçüncü şeridi takip et veya başka bir yüzeye kaç.",
    "rarity": "EFSANEVİ"
  },
  "drone": {
    "name": "AKINCI DRON",
    "role": "İzci",
    "region": "Dünya",
    "detail": "Bakır kanatlı bu izci, tekli atışlarla savunmanı sınar.",
    "counter": "Hedef ışığı belirdikten sonra yer değiştir. İki isabetle gövdesi parçalanır.",
    "rarity": "İZCİ"
  },
  "saucer": {
    "name": "UZAYLI İZCİ",
    "role": "Seri atışlı izci",
    "region": "Dünya / Ay",
    "detail": "Işıklı kubbesi olan mor bir uçan daire. Peş peşe iki atış yapar.",
    "counter": "İşaretli şeritten çık; iki atış da aynı hattı izler.",
    "rarity": "DEVRİYE"
  },
  "manta": {
    "name": "BOŞLUK MANTASI",
    "role": "Süpürücü avcı",
    "region": "Ay",
    "detail": "Canlı yeşil yüzgeçleri, bu avcıyı geniş dalış yayları boyunca taşır.",
    "counter": "İlk saldırıları dış şeritleri tarar. Güçlenmiş türü doğrudan senin şeridine kilitlenir.",
    "rarity": "AVCI"
  },
  "wraith": {
    "name": "HAYALET ÖNCÜ",
    "role": "Önleme avcısı",
    "region": "Mars",
    "detail": "Elektrik mavisi bir mızrak; üçlü atışından önce nişangâhının önünden hızla geçer.",
    "counter": "Manevrasının bitişini takip et ve ateş aç. Şerit işaretlendiğinde kaç.",
    "rarity": "SEÇKİN"
  },
  "sentinel": {
    "name": "HALKA MUHAFIZI",
    "role": "Zırhlı koruyucu",
    "region": "Satürn",
    "detail": "Üç silah yuvası ve güçlendirilmiş çekirdeği olan altın bir yörünge kalesi.",
    "counter": "İlk yaylımı üç şeridi kaplar. Güçlenmiş türünün hedefli atışları tek şeritte kalır.",
    "rarity": "SEÇKİN"
  },
  "prism": {
    "name": "PRİZMA DOKUYUCU",
    "role": "Çift şerit taktikçisi",
    "region": "Neptün",
    "detail": "Turkuaz kristal kanatlar, parlak ametist bir kalbin çevresinde döner. Yaylımı iki şeridi kaplar.",
    "counter": "İki uyarı çizgisini de izle. İşaretsiz şeride geç veya yüzey değiştir.",
    "rarity": "EGZOTİK"
  },
  "revenant": {
    "name": "NEON HAYALET",
    "role": "Çevik önleme avcısı",
    "region": "Kuiper Kuşağı",
    "detail": "Buz gibi reaktörünü eflatun renkli iki hilal çevreler. Hızla hareket eder, yoğun ateş açar.",
    "counter": "Üçlü atışını savuştur, toparlanırken karşılık ver.",
    "rarity": "EGZOTİK"
  },
  "seraph": {
    "name": "YILDIZ SERAFI",
    "role": "Yüzey hâkimi",
    "region": "Derin uzay",
    "detail": "Mor bir tacın çevresinde altı ışıklı kanat açılır. Parkurun bir yüzeyini baştan sona tarar.",
    "counter": "Üç şerit birden aydınlanır. Uyarı sona ermeden yüzey değiştir.",
    "rarity": "EFSANEVİ"
  },
  "sovereign": {
    "name": "GÜNEŞ HÜKÜMDARI",
    "role": "Ağır yüzey hâkimi",
    "region": "Andromeda",
    "detail": "Kehribar renkli tacıyla Andromeda'nın altındaki dönüş koridorunu korur. Ağır gövdesi ve çift şeritli atışları, beyaz kor gibi çekirdeğini savunur.",
    "counter": "Boş şeridi kullan. Yavaş manevraları sırasında çekirdeğine ateş et.",
    "rarity": "EFSANEVİ"
  },
  "apex": {
    "name": "TUTULMA EFENDİSİ",
    "role": "Sonsuz sınırın muhafızı",
    "region": "Sagittarius A*'ın ötesi",
    "detail": "İçinde turkuaz bir halka taşıyan kızıl bir tutulma. Son düşman türü, ana keşif rotasının ötesinde bekler.",
    "counter": "Yayılan atışlarından kaçmak için yüzey değiştir. Turboyu sakla; önce destek izcilerini yok et.",
    "rarity": "DESTANSI"
  }
} satisfies Record<EnemyKind,{name:string;role:string;region:string;detail:string;counter:string;rarity:string}>;
