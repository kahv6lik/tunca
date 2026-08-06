import "server-only";
import { tenantOlustur, type TenantClient } from "./tenant-db";
import { bildirimGonder } from "./bildirim";

/**
 * İş akışı otomasyonu — Faz 8 / D2.
 *
 * "Şu durum oluştuğunda şunları yap." Kurallar kiracıya özeldir ve
 * ZAMANLANMIŞ çalıştırılır (`/api/gorevler`), olay anında değil.
 *
 * Neden zamanlanmış? Çünkü buradaki tetikleyicilerin çoğu bir olay değil,
 * bir DURUM: "3 gündür hareketsiz fırsat", "son tarihi yaklaşan görev",
 * "süresi dolmak üzere olan teklif". Bunlar kimsenin bir düğmeye basmasıyla
 * oluşmaz; zamanın geçmesiyle oluşur. Olay anında çalışan bir kural bunları
 * asla yakalayamazdı.
 *
 * AYNI ŞEY İKİ KEZ BİLDİRİLMEZ: her çalıştırmada `IsAkisiCalismasi`
 * kaydına bakılır ve daha önce işlenmiş hedef atlanır.
 */

export * from "./is-akisi-tanimlar";
import { type Eylem } from "./is-akisi-tanimlar";

export type Kosullar = { gun?: number };

type Hedef = {
  id: string;
  baslik: string;
  kullaniciId: string | null;
  firmaId: string | null;
  link: string;
  ayrinti?: string;
};

/**
 * Bir kuralın hedeflerini bulur.
 *
 * Sorgular kiracı katmanından geçer; yani bir kural asla başka kiracının
 * kaydını hedefleyemez.
 */
async function hedefleriBul(
  db: TenantClient,
  tetikleyici: string,
  kosullar: Kosullar
): Promise<Hedef[]> {
  const gun = kosullar.gun ?? 3;
  const simdi = new Date();

  if (tetikleyici === "gorev.yaklasti") {
    const sinir = new Date(simdi);
    sinir.setDate(sinir.getDate() + gun);

    const gorevler = await db.aktivite.findMany({
      where: { tamamlandi: null, sonTarih: { not: null, gte: simdi, lte: sinir } },
      take: 200,
      include: { firma: { select: { ad: true } } },
    });
    return gorevler.map((g) => ({
      id: g.id,
      baslik: g.baslik,
      kullaniciId: g.atananId,
      firmaId: g.firmaId,
      link: "/aktiviteler",
      ayrinti: g.firma?.ad,
    }));
  }

  if (tetikleyici === "gorev.gecikti") {
    const gorevler = await db.aktivite.findMany({
      where: { tamamlandi: null, sonTarih: { not: null, lt: simdi } },
      take: 200,
      include: { firma: { select: { ad: true } } },
    });
    return gorevler.map((g) => ({
      id: g.id,
      baslik: g.baslik,
      kullaniciId: g.atananId,
      firmaId: g.firmaId,
      link: "/aktiviteler",
      ayrinti: g.firma?.ad,
    }));
  }

  if (tetikleyici === "firsat.beklemede") {
    const sinir = new Date(simdi);
    sinir.setDate(sinir.getDate() - gun);

    const firsatlar = await db.firsat.findMany({
      where: { durum: "acik", updatedAt: { lt: sinir } },
      take: 200,
      include: { firma: { select: { ad: true } }, asama: { select: { ad: true } } },
    });
    return firsatlar.map((f) => ({
      id: f.id,
      baslik: f.baslik,
      kullaniciId: f.sorumluId,
      firmaId: f.firmaId,
      link: "/firsatlar",
      ayrinti: `${f.firma.ad} · ${f.asama.ad}`,
    }));
  }

  if (tetikleyici === "teklif.suresiDoluyor") {
    const sinir = new Date(simdi);
    sinir.setDate(sinir.getDate() + gun);

    const teklifler = await db.teklif.findMany({
      where: {
        durum: "gonderildi",
        gecerlilikTarihi: { not: null, gte: simdi, lte: sinir },
      },
      take: 200,
      include: { firma: { select: { ad: true } } },
    });

    // Teklifin "sahibi" onu oluşturan kullanıcıdır; e-postasından bulunur.
    const epostalar = [...new Set(teklifler.map((t) => t.olusturanEmail).filter(Boolean))];
    const kullanicilar = epostalar.length
      ? await db.user.findMany({
          where: { email: { in: epostalar as string[] } },
          select: { id: true, email: true },
        })
      : [];
    const idOf = new Map(kullanicilar.map((k) => [k.email, k.id]));

    return teklifler.map((t) => ({
      id: t.id,
      baslik: `${t.no} — ${t.baslik}`,
      kullaniciId: t.olusturanEmail ? idOf.get(t.olusturanEmail) ?? null : null,
      firmaId: t.firmaId,
      link: `/teklifler/${t.id}`,
      ayrinti: t.firma.ad,
    }));
  }

  return [];
}

/**
 * Tek bir kuralı çalıştırır.
 *
 * Hata durumunda kayıt düşer ama çalıştırma DURMAZ: bozuk bir kural, diğer
 * kuralların çalışmasını engellememelidir.
 */
export async function kuraliCalistir(
  db: TenantClient,
  kural: {
    id: string;
    ad: string;
    tetikleyici: string;
    kosullar: unknown;
    eylemler: unknown;
  }
): Promise<{ islenen: number; hata?: string }> {
  try {
    const kosullar = (kural.kosullar ?? {}) as Kosullar;
    const eylemler = (Array.isArray(kural.eylemler) ? kural.eylemler : []) as Eylem[];
    if (eylemler.length === 0) return { islenen: 0 };

    const hedefler = await hedefleriBul(db, kural.tetikleyici, kosullar);
    if (hedefler.length === 0) return { islenen: 0 };

    // Daha önce işlenmiş hedefler — aynı uyarı her çalıştırmada tekrarlanmasın.
    const gecmis = await db.isAkisiCalismasi.findMany({
      where: { isAkisiId: kural.id, sonuc: "basarili" },
      select: { hedefId: true },
      take: 2000,
    });
    const islenmis = new Set(gecmis.map((g) => g.hedefId));

    let islenen = 0;

    for (const hedef of hedefler) {
      if (islenmis.has(hedef.id)) continue;
      if (!hedef.kullaniciId) continue; // sahipsiz kayda bildirim gönderilemez

      for (const eylem of eylemler) {
        if (eylem.tur === "bildirim") {
          await bildirimGonder(db, {
            kullaniciId: hedef.kullaniciId,
            tur: "otomasyon",
            baslik: eylem.baslik?.replace("{kayit}", hedef.baslik) ?? `${kural.ad}: ${hedef.baslik}`,
            mesaj: eylem.mesaj ?? hedef.ayrinti,
            link: hedef.link,
          });
        }

        if (eylem.tur === "gorev") {
          const sonTarih = new Date();
          sonTarih.setDate(sonTarih.getDate() + (eylem.gun ?? 1));
          await tenantOlustur(db, "aktivite", {
            tur: "gorev",
            baslik: eylem.baslik?.replace("{kayit}", hedef.baslik) ?? `Takip: ${hedef.baslik}`,
            aciklama: eylem.mesaj ?? `"${kural.ad}" iş akışı tarafından açıldı.`,
            firmaId: hedef.firmaId,
            atananId: hedef.kullaniciId,
            sonTarih,
            olusturanEmail: "otomasyon",
          });
        }
      }

      await tenantOlustur(db, "isAkisiCalismasi", {
        isAkisiId: kural.id,
        hedefTur: kural.tetikleyici.split(".")[0],
        hedefId: hedef.id,
        sonuc: "basarili",
        ozet: hedef.baslik,
      });
      islenen++;
    }

    await db.isAkisi.updateMany({
      where: { id: kural.id },
      data: { sonCalisma: new Date(), calismaSayisi: { increment: 1 } },
    });

    return { islenen };
  } catch (e) {
    const hata = e instanceof Error ? e.message : "Bilinmeyen hata";
    try {
      await tenantOlustur(db, "isAkisiCalismasi", {
        isAkisiId: kural.id,
        sonuc: "hata",
        ozet: hata.slice(0, 300),
      });
    } catch {
      // Hata kaydı da yazılamadıysa yapacak bir şey yok; çalıştırma sürsün.
    }
    return { islenen: 0, hata };
  }
}

/** Kiracının bütün aktif kurallarını çalıştırır. */
export async function kiracininKurallariniCalistir(
  db: TenantClient
): Promise<{ kural: number; islenen: number; hata: number }> {
  const kurallar = await db.isAkisi.findMany({ where: { aktif: true } });

  let islenen = 0;
  let hata = 0;

  for (const k of kurallar) {
    const sonuc = await kuraliCalistir(db, {
      id: k.id,
      ad: k.ad,
      tetikleyici: k.tetikleyici,
      kosullar: k.kosullar,
      eylemler: k.eylemler,
    });
    islenen += sonuc.islenen;
    if (sonuc.hata) hata++;
  }

  return { kural: kurallar.length, islenen, hata };
}
