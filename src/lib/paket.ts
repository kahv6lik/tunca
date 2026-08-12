import "server-only";
import { type KapsamliPaket } from "./fiyat-saf";

// `paketDamgasiGecerliMi` bilinçli olarak `fiyat-saf.ts` içindedir: saf bir
// karardır ve testler onu veritabanı olmadan sınar (Faz 14 deseni).

/**
 * Paket kataloğu — v1.25.0.
 *
 * Paket Faz 14'te (T2) tanımlanabiliyordu ama HİÇBİR SATIŞA BAĞLI DEĞİLDİ.
 * Ortağın bulgusu: "sipariş oluştururken ürün seçebiliyorum ama paket
 * seçemiyorum." Bu dosya, kampanyadaki `kampanyaKatalogu` deseninin
 * paketteki eşidir: katalog KAPSAMIYLA birlikte forma verilir, süzme
 * istemcide `firmaninPaketleri` ile yapılır.
 *
 * NEDEN SUNUCUDA BİR KEZ SÜZÜLMEZ (v1.23.0'ın dersi): seçili firma
 * kullanıcı yazdıkça değişir ve ilk çizimde boştur. Sunucuda bir kez
 * süzülen liste, firmaya özel her paketi listeden düşürürdü — kampanyada
 * tam olarak bu yaşandı.
 */

/** `getTenantDb()` sonucunun bu dosyanın ihtiyaç duyduğu dar yüzü. */
export type PaketIstemcisi = {
  paket: {
    findMany: (arg: unknown) => Promise<PaketSatiriHam[]>;
  };
};

type PaketSatiriHam = {
  id: string;
  kod: string;
  ad: string;
  firmaId: string | null;
  sabitFiyat: boolean;
  fiyat: number;
  iskontoOrani: number;
  kalemler: {
    urunId: string;
    miktar: number;
    urun: {
      ad: string;
      birim: string;
      listeFiyat: number;
      kdvOrani: number;
      durum: string;
    };
  }[];
};

export function paketIstemcisi(db: unknown): PaketIstemcisi {
  return db as PaketIstemcisi;
}

/**
 * Satışa sunulabilecek paketleri kapsamıyla birlikte döndürür.
 *
 * Yalnızca AKTİF paketler gelir; pasif paket geçmiş bir anlaşmadır ve yeni
 * satışta seçilemez (ürün kataloğundaki kural). Kalemi olmayan paket de
 * elenir: satıra açılacak bir şeyi olmayan paketi listelemek, seçilince
 * hiçbir şey olmayan bir düğme sunmak olurdu.
 */
export async function paketKatalogu(
  db: PaketIstemcisi
): Promise<KapsamliPaket[]> {
  const paketler = await db.paket.findMany({
    where: { durum: "aktif" },
    orderBy: [{ ad: "asc" }],
    take: 300,
    select: {
      id: true,
      kod: true,
      ad: true,
      firmaId: true,
      sabitFiyat: true,
      fiyat: true,
      iskontoOrani: true,
      kalemler: {
        orderBy: { sira: "asc" },
        select: {
          urunId: true,
          miktar: true,
          urun: {
            select: {
              ad: true,
              birim: true,
              listeFiyat: true,
              kdvOrani: true,
              durum: true,
            },
          },
        },
      },
    },
  });

  return paketler
    .map((p) => ({
      paketId: p.id,
      kod: p.kod,
      ad: p.ad,
      firmaId: p.firmaId,
      sabitFiyat: p.sabitFiyat,
      fiyat: p.fiyat,
      iskontoOrani: p.iskontoOrani,
      /*
        Pasif ürün paketten DÜŞÜLÜR ama paket listede kalır: katalogdan
        kaldırılmış tek bir ürün yüzünden bütün paketi satılamaz hâle
        getirmek, anlaşmayı teknik bir ayrıntı yüzünden bozmak olurdu.
      */
      kalemler: p.kalemler
        .filter((k) => k.urun.durum === "aktif")
        .map((k) => ({
          urunId: k.urunId,
          miktar: k.miktar,
          listeFiyat: k.urun.listeFiyat,
          ad: k.urun.ad,
          birim: k.urun.birim,
          kdvOrani: k.urun.kdvOrani,
        })),
    }))
    .filter((p) => p.kalemler.length > 0);
}
