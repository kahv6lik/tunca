import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { kiraciCifti, temizle, yonetim, type Kiraci } from "./fixture";
import {
  siparisIstemcisi,
  siparisiOnayla,
  siparisiIptalEt,
  sevkiyatAcilabilirMi,
  stokYeterliMi,
  siradakiBelgeNo,
  belgeNo,
} from "../src/lib/siparis";
import { stokIstemcisi, stokHareketiIsle } from "../src/lib/stok";

/**
 * Sipariş ve onay akışı — Faz 15 / S1, S3, S4.
 *
 * FAZIN SÖZÜ: onaylanmadan sevkiyat doğmaz, stok düşmez. Buradaki testler
 * o sözü sabitler — ve onayın yarı yolda kalması hâlinde stoğun tutarlı
 * kaldığını doğrular.
 */

const GUN = 24 * 60 * 60 * 1000;

async function urunKur(tenantId: string, over: Record<string, unknown> = {}) {
  return yonetim.urun.create({
    data: {
      tenantId,
      kod: `U-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      ad: "Test Ürünü",
      birim: "adet",
      listeFiyat: 100,
      stokTakibi: true,
      stokMiktar: 0,
      ...over,
    },
  });
}

async function siparisKur(
  k: Kiraci,
  kalemler: { urunId?: string; miktar: number; kampanyaId?: string; indirim?: number }[],
  over: Record<string, unknown> = {}
) {
  const siparis = await yonetim.siparis.create({
    data: {
      tenantId: k.id,
      no: `SIP-TEST-${Math.random().toString(36).slice(2, 8)}`,
      firmaId: k.firmaId,
      durum: "onaybekliyor",
      toplam: 1000,
      ...over,
    },
  });

  for (const [i, kalem] of kalemler.entries()) {
    await yonetim.siparisKalemi.create({
      data: {
        tenantId: k.id,
        siparisId: siparis.id,
        sira: i,
        aciklama: "Kalem",
        urunId: kalem.urunId ?? null,
        miktar: kalem.miktar,
        birimFiyat: 100,
        tutar: kalem.miktar * 100,
        kampanyaId: kalem.kampanyaId ?? null,
        indirimTutari: kalem.indirim ?? 0,
      },
    });
  }

  return siparis;
}

describe("Sevkiyat kapısı — akışın sözü", () => {
  it("YALNIZCA onaylanmış siparişten sevkiyat açılabilir", () => {
    expect(sevkiyatAcilabilirMi("onaylandi").ok).toBe(true);

    for (const durum of ["taslak", "onaybekliyor", "reddedildi", "iptal"]) {
      const sonuc = sevkiyatAcilabilirMi(durum);
      expect(sonuc.ok, `${durum} için sevkiyat açılmamalı`).toBe(false);
      expect(sonuc.hata).toBeTruthy();
    }
  });

  it("onay bekleyen siparişin gerekçesi kullanıcıya açıkça söylenir", () => {
    expect(sevkiyatAcilabilirMi("onaybekliyor").hata).toContain("Onaylanmadan");
  });

  it("tanınmayan durum da varsayılan olarak REDDEDİLİR", () => {
    // Yeni bir durum eklenip burası unutulursa güvenli tarafta kalınır.
    expect(sevkiyatAcilabilirMi("yeni-bir-durum").ok).toBe(false);
  });
});

describe("Belge numarası", () => {
  let a: Kiraci;
  let b: Kiraci;

  beforeAll(async () => {
    ({ a, b } = await kiraciCifti());
  });
  afterAll(async () => {
    await temizle(a, b);
  });

  it("biçim SIP-YIL-0001", () => {
    expect(belgeNo("SIP", 2026, 1)).toBe("SIP-2026-0001");
    expect(belgeNo("SVK", 2026, 42)).toBe("SVK-2026-0042");
  });

  it("sayaç ardışık ve yıl bazında ayrıdır", async () => {
    const db = siparisIstemcisi(a.db) as never;
    const n1 = await siradakiBelgeNo(db, a.id, "siparis", 2026);
    const n2 = await siradakiBelgeNo(db, a.id, "siparis", 2026);
    const y1 = await siradakiBelgeNo(db, a.id, "siparis", 2027);

    expect(n1).toBe("SIP-2026-0001");
    expect(n2).toBe("SIP-2026-0002");
    // Yeni yıl 1'den başlar — muhasebe alışkanlığı.
    expect(y1).toBe("SIP-2027-0001");
  });

  it("sipariş ve sevkiyat sayaçları birbirini etkilemez", async () => {
    const db = siparisIstemcisi(a.db) as never;
    await siradakiBelgeNo(db, a.id, "siparis", 2030);
    const svk = await siradakiBelgeNo(db, a.id, "sevkiyat", 2030);
    expect(svk).toBe("SVK-2030-0001");
  });

  it("eşzamanlı istekler AYNI numarayı vermez", async () => {
    const db = siparisIstemcisi(a.db) as never;
    const numaralar = await Promise.all(
      Array.from({ length: 8 }, () => siradakiBelgeNo(db, a.id, "siparis", 2040))
    );
    expect(new Set(numaralar).size).toBe(8);
  });
});

describe("Sipariş onayı — stok düşümü", () => {
  let a: Kiraci;
  let b: Kiraci;

  beforeAll(async () => {
    ({ a, b } = await kiraciCifti());
  });
  afterAll(async () => {
    await temizle(a, b);
  });

  it("onay stoğu düşer ve durumu 'onaylandı' yapar", async () => {
    const urun = await urunKur(a.id);
    await stokHareketiIsle(stokIstemcisi(a.db), a.id, {
      urunId: urun.id, tur: "giris", miktar: 50,
    });
    const siparis = await siparisKur(a, [{ urunId: urun.id, miktar: 10 }]);

    const sonuc = await siparisiOnayla(siparisIstemcisi(a.db), a.id, siparis.id, a.kullaniciId);
    expect(sonuc.ok).toBe(true);

    const guncel = await a.db.urun.findFirst({ where: { id: urun.id } });
    expect(guncel!.stokMiktar).toBe(40);

    const s = await a.db.siparis.findFirst({ where: { id: siparis.id } });
    expect(s!.durum).toBe("onaylandi");
    expect(s!.onaylayanId).toBe(a.kullaniciId);
    expect(s!.stokDusuldu).toBe(true);
  });

  it("STOK YETMEZSE onay verilmez ve hiçbir şey düşmez", async () => {
    const urun = await urunKur(a.id);
    await stokHareketiIsle(stokIstemcisi(a.db), a.id, {
      urunId: urun.id, tur: "giris", miktar: 5,
    });
    const siparis = await siparisKur(a, [{ urunId: urun.id, miktar: 20 }]);

    const sonuc = await siparisiOnayla(siparisIstemcisi(a.db), a.id, siparis.id, a.kullaniciId);
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.hata).toContain("Stok yetersiz");

    const guncel = await a.db.urun.findFirst({ where: { id: urun.id } });
    expect(guncel!.stokMiktar).toBe(5);

    const s = await a.db.siparis.findFirst({ where: { id: siparis.id } });
    expect(s!.durum).toBe("onaybekliyor"); // durum DEĞİŞMEDİ
  });

  it("çok kalemli siparişte biri yetmezse HİÇBİRİ düşmez", async () => {
    const bol = await urunKur(a.id, { ad: "Bol" });
    const az = await urunKur(a.id, { ad: "Az" });
    const db = stokIstemcisi(a.db);
    await stokHareketiIsle(db, a.id, { urunId: bol.id, tur: "giris", miktar: 100 });
    await stokHareketiIsle(db, a.id, { urunId: az.id, tur: "giris", miktar: 2 });

    const siparis = await siparisKur(a, [
      { urunId: bol.id, miktar: 10 },
      { urunId: az.id, miktar: 5 },
    ]);

    const sonuc = await siparisiOnayla(siparisIstemcisi(a.db), a.id, siparis.id, a.kullaniciId);
    expect(sonuc.ok).toBe(false);

    // Bol ürünün stoğu da düşmemiş olmalı — ya hep ya hiç.
    expect((await a.db.urun.findFirst({ where: { id: bol.id } }))!.stokMiktar).toBe(100);
    expect((await a.db.urun.findFirst({ where: { id: az.id } }))!.stokMiktar).toBe(2);
  });

  it("aynı ürün iki satırdaysa TOPLAM ihtiyaç üzerinden bakılır", async () => {
    const urun = await urunKur(a.id);
    await stokHareketiIsle(stokIstemcisi(a.db), a.id, {
      urunId: urun.id, tur: "giris", miktar: 10,
    });
    // 6 + 6 = 12 > 10: tek tek bakılsaydı ikisi de geçerdi.
    const siparis = await siparisKur(a, [
      { urunId: urun.id, miktar: 6 },
      { urunId: urun.id, miktar: 6 },
    ]);

    const sonuc = await siparisiOnayla(siparisIstemcisi(a.db), a.id, siparis.id, a.kullaniciId);
    expect(sonuc.ok).toBe(false);
    expect((await a.db.urun.findFirst({ where: { id: urun.id } }))!.stokMiktar).toBe(10);
  });

  it("stok takibi olmayan üründe onay stoğa bakmaz", async () => {
    const hizmet = await urunKur(a.id, { ad: "Danışmanlık", stokTakibi: false });
    const siparis = await siparisKur(a, [{ urunId: hizmet.id, miktar: 999 }]);

    const sonuc = await siparisiOnayla(siparisIstemcisi(a.db), a.id, siparis.id, a.kullaniciId);
    expect(sonuc.ok).toBe(true);
    if (sonuc.ok) expect(sonuc.dusulenSatir).toBe(0);
  });

  it("iki kez onaylanamaz — stok ikinci kez düşmez", async () => {
    const urun = await urunKur(a.id);
    await stokHareketiIsle(stokIstemcisi(a.db), a.id, {
      urunId: urun.id, tur: "giris", miktar: 50,
    });
    const siparis = await siparisKur(a, [{ urunId: urun.id, miktar: 10 }]);
    const db = siparisIstemcisi(a.db);

    await siparisiOnayla(db, a.id, siparis.id, a.kullaniciId);
    const ikinci = await siparisiOnayla(db, a.id, siparis.id, a.kullaniciId);

    expect(ikinci.ok).toBe(false);
    expect((await a.db.urun.findFirst({ where: { id: urun.id } }))!.stokMiktar).toBe(40);
  });

  it("stok hareketi sipariş numarasını referans olarak taşır", async () => {
    const urun = await urunKur(a.id);
    await stokHareketiIsle(stokIstemcisi(a.db), a.id, {
      urunId: urun.id, tur: "giris", miktar: 20,
    });
    const siparis = await siparisKur(a, [{ urunId: urun.id, miktar: 3 }]);
    await siparisiOnayla(siparisIstemcisi(a.db), a.id, siparis.id, a.kullaniciId);

    const hareket = await a.db.stokHareketi.findFirst({
      where: { urunId: urun.id, tur: "cikis" },
    });
    expect(hareket!.referans).toBe(siparis.no);
  });
});

describe("Sipariş onayı — kampanya kotası", () => {
  let a: Kiraci;
  let b: Kiraci;

  beforeAll(async () => {
    ({ a, b } = await kiraciCifti());
  });
  afterAll(async () => {
    await temizle(a, b);
  });

  async function kampanyaKur(kota: number) {
    return yonetim.kampanya.create({
      data: {
        tenantId: a.id,
        kod: `K-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        ad: "Kampanya",
        tip: "yuzde",
        durum: "aktif",
        baslangic: new Date(Date.now() - GUN),
        bitis: new Date(Date.now() + GUN),
        deger: 10,
        kota,
      },
    });
  }

  it("onay kampanya kotasını düşer ve kullanım defterine yazar", async () => {
    const kampanya = await kampanyaKur(10);
    const siparis = await siparisKur(a, [
      { miktar: 3, kampanyaId: kampanya.id, indirim: 300 },
    ]);

    const sonuc = await siparisiOnayla(siparisIstemcisi(a.db), a.id, siparis.id, a.kullaniciId);
    expect(sonuc.ok).toBe(true);

    const k = await a.db.kampanya.findFirst({ where: { id: kampanya.id } });
    expect(k!.kullanilan).toBe(3);

    const kullanim = await a.db.kampanyaKullanim.findMany({
      where: { kampanyaId: kampanya.id },
    });
    expect(kullanim[0].referans).toBe(siparis.no);
    expect(kullanim[0].indirimTutari).toBe(300);
  });

  it("KOTA YETMEZSE onay reddedilir ve DÜŞÜLEN STOK İADE EDİLİR", async () => {
    const urun = await urunKur(a.id);
    await stokHareketiIsle(stokIstemcisi(a.db), a.id, {
      urunId: urun.id, tur: "giris", miktar: 100,
    });
    const kampanya = await kampanyaKur(2); // yalnızca 2 hak

    const siparis = await siparisKur(a, [
      { urunId: urun.id, miktar: 5, kampanyaId: kampanya.id, indirim: 500 },
    ]);

    const sonuc = await siparisiOnayla(siparisIstemcisi(a.db), a.id, siparis.id, a.kullaniciId);
    expect(sonuc.ok).toBe(false);

    // Stok geri verilmiş olmalı: sipariş onaylanmadıysa stok da düşmemeli.
    const guncel = await a.db.urun.findFirst({ where: { id: urun.id } });
    expect(guncel!.stokMiktar).toBe(100);

    // İade hareketi deftere düşmüş olmalı (bakiye sessizce düzeltilmez).
    const iade = await a.db.stokHareketi.findFirst({
      where: { urunId: urun.id, tur: "iade" },
    });
    expect(iade).not.toBeNull();
    expect(iade!.aciklama).toContain("Onay geri alındı");
  });
});

describe("Sipariş iptali", () => {
  let a: Kiraci;
  let b: Kiraci;

  beforeAll(async () => {
    ({ a, b } = await kiraciCifti());
  });
  afterAll(async () => {
    await temizle(a, b);
  });

  it("onaylanmış siparişin iptali stoğu İADE HAREKETİYLE geri verir", async () => {
    const urun = await urunKur(a.id);
    await stokHareketiIsle(stokIstemcisi(a.db), a.id, {
      urunId: urun.id, tur: "giris", miktar: 30,
    });
    const siparis = await siparisKur(a, [{ urunId: urun.id, miktar: 10 }]);
    const db = siparisIstemcisi(a.db);

    await siparisiOnayla(db, a.id, siparis.id, a.kullaniciId);
    expect((await a.db.urun.findFirst({ where: { id: urun.id } }))!.stokMiktar).toBe(20);

    const iptal = await siparisiIptalEt(db, a.id, siparis.id, a.kullaniciId);
    expect(iptal.ok).toBe(true);
    expect((await a.db.urun.findFirst({ where: { id: urun.id } }))!.stokMiktar).toBe(30);

    const s = await a.db.siparis.findFirst({ where: { id: siparis.id } });
    expect(s!.durum).toBe("iptal");
    // İkinci iptal stoğu tekrar artırmamalı.
    await siparisiIptalEt(db, a.id, siparis.id, a.kullaniciId);
    expect((await a.db.urun.findFirst({ where: { id: urun.id } }))!.stokMiktar).toBe(30);
  });

  it("onaylanmamış siparişin iptali stoğa DOKUNMAZ", async () => {
    const urun = await urunKur(a.id);
    await stokHareketiIsle(stokIstemcisi(a.db), a.id, {
      urunId: urun.id, tur: "giris", miktar: 15,
    });
    const siparis = await siparisKur(a, [{ urunId: urun.id, miktar: 5 }]);

    await siparisiIptalEt(siparisIstemcisi(a.db), a.id, siparis.id, a.kullaniciId);
    expect((await a.db.urun.findFirst({ where: { id: urun.id } }))!.stokMiktar).toBe(15);
  });

  it("SEVK EDİLMİŞ sipariş iptal edilemez", async () => {
    const urun = await urunKur(a.id);
    await stokHareketiIsle(stokIstemcisi(a.db), a.id, {
      urunId: urun.id, tur: "giris", miktar: 20,
    });
    const siparis = await siparisKur(a, [{ urunId: urun.id, miktar: 5 }]);
    const db = siparisIstemcisi(a.db);
    await siparisiOnayla(db, a.id, siparis.id, a.kullaniciId);

    await yonetim.sevkiyat.create({
      data: {
        tenantId: a.id,
        siparisId: siparis.id,
        no: `SVK-TEST-${Math.random().toString(36).slice(2, 8)}`,
        durum: "sevkedildi",
      },
    });

    const sonuc = await siparisiIptalEt(db, a.id, siparis.id, a.kullaniciId);
    expect(sonuc.ok).toBe(false);
    expect(sonuc.hata).toContain("Sevk edilmiş");
    // Stok da geri verilmemeli — mal yola çıkmış.
    expect((await a.db.urun.findFirst({ where: { id: urun.id } }))!.stokMiktar).toBe(15);
  });
});

describe("Kiracı sınırı", () => {
  let a: Kiraci;
  let b: Kiraci;

  beforeAll(async () => {
    ({ a, b } = await kiraciCifti());
  });
  afterAll(async () => {
    await temizle(a, b);
  });

  it("komşunun siparişi onaylanamaz", async () => {
    const bSiparis = await siparisKur(b, [{ miktar: 1 }]);

    const sonuc = await siparisiOnayla(
      siparisIstemcisi(a.db),
      a.id,
      bSiparis.id,
      a.kullaniciId
    );
    expect(sonuc.ok).toBe(false);

    const s = await b.db.siparis.findFirst({ where: { id: bSiparis.id } });
    expect(s!.durum).toBe("onaybekliyor");
  });

  it("stok yeterlilik kontrolü komşunun ürününü görmez", async () => {
    const bUrun = await urunKur(b.id, { stokMiktar: 1000 });
    const sonuc = await stokYeterliMi(siparisIstemcisi(a.db), [
      { id: "x", urunId: bUrun.id, aciklama: "k", miktar: 5, kampanyaId: null, indirimTutari: 0 },
    ]);
    // Ürün a'nın bağlamında görünmez → kısıt uygulanmaz (kayıt yok sayılır).
    expect(sonuc.ok).toBe(true);
  });
});
