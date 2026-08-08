import "server-only";
import type { TenantClient } from "./tenant-db";
import {
  TAKVIM_TURLERI,
  TUR_ETIKET,
  type TakvimTuru,
} from "./takvim-tanimlar";

export * from "./takvim-tanimlar";

/**
 * Takvim — Faz 8 / D4.
 *
 * Takvimin kendi kaydı YOKTUR. Gösterilen her şey zaten var olan kayıtların
 * tarihli hâlidir: görevlerin son tarihi, fırsatların tahmini kapanışı,
 * tekliflerin geçerlilik sonu, eğitim ve hizmet tarihleri. Ayrı bir
 * "etkinlik" tablosu açmak, aynı bilginin iki yerde tutulması demek olurdu.
 *
 * Timeline (C6) gibi burada da İZİN SÜZGECİ vardır: izni olmayan modül hiç
 * sorgulanmaz.
 */

export type TakvimOgesi = {
  id: string;
  tur: TakvimTuru;
  baslik: string;
  tarih: Date;
  aciklama?: string | null;
  link?: string | null;
  tamamlandi?: boolean;
};

export async function takvimOgeleri(
  db: TenantClient,
  izinler: Set<string>,
  baslangic: Date,
  bitis: Date,
  kullaniciId?: string,
  /**
   * Kategori süzgeci (Faz 13 / H8). Verilmezse hepsi gelir. Süzgeç dışındaki
   * kategorinin SORGUSU HİÇ ÇALIŞMAZ — pano kartlarındaki kural burada da
   * geçerli: göstermeyeceğimiz veriyi okumayız.
   */
  turler: Set<TakvimTuru> = new Set(TAKVIM_TURLERI)
): Promise<TakvimOgesi[]> {
  const ogeler: TakvimOgesi[] = [];
  const isler: Promise<void>[] = [];

  if (izinler.has("aktivite.goruntule") && turler.has("gorev")) {
    isler.push(
      db.aktivite
        .findMany({
          where: {
            sonTarih: { gte: baslangic, lte: bitis },
            ...(kullaniciId ? { atananId: kullaniciId } : {}),
          },
          take: 500,
          include: { firma: { select: { ad: true } } },
        })
        .then((kayitlar) => {
          for (const a of kayitlar) {
            ogeler.push({
              id: `gorev-${a.id}`,
              tur: "gorev",
              baslik: a.baslik,
              tarih: a.sonTarih!,
              aciklama: a.firma?.ad,
              link: "/aktiviteler",
              tamamlandi: Boolean(a.tamamlandi),
            });
          }
        })
    );
  }

  if (izinler.has("firsat.goruntule") && turler.has("firsat")) {
    isler.push(
      db.firsat
        .findMany({
          where: {
            kapanisTarihi: { gte: baslangic, lte: bitis },
            durum: "acik",
            ...(kullaniciId ? { sorumluId: kullaniciId } : {}),
          },
          take: 500,
          include: { firma: { select: { ad: true } } },
        })
        .then((kayitlar) => {
          for (const f of kayitlar) {
            ogeler.push({
              id: `firsat-${f.id}`,
              tur: "firsat",
              baslik: f.baslik,
              tarih: f.kapanisTarihi!,
              aciklama: f.firma.ad,
              link: "/firsatlar",
            });
          }
        })
    );
  }

  if (izinler.has("teklif.goruntule") && turler.has("teklif")) {
    isler.push(
      db.teklif
        .findMany({
          where: {
            gecerlilikTarihi: { gte: baslangic, lte: bitis },
            durum: { in: ["gonderildi", "taslak"] },
          },
          take: 500,
          include: { firma: { select: { ad: true } } },
        })
        .then((kayitlar) => {
          for (const t of kayitlar) {
            ogeler.push({
              id: `teklif-${t.id}`,
              tur: "teklif",
              baslik: `${t.no} geçerlilik sonu`,
              tarih: t.gecerlilikTarihi!,
              aciklama: t.firma.ad,
              link: `/teklifler/${t.id}`,
            });
          }
        })
    );
  }

  if (izinler.has("egitim.goruntule") && turler.has("egitim")) {
    isler.push(
      db.egitim
        .findMany({
          where: { tarih: { gte: baslangic, lte: bitis } },
          take: 500,
          include: { firma: { select: { ad: true } } },
        })
        .then((kayitlar) => {
          for (const e of kayitlar) {
            ogeler.push({
              id: `egitim-${e.id}`,
              tur: "egitim",
              baslik: e.baslik,
              tarih: e.tarih,
              aciklama: e.firma.ad,
            });
          }
        })
    );
  }

  if (izinler.has("hizmet.goruntule") && turler.has("hizmet")) {
    isler.push(
      db.hizmet
        .findMany({
          where: { tarih: { gte: baslangic, lte: bitis } },
          take: 500,
          include: { firma: { select: { ad: true } } },
        })
        .then((kayitlar) => {
          for (const h of kayitlar) {
            ogeler.push({
              id: `hizmet-${h.id}`,
              tur: "hizmet",
              baslik: h.baslik,
              tarih: h.tarih,
              aciklama: h.firma.ad,
            });
          }
        })
    );
  }

  await Promise.all(isler);
  return ogeler.sort((a, b) => a.tarih.getTime() - b.tarih.getTime());
}

/**
 * iCalendar (.ics) metni üretir.
 *
 * Kütüphane kullanılmadı: biçim küçük ve sabit, bir bağımlılık eklemeye
 * değmez. Dikkat edilen üç kural — satırlar CRLF ile biter, metinlerdeki
 * virgül/noktalı virgül/ters bölü kaçırılır, uzun satırlar 75 oktete
 * katlanır. Bunlara uyulmazsa bazı takvim uygulamaları dosyayı reddeder.
 */
export function icsUret(ogeler: TakvimOgesi[], takvimAdi = "Gezegen CRM"): string {
  const satirlar: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gezegen CRM//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${kacir(takvimAdi)}`,
  ];

  for (const o of ogeler) {
    satirlar.push(
      "BEGIN:VEVENT",
      `UID:${o.id}@gezegen-crm`,
      `DTSTAMP:${zaman(new Date())}`,
      // Tüm gün süren etkinlik: saat bilgisi yok, tarih yeterli.
      `DTSTART;VALUE=DATE:${gun(o.tarih)}`,
      `SUMMARY:${kacir(etiketli(o))}`,
      ...(o.aciklama ? [`DESCRIPTION:${kacir(o.aciklama)}`] : []),
      "END:VEVENT"
    );
  }

  satirlar.push("END:VCALENDAR");
  return satirlar.map(katla).join("\r\n") + "\r\n";
}

function etiketli(o: TakvimOgesi): string {
  return `[${TUR_ETIKET[o.tur]}] ${o.baslik}`;
}

function gun(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function zaman(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function kacir(metin: string): string {
  return metin
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545: satırlar 75 okteti geçmemeli, devamı boşlukla başlar. */
function katla(satir: string): string {
  if (satir.length <= 75) return satir;
  const parcalar: string[] = [satir.slice(0, 75)];
  let kalan = satir.slice(75);
  while (kalan.length > 74) {
    parcalar.push(" " + kalan.slice(0, 74));
    kalan = kalan.slice(74);
  }
  if (kalan) parcalar.push(" " + kalan);
  return parcalar.join("\r\n");
}
