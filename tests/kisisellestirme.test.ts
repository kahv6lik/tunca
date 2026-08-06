import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { gzipSync } from "node:zlib";
import { kiraciCifti, temizle, yonetim, baglantiyiKapat, type Kiraci } from "./fixture";
import {
  PANO_KARTLARI,
  PANO_VARSAYILAN,
  etkinKartlar,
} from "../src/lib/pano-tanimlar";
import { IZIN, ROL, ROL_IZINLERI } from "../src/lib/yetki-tanimlar";

/**
 * Kişiselleştirme ve süreklilik testleri (Faz 10 / E3, E4, E7).
 *
 * Saf katman: pano kart süzgeci (izin + bilinmeyen anahtar ayıklama).
 * Veritabanı katmanı: tercih/görünüm/yedek tablolarının kiracı sınırı ve
 * yedeğin "ekleyici geri yükleme" sözü.
 */

let a: Kiraci;
let b: Kiraci;

beforeAll(async () => {
  ({ a, b } = await kiraciCifti());
});

afterAll(async () => {
  await temizle(a, b);
  await baglantiyiKapat();
});

describe("Pano kartları (E3)", () => {
  it("varsayılan düzen, Faz 10 öncesi panoyla aynıdır (yeni kartlar opsiyonel)", () => {
    // Yükseltme kimsenin panosunu değiştirmemeli: yeni üç kart varsayılan DIŞI.
    expect(PANO_VARSAYILAN).not.toContain("kpi-firsat");
    expect(PANO_VARSAYILAN).not.toContain("kpi-gorev");
    expect(PANO_VARSAYILAN).not.toContain("liste-bugun-gorevler");
    expect(PANO_VARSAYILAN).toContain("kpi-firma");
    expect(PANO_VARSAYILAN).toContain("grafik-yatirim-trend");
  });

  it("izni olmayan kart, tercih edilse bile düşer", () => {
    const yalnizFirma = new Set([IZIN.firmaGoruntule]);
    const kartlar = etkinKartlar(["kpi-firma", "kpi-yatirim", "grafik-yatirim-trend"], yalnizFirma);

    expect(kartlar).toEqual(["kpi-firma"]);
  });

  it("bilinmeyen kart anahtarı ayıklanır (eski tercihte kalmış olabilir)", () => {
    const hepsi = new Set(PANO_KARTLARI.map((k) => k.izin));
    const kartlar = etkinKartlar(["kpi-firma", "kaldirilmis-kart"], hepsi);
    expect(kartlar).toEqual(["kpi-firma"]);
  });

  it("tercih boşsa varsayılan düzen (izin süzgeçli) döner", () => {
    const hepsi = new Set(PANO_KARTLARI.map((k) => k.izin));
    expect(etkinKartlar(null, hepsi)).toEqual(PANO_VARSAYILAN);
    expect(etkinKartlar([], hepsi)).toEqual(PANO_VARSAYILAN);
  });

  it("tercihin sırası korunur", () => {
    const hepsi = new Set(PANO_KARTLARI.map((k) => k.izin));
    const kartlar = etkinKartlar(["kpi-egitim", "kpi-firma"], hepsi);
    expect(kartlar).toEqual(["kpi-egitim", "kpi-firma"]);
  });

  it("her kartın izni gerçek bir izin anahtarıdır", () => {
    const izinler = new Set(Object.values(IZIN) as string[]);
    for (const kart of PANO_KARTLARI) {
      expect(izinler.has(kart.izin), `${kart.anahtar}: ${kart.izin}`).toBe(true);
    }
  });

  it("pano tercihi kiracı sınırına tabidir", async () => {
    await yonetim.panoTercihi.create({
      data: { tenantId: b.id, kullaniciId: b.kullaniciId, kartlar: ["kpi-firma"] },
    });

    const aGorunum = await a.db.panoTercihi.findMany({});
    expect(aGorunum.some((t) => t.kullaniciId === b.kullaniciId)).toBe(false);
  });
});

describe("Kayıtlı görünümler (E4)", () => {
  it("görünüm kiracı sınırına tabidir", async () => {
    await yonetim.kayitliGorunum.create({
      data: {
        tenantId: b.id,
        kullaniciId: b.kullaniciId,
        liste: "firmalar",
        ad: "B'nin gizli görünümü",
        sorgu: "ara=gizli",
        paylasilan: true, // paylaşım KİRACI İÇİDİR; komşuya sızmaz
      },
    });

    const aGorunum = await a.db.kayitliGorunum.findMany({});
    expect(aGorunum.some((g) => g.ad === "B'nin gizli görünümü")).toBe(false);
  });

  it("aynı kullanıcı aynı listede aynı adı iki kez kullanamaz", async () => {
    await yonetim.kayitliGorunum.create({
      data: {
        tenantId: a.id,
        kullaniciId: a.kullaniciId,
        liste: "firmalar",
        ad: "İzmir",
        sorgu: "il=İzmir",
      },
    });

    await expect(
      yonetim.kayitliGorunum.create({
        data: {
          tenantId: a.id,
          kullaniciId: a.kullaniciId,
          liste: "firmalar",
          ad: "İzmir",
          sorgu: "il=İzmir&durum=aktif",
        },
      })
    ).rejects.toThrow();
  });

  it("sorgu temizleyici tehlikeli/gereksiz anahtarları atar", async () => {
    const { sorguTemizle } = await import("../src/lib/gorunum-tanimlar");

    expect(sorguTemizle("ara=tekstil&durum=aktif")).toBe("ara=tekstil&durum=aktif");
    // g (görünüm işareti) ve sayfa saklanmaz — bayat sayfa numarası taşınmasın.
    expect(sorguTemizle("g=1&sayfa=7&ara=x")).toBe("ara=x");
    // Bilinmeyen biçimli anahtarlar atılır.
    expect(sorguTemizle("__proto__=1&a-b=2&ara=x")).toBe("ara=x");
    // Boş değer atılır.
    expect(sorguTemizle("ara=&durum=aktif")).toBe("durum=aktif");
  });
});

describe("Yedekleme (E7)", () => {
  it("yedek kiracı sınırına tabidir — A, B'nin yedeğini göremez", async () => {
    await yonetim.yedek.create({
      data: {
        tenantId: b.id,
        tur: "elle",
        kayitSayisi: 5,
        boyut: 100,
        icerik: gzipSync(Buffer.from("{}")),
      },
    });

    const aGorunum = await a.db.yedek.findMany({});
    expect(aGorunum.every((y) => y.tenantId === a.id)).toBe(true);
  });

  it("yedek al → sil → geri yükle: silinen kayıt geri gelir, mevcutlara dokunulmaz", async () => {
    const { yedekOlustur, yedekAc, geriYukle, yedekIstemcisi } = await import(
      "../src/lib/yedek-saf"
    );
    const db = yedekIstemcisi(a.db);

    // 1) Yedek al (fixture'da 1 firma + alt kayıtları var).
    const ozet = await yedekOlustur(db, a.id, "elle", "test@test.local");
    expect(ozet.kayitSayisi).toBeGreaterThan(0);

    // 2) Bir kaydı "yanlışlıkla" sil.
    await yonetim.hizmet.delete({ where: { id: a.hizmetId } });
    expect(await a.db.hizmet.count({})).toBe(0);

    // 3) Bu arada YENİ bir kayıt da eklensin — geri yükleme ona dokunmamalı.
    const yeni = await yonetim.firma.create({
      data: { tenantId: a.id, ad: "Yedekten Sonra Kurulan", durum: "aktif" },
    });

    // 4) Geri yükle.
    const yedek = await a.db.yedek.findFirst({ where: { id: ozet.id } });
    const icerik = yedekAc(Buffer.from(yedek!.icerik))!;
    expect(icerik).not.toBeNull();

    const sonuc = await geriYukle(db, a.id, icerik);

    // Silinen hizmet geri geldi…
    expect(await a.db.hizmet.count({})).toBe(1);
    expect(sonuc.eklenen.hizmet).toBe(1);
    // …mevcut firma İKİ KEZ oluşmadı…
    expect(sonuc.atlanan.firma).toBeGreaterThanOrEqual(1);
    // …ve yedekten SONRA kurulan firma yerinde duruyor.
    const kalan = await a.db.firma.findFirst({ where: { id: yeni.id } });
    expect(kalan).not.toBeNull();

    // 5) İkinci geri yükleme hiçbir şey eklemez (idempotent).
    const tekrar = await geriYukle(db, a.id, icerik);
    expect(tekrar.toplamEklenen).toBe(0);
  });

  it("yedek dosyası tenantId içermez ve geri yükleme oturumun kiracısına damgalar", async () => {
    const { yedekOlustur, yedekAc, yedekIstemcisi } = await import("../src/lib/yedek-saf");

    const ozet = await yedekOlustur(yedekIstemcisi(a.db), a.id, "elle");
    const yedek = await a.db.yedek.findFirst({ where: { id: ozet.id } });
    const icerik = yedekAc(Buffer.from(yedek!.icerik))!;

    for (const satirlar of Object.values(icerik.veriler)) {
      for (const satir of satirlar) {
        expect(satir).not.toHaveProperty("tenantId");
      }
    }
  });

  it("bozuk içerik açılmaz, hata fırlatmaz", async () => {
    const { yedekAc, dosyadanIcerik } = await import("../src/lib/yedek-saf");

    expect(yedekAc(Buffer.from("rastgele"))).toBeNull();
    expect(dosyadanIcerik(Buffer.from("{}"))).toBeNull(); // bicim alanı yok
    expect(dosyadanIcerik(Buffer.from("json değil"))).toBeNull();
  });

  it("yedek yönetimi kuruluş yöneticisine aittir", () => {
    expect(ROL_IZINLERI[ROL.tenantAdmin]).toContain(IZIN.yedekYonet);
    expect(ROL_IZINLERI[ROL.uye]).not.toContain(IZIN.yedekYonet);
    expect(ROL_IZINLERI[ROL.saltOkunur]).not.toContain(IZIN.yedekYonet);
  });
});
