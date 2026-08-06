import "server-only";
import type { TenantClient } from "./tenant-db";

/**
 * Firma zaman akışı (Faz 7 / C6).
 *
 * Bir firmanın altındaki BÜTÜN modüllerin tek kronolojik akışı. Amaç,
 * "bu müşteriyle ne oldu?" sorusunu tek ekranda yanıtlamak: sekme sekme
 * gezmek zorunda kalmadan.
 *
 * Modüller ayrı sorgularla okunup burada birleştirilir. Tek bir SQL UNION
 * yazmak daha hızlı olurdu ama her modülün alanları farklı; ayrı sorgular
 * hem okunur hem de kiracı katmanından geçtiği için güvenlidir. Sayfada
 * yalnızca son N kayıt gösterildiği için maliyet küçüktür.
 *
 * Yetki: çağıran, kullanıcının hangi modülleri görebildiğini `izinler`
 * kümesiyle bildirir. İzni olmayan modül SORGULANMAZ — kapalı bir modülün
 * verisi timeline üzerinden sızmamalıdır.
 */

export type TimelineOgesi = {
  id: string;
  tur:
    | "aktivite"
    | "firsat"
    | "teklif"
    | "yatirim"
    | "egitim"
    | "hizmet"
    | "kisi";
  baslik: string;
  aciklama?: string | null;
  tarih: Date;
  etiket?: string | null;
  durum?: string | null;
  link?: string | null;
};

export async function firmaTimeline(
  db: TenantClient,
  firmaId: string,
  izinler: Set<string>,
  limit = 40
): Promise<TimelineOgesi[]> {
  const ogeler: TimelineOgesi[] = [];

  const isteler: Promise<void>[] = [];

  if (izinler.has("aktivite.goruntule")) {
    isteler.push(
      db.aktivite
        .findMany({
          where: { firmaId },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: { kisi: { select: { ad: true } } },
        })
        .then((kayitlar) => {
          for (const a of kayitlar) {
            ogeler.push({
              id: `aktivite-${a.id}`,
              tur: "aktivite",
              baslik: a.baslik,
              aciklama: a.aciklama,
              // Görevlerde son tarih, notlarda kayıt tarihi anlamlıdır.
              tarih: a.sonTarih ?? a.createdAt,
              etiket: a.kisi?.ad ?? a.olusturanEmail,
              durum: a.tamamlandi ? "tamamlandi" : a.sonTarih ? "planlandi" : null,
            });
          }
        })
    );
  }

  if (izinler.has("firsat.goruntule")) {
    isteler.push(
      db.firsat
        .findMany({
          where: { firmaId },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: { asama: { select: { ad: true } } },
        })
        .then((kayitlar) => {
          for (const f of kayitlar) {
            ogeler.push({
              id: `firsat-${f.id}`,
              tur: "firsat",
              baslik: f.baslik,
              tarih: f.createdAt,
              etiket: f.asama.ad,
              durum: f.durum,
              link: "/firsatlar",
            });
          }
        })
    );
  }

  if (izinler.has("teklif.goruntule")) {
    isteler.push(
      db.teklif
        .findMany({ where: { firmaId }, orderBy: { createdAt: "desc" }, take: limit })
        .then((kayitlar) => {
          for (const t of kayitlar) {
            ogeler.push({
              id: `teklif-${t.id}`,
              tur: "teklif",
              baslik: `${t.no} — ${t.baslik}`,
              tarih: t.gonderimTarihi ?? t.createdAt,
              etiket: t.paraBirimi,
              durum: t.durum,
              link: `/teklifler/${t.id}`,
            });
          }
        })
    );
  }

  if (izinler.has("yatirim.goruntule")) {
    isteler.push(
      db.yatirimDestegi
        .findMany({ where: { firmaId }, orderBy: { tarih: "desc" }, take: limit })
        .then((kayitlar) => {
          for (const y of kayitlar) {
            ogeler.push({
              id: `yatirim-${y.id}`,
              tur: "yatirim",
              baslik: y.baslik,
              tarih: y.tarih,
              etiket: y.tur,
              durum: y.durum,
            });
          }
        })
    );
  }

  if (izinler.has("egitim.goruntule")) {
    isteler.push(
      db.egitim
        .findMany({ where: { firmaId }, orderBy: { tarih: "desc" }, take: limit })
        .then((kayitlar) => {
          for (const e of kayitlar) {
            ogeler.push({
              id: `egitim-${e.id}`,
              tur: "egitim",
              baslik: e.baslik,
              tarih: e.tarih,
              etiket: e.egitmen,
              durum: e.durum,
            });
          }
        })
    );
  }

  if (izinler.has("hizmet.goruntule")) {
    isteler.push(
      db.hizmet
        .findMany({ where: { firmaId }, orderBy: { tarih: "desc" }, take: limit })
        .then((kayitlar) => {
          for (const h of kayitlar) {
            ogeler.push({
              id: `hizmet-${h.id}`,
              tur: "hizmet",
              baslik: h.baslik,
              tarih: h.tarih,
              etiket: h.tur,
              durum: h.durum,
            });
          }
        })
    );
  }

  if (izinler.has("kisi.goruntule")) {
    isteler.push(
      db.kisi
        .findMany({ where: { firmaId }, orderBy: { createdAt: "desc" }, take: limit })
        .then((kayitlar) => {
          for (const k of kayitlar) {
            ogeler.push({
              id: `kisi-${k.id}`,
              tur: "kisi",
              baslik: `${k.ad} eklendi`,
              tarih: k.createdAt,
              etiket: k.unvan,
            });
          }
        })
    );
  }

  await Promise.all(isteler);

  return ogeler.sort((a, b) => b.tarih.getTime() - a.tarih.getTime()).slice(0, limit);
}
