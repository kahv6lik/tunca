import "server-only";
import ExcelJS from "exceljs";
import type { TenantClient } from "./tenant-db";
import { veriKumesiBul, type Bicim, type VeriKumesi } from "./disa-aktar-tanimlar";
import { degerBicimle, csvUret } from "./disa-aktar-saf";
import { firmaNoMu } from "./firma-no-saf";
import {
  alanlariGetir,
  topluDegerHaritasi,
  ozelAlanGirdiAdi,
  degerBicimle as ozelDegerBicimle,
  type OzelAlanVarligi,
} from "./ozel-alan";

export * from "./disa-aktar-saf";

export * from "./disa-aktar-tanimlar";

/**
 * Dışa aktarım — Faz 9 / E1.
 *
 * TEK KAPI: bütün listeler buradan dışa aktarılır. Sorgular kiracı
 * katmanından geçer, yani dışa aktarım kiracı sınırını aşamaz; ayrıca
 * çağıran taraf izni doğrular ve tanımlı olmayan bir veri kümesi
 * aktarılamaz.
 *
 * AKTİF FİLTREYE SAYGILI: listede uygulanan arama/durum süzgeçleri aynen
 * geçirilir. "Ekranda gördüğümü indir" beklentisi karşılanmazsa dışa aktarım
 * güvenilmez olur.
 *
 * SATIR SINIRI vardır: tek istekte tüm veritabanını belleğe almak, büyük bir
 * kiracıda sunucuyu düşürebilir.
 */

const AZAMI_SATIR = 10_000;

export type Filtre = Record<string, string | undefined>;

export type DisaAktarimSonucu = {
  dosyaAdi: string;
  icerik: Buffer;
  mimeTuru: string;
  satir: number;
};

/**
 * Veri kümesinin satırlarını okur.
 *
 * Her küme için ayrı sorgu yazılır çünkü ilişkili alanların (firma adı,
 * sorumlu adı, aşama adı) düzleştirilmesi gerekir — dışa aktarılan dosyada
 * kimsenin işine yaramayan ID'ler değil, okunabilir adlar olmalıdır.
 */
async function satirlariOku(
  db: TenantClient,
  kume: VeriKumesi,
  filtre: Filtre
): Promise<Record<string, unknown>[]> {
  const ara = (filtre.ara ?? "").trim();
  const durum = (filtre.durum ?? "").trim();
  const metin = (alan: string) =>
    ara ? { [alan]: { contains: ara, mode: "insensitive" as const } } : {};

  switch (kume.deger) {
    case "firmalar": {
      const kayitlar = await db.firma.findMany({
        where: {
          AND: [
            ara
              ? {
                  // Liste ekranıyla aynı kural (Faz 13 / H1): numara yazıldıysa
                  // tam eşleşme aranır, aksi halde metin alanlarında geçen.
                  OR: [
                    ...(firmaNoMu(ara) ? [{ firmaNo: ara.toUpperCase() }] : []),
                    metin("ad"),
                    metin("vergiNo"),
                    metin("il"),
                    metin("sektor"),
                  ],
                }
              : {},
            durum ? { durum } : {},
            filtre.il ? { il: filtre.il } : {},
            filtre.sektor ? { sektor: filtre.sektor } : {},
          ],
        },
        orderBy: { ad: "asc" },
        take: AZAMI_SATIR,
      });
      return kayitlar;
    }

    case "kisiler": {
      const kayitlar = await db.kisi.findMany({
        where: ara
          ? { OR: [metin("ad"), metin("unvan"), metin("email"), { firma: metin("ad") }] }
          : {},
        orderBy: [{ birincil: "desc" }, { ad: "asc" }],
        take: AZAMI_SATIR,
        include: { firma: { select: { ad: true } } },
      });
      return kayitlar.map((k) => ({ ...k, firmaAd: k.firma.ad }));
    }

    case "adaylar": {
      const kayitlar = await db.lead.findMany({
        where: {
          AND: [
            ara ? { OR: [metin("ad"), metin("firmaAd"), metin("email")] } : {},
            durum ? { durum } : {},
            filtre.kaynak ? { kaynak: filtre.kaynak } : {},
          ],
        },
        orderBy: { createdAt: "desc" },
        take: AZAMI_SATIR,
      });
      return kayitlar;
    }

    case "firsatlar": {
      const kayitlar = await db.firsat.findMany({
        where: {
          AND: [
            ara ? { OR: [metin("baslik"), { firma: metin("ad") }] } : {},
            durum ? { durum } : {},
            filtre.sorumlu ? { sorumluId: filtre.sorumlu } : {},
          ],
        },
        orderBy: { createdAt: "desc" },
        take: AZAMI_SATIR,
        include: {
          firma: { select: { ad: true } },
          kisi: { select: { ad: true } },
          asama: { select: { ad: true } },
        },
      });
      const kullanicilar = await db.user.findMany({ select: { id: true, name: true } });
      const adOf = new Map(kullanicilar.map((k) => [k.id, k.name]));

      return kayitlar.map((f) => ({
        ...f,
        firmaAd: f.firma.ad,
        kisiAd: f.kisi?.ad ?? null,
        asamaAd: f.asama.ad,
        sorumluAd: f.sorumluId ? adOf.get(f.sorumluId) ?? null : null,
        // Beklenen ciro dosyada da hesaplı gelsin; kullanıcı Excel'de formül
        // kurmak zorunda kalmasın.
        beklenenCiro: Math.round((f.tutar * f.olasilik) / 100),
      }));
    }

    case "teklifler": {
      const kayitlar = await db.teklif.findMany({
        where: {
          AND: [
            ara ? { OR: [metin("no"), metin("baslik"), { firma: metin("ad") }] } : {},
            durum ? { durum } : {},
          ],
        },
        orderBy: { createdAt: "desc" },
        take: AZAMI_SATIR,
        include: { firma: { select: { ad: true } } },
      });
      return kayitlar.map((t) => ({ ...t, firmaAd: t.firma.ad }));
    }

    case "aktiviteler": {
      const kayitlar = await db.aktivite.findMany({
        where: {
          AND: [
            ara ? { OR: [metin("baslik"), metin("aciklama")] } : {},
            filtre.tur ? { tur: filtre.tur } : {},
            filtre.atanan && filtre.atanan !== "herkes"
              ? { atananId: filtre.atanan }
              : {},
          ],
        },
        orderBy: { createdAt: "desc" },
        take: AZAMI_SATIR,
        include: { firma: { select: { ad: true } } },
      });
      const kullanicilar = await db.user.findMany({ select: { id: true, name: true } });
      const adOf = new Map(kullanicilar.map((k) => [k.id, k.name]));

      return kayitlar.map((a) => ({
        ...a,
        firmaAd: a.firma?.ad ?? null,
        atananAd: a.atananId ? adOf.get(a.atananId) ?? null : null,
      }));
    }

    case "yatirimlar": {
      const kayitlar = await db.yatirimDestegi.findMany({
        where: {
          AND: [
            ara ? { OR: [metin("baslik"), { firma: metin("ad") }] } : {},
            durum ? { durum } : {},
          ],
        },
        orderBy: { tarih: "desc" },
        take: AZAMI_SATIR,
        include: { firma: { select: { ad: true } } },
      });
      return kayitlar.map((y) => ({ ...y, firmaAd: y.firma.ad }));
    }

    case "egitimler": {
      const kayitlar = await db.egitim.findMany({
        where: {
          AND: [
            ara ? { OR: [metin("baslik"), { firma: metin("ad") }] } : {},
            durum ? { durum } : {},
          ],
        },
        orderBy: { tarih: "desc" },
        take: AZAMI_SATIR,
        include: { firma: { select: { ad: true } } },
      });
      return kayitlar.map((e) => ({ ...e, firmaAd: e.firma.ad }));
    }

    case "hizmetler": {
      const kayitlar = await db.hizmet.findMany({
        where: {
          AND: [
            ara ? { OR: [metin("baslik"), { firma: metin("ad") }] } : {},
            durum ? { durum } : {},
          ],
        },
        orderBy: { tarih: "desc" },
        take: AZAMI_SATIR,
        include: { firma: { select: { ad: true } } },
      });
      return kayitlar.map((h) => ({ ...h, firmaAd: h.firma.ad }));
    }

    default:
      return [];
  }
}

/** Özel alan destekli kümeler (Faz 11 / E6): küme → varlık eşlemesi. */
const OZEL_ALAN_KUMELERI: Record<string, OzelAlanVarligi> = {
  firmalar: "firma",
  kisiler: "kisi",
  firsatlar: "firsat",
};

export async function disaAktar(
  db: TenantClient,
  kumeAdi: string,
  bicim: Bicim,
  filtre: Filtre,
  kiraciAd: string
): Promise<DisaAktarimSonucu | null> {
  let kume = veriKumesiBul(kumeAdi);
  if (!kume) return null;

  let satirlar = await satirlariOku(db, kume, filtre);

  /**
   * Kiracıya özel alanlar (Faz 11): tanımlı alanlar dosyaya sütun olarak
   * eklenir ve listeden gelen "oa_<alanId>" filtreleri burada da uygulanır —
   * "ekranda gördüğümü indir" sözü özel alanlar için de geçerlidir.
   */
  const varlik = OZEL_ALAN_KUMELERI[kume.deger];
  if (varlik) {
    const alanlar = await alanlariGetir(varlik);
    if (alanlar.length > 0) {
      const degerler = await topluDegerHaritasi(
        db,
        varlik,
        satirlar.map((s) => s.id as string)
      );

      for (const a of alanlar) {
        const suzgec = (filtre[ozelAlanGirdiAdi(a.id)] ?? "").trim();
        if (suzgec) {
          satirlar = satirlar.filter(
            (s) => (degerler.get(s.id as string)?.get(a.id) ?? "") === suzgec
          );
        }
      }

      satirlar = satirlar.map((s) => ({
        ...s,
        ...Object.fromEntries(
          alanlar.map((a) => [
            ozelAlanGirdiAdi(a.id),
            ozelDegerBicimle(a, degerler.get(s.id as string)?.get(a.id) ?? ""),
          ])
        ),
      }));

      kume = {
        ...kume,
        sutunlar: [
          ...kume.sutunlar,
          ...alanlar.map((a) => ({ anahtar: ozelAlanGirdiAdi(a.id), etiket: a.ad })),
        ],
      };
    }
  }

  const tarih = new Date().toISOString().slice(0, 10);
  const temelAd = `${kume.deger}-${tarih}`;

  if (bicim === "csv") {
    return {
      dosyaAdi: `${temelAd}.csv`,
      icerik: Buffer.from(csvUret(kume, satirlar), "utf8"),
      mimeTuru: "text/csv; charset=utf-8",
      satir: satirlar.length,
    };
  }

  return {
    dosyaAdi: `${temelAd}.xlsx`,
    icerik: await xlsxUret(kume, satirlar, kiraciAd),
    mimeTuru: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    satir: satirlar.length,
  };
}

/** Biçimlendirilmiş Excel çalışma kitabı üretir. */
async function xlsxUret(
  kume: VeriKumesi,
  satirlar: Record<string, unknown>[],
  kiraciAd: string
): Promise<Buffer> {
  const kitap = new ExcelJS.Workbook();
  kitap.creator = "Gezegen CRM";
  kitap.created = new Date();

  const sayfa = kitap.addWorksheet(kume.etiket, {
    views: [{ state: "frozen", ySplit: 1 }], // başlık satırı sabit kalsın
  });

  sayfa.columns = kume.sutunlar.map((s) => ({
    header: s.etiket,
    key: s.anahtar,
    width: Math.min(40, Math.max(12, s.etiket.length + 4)),
    style: s.tur === "tarih" ? { numFmt: "dd.mm.yyyy" } : undefined,
  }));

  for (const satir of satirlar) {
    const hucreler: Record<string, unknown> = {};
    for (const s of kume.sutunlar) {
      hucreler[s.anahtar] = degerBicimle(satir[s.anahtar], s.tur);
    }
    sayfa.addRow(hucreler);
  }

  const baslik = sayfa.getRow(1);
  baslik.font = { bold: true };
  baslik.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFF1F5" },
  };
  sayfa.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: kume.sutunlar.length },
  };

  // Künye sayfası: dosya elden ele dolaştığında nereden geldiği belli olsun.
  const kunye = kitap.addWorksheet("Bilgi");
  kunye.columns = [{ width: 22 }, { width: 48 }];
  kunye.addRows([
    ["Kuruluş", kiraciAd],
    ["Veri kümesi", kume.etiket],
    ["Satır sayısı", satirlar.length],
    ["Dışa aktarma", new Date().toLocaleString("tr-TR")],
    ["Kaynak", "Gezegen CRM"],
  ]);
  kunye.getColumn(1).font = { bold: true };

  const tampon = await kitap.xlsx.writeBuffer();
  return Buffer.from(tampon);
}
