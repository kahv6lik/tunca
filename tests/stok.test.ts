import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { kiraciCifti, temizle, yonetim, type Kiraci } from "./fixture";
import {
  stokIstemcisi,
  stokHareketiIsle,
  sayimIsle,
  isaretliMiktar,
  turYonu,
  kritikStoktakiUrunler,
} from "../src/lib/stok";

/**
 * Stok defteri — Faz 14 / T7, T8.
 *
 * İki söz sınanır:
 *   1. Bakiye hareketlerin toplamıdır (defterle bakiye ayrışmaz).
 *   2. Çıkış atomiktir — iki temsilci son ürünü aynı anda satamaz.
 */

async function urunKur(
  tenantId: string,
  over: Record<string, unknown> = {}
): Promise<string> {
  const u = await yonetim.urun.create({
    data: {
      tenantId,
      kod: `U-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      ad: "Test Ürünü",
      birim: "adet",
      listeFiyat: 100,
      stokTakibi: true,
      stokMiktar: 0,
      kritikStok: 0,
      ...over,
    },
  });
  return u.id;
}

describe("Hareket yönü — işaret kararı tek yerde", () => {
  it("tür yönü tanımdan okunur", () => {
    expect(turYonu("giris")).toBe(1);
    expect(turYonu("cikis")).toBe(-1);
    expect(turYonu("sayim")).toBe(0);
    expect(turYonu("bilinmeyen")).toBe(0);
  });

  it("kullanıcı pozitif girer, işareti tür belirler", () => {
    expect(isaretliMiktar("giris", 5)).toBe(5);
    expect(isaretliMiktar("cikis", 5)).toBe(-5);
    // Kullanıcı yanlışlıkla eksi yazsa bile çıkış eksi kalır.
    expect(isaretliMiktar("cikis", -5)).toBe(-5);
    expect(isaretliMiktar("giris", -5)).toBe(5);
    // İki yönlü türlerde kullanıcının işareti korunur.
    expect(isaretliMiktar("duzeltme", -3)).toBe(-3);
    expect(isaretliMiktar("duzeltme", 3)).toBe(3);
  });
});

describe("Stok hareketi ve bakiye", () => {
  let a: Kiraci;
  let b: Kiraci;

  beforeAll(async () => {
    ({ a, b } = await kiraciCifti());
  });

  afterAll(async () => {
    await temizle(a, b);
  });

  it("giriş bakiyeyi artırır, çıkış azaltır", async () => {
    const id = await urunKur(a.id);
    const db = stokIstemcisi(a.db);

    const giris = await stokHareketiIsle(db, a.id, { urunId: id, tur: "giris", miktar: 100 });
    expect(giris).toMatchObject({ ok: true, yeniBakiye: 100 });

    const cikis = await stokHareketiIsle(db, a.id, { urunId: id, tur: "cikis", miktar: 30 });
    expect(cikis).toMatchObject({ ok: true, yeniBakiye: 70 });

    const urun = await a.db.urun.findFirst({ where: { id } });
    expect(urun!.stokMiktar).toBe(70);
  });

  it("bakiye HAREKETLERİN TOPLAMINA eşittir", async () => {
    const id = await urunKur(a.id);
    const db = stokIstemcisi(a.db);

    await stokHareketiIsle(db, a.id, { urunId: id, tur: "giris", miktar: 50 });
    await stokHareketiIsle(db, a.id, { urunId: id, tur: "giris", miktar: 25 });
    await stokHareketiIsle(db, a.id, { urunId: id, tur: "cikis", miktar: 10 });
    await stokHareketiIsle(db, a.id, { urunId: id, tur: "fire", miktar: 5 });

    const hareketler = await a.db.stokHareketi.findMany({ where: { urunId: id } });
    const toplam = hareketler.reduce((s, h) => s + h.miktar, 0);
    const urun = await a.db.urun.findFirst({ where: { id } });

    expect(toplam).toBe(60);
    expect(urun!.stokMiktar).toBe(60);
  });

  it("her hareket o andaki bakiyeyi de saklar (denetim izi)", async () => {
    const id = await urunKur(a.id);
    const db = stokIstemcisi(a.db);

    await stokHareketiIsle(db, a.id, { urunId: id, tur: "giris", miktar: 10 });
    await stokHareketiIsle(db, a.id, { urunId: id, tur: "giris", miktar: 5 });

    const hareketler = await a.db.stokHareketi.findMany({
      where: { urunId: id },
      orderBy: { createdAt: "asc" },
    });
    expect(hareketler.map((h) => h.sonrakiBakiye)).toEqual([10, 15]);
  });

  it("NEGATİF stoğa düşüren çıkış reddedilir ve hareket YAZILMAZ", async () => {
    const id = await urunKur(a.id);
    const db = stokIstemcisi(a.db);
    await stokHareketiIsle(db, a.id, { urunId: id, tur: "giris", miktar: 5 });

    const sonuc = await stokHareketiIsle(db, a.id, { urunId: id, tur: "cikis", miktar: 8 });
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.hata).toContain("Yetersiz stok");

    const urun = await a.db.urun.findFirst({ where: { id } });
    expect(urun!.stokMiktar).toBe(5);

    // Reddedilen çıkış deftere düşmemeli.
    const hareketler = await a.db.stokHareketi.findMany({ where: { urunId: id } });
    expect(hareketler).toHaveLength(1);
  });

  it("stok takibi kapalı üründe hareket işlenmez", async () => {
    const id = await urunKur(a.id, { stokTakibi: false });
    const sonuc = await stokHareketiIsle(stokIstemcisi(a.db), a.id, {
      urunId: id,
      tur: "giris",
      miktar: 10,
    });

    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.hata).toContain("stok takibi kapalı");
  });

  it("EŞZAMANLI çıkışlar bakiyeyi negatife düşüremez (yarış koşulu)", async () => {
    // Elde 5 var; beş ayrı istek 2'şer adet çıkış istiyor (toplam 10).
    const id = await urunKur(a.id);
    const db = stokIstemcisi(a.db);
    await stokHareketiIsle(db, a.id, { urunId: id, tur: "giris", miktar: 5 });

    const sonuclar = await Promise.all(
      Array.from({ length: 5 }, () =>
        stokHareketiIsle(db, a.id, { urunId: id, tur: "cikis", miktar: 2 })
      )
    );

    expect(sonuclar.filter((s) => s.ok).length).toBe(2); // 5 → 3 → 1
    const urun = await a.db.urun.findFirst({ where: { id } });
    expect(urun!.stokMiktar).toBe(1);
    expect(urun!.stokMiktar).toBeGreaterThanOrEqual(0);
  });

  it("BAŞKA kiracının ürününün bakiyesi değiştirilemez", async () => {
    const bUrun = await urunKur(b.id, { stokMiktar: 100 });

    const sonuc = await stokHareketiIsle(stokIstemcisi(a.db), a.id, {
      urunId: bUrun,
      tur: "cikis",
      miktar: 10,
    });
    expect(sonuc.ok).toBe(false);

    const urun = await b.db.urun.findFirst({ where: { id: bUrun } });
    expect(urun!.stokMiktar).toBe(100);
  });
});

describe("Sayım ve kritik seviye", () => {
  let a: Kiraci;
  let b: Kiraci;

  beforeAll(async () => {
    ({ a, b } = await kiraciCifti());
  });

  afterAll(async () => {
    await temizle(a, b);
  });

  it("sayım FARK kadar hareket yazar, bakiyeyi doğrudan ezmez", async () => {
    const id = await urunKur(a.id);
    const db = stokIstemcisi(a.db);
    await stokHareketiIsle(db, a.id, { urunId: id, tur: "giris", miktar: 100 });

    // Sayımda 97 çıktı: −3'lük bir fark hareketi olmalı.
    const sonuc = await sayimIsle(db, a.id, id, 97);
    expect(sonuc).toMatchObject({ ok: true, yeniBakiye: 97 });

    const sayimHareketi = await a.db.stokHareketi.findFirst({
      where: { urunId: id, tur: "sayim" },
    });
    expect(sayimHareketi!.miktar).toBe(-3);
    expect(sayimHareketi!.aciklama).toContain("sistemde 100");
  });

  it("fark yoksa hareket yazılmaz", async () => {
    const id = await urunKur(a.id);
    const db = stokIstemcisi(a.db);
    await stokHareketiIsle(db, a.id, { urunId: id, tur: "giris", miktar: 40 });

    const sonuc = await sayimIsle(db, a.id, id, 40);
    expect(sonuc.ok).toBe(false);

    const sayimlar = await a.db.stokHareketi.findMany({
      where: { urunId: id, tur: "sayim" },
    });
    expect(sayimlar).toHaveLength(0);
  });

  it("kritik seviyeye düşen ürünler listelenir; eşiksiz ürün uyarı üretmez", async () => {
    const kritik = await urunKur(a.id, { ad: "Kritik Ürün", kritikStok: 10 });
    const bol = await urunKur(a.id, { ad: "Bol Ürün", kritikStok: 5 });
    await urunKur(a.id, { ad: "Eşiksiz Ürün", kritikStok: 0 });

    const db = stokIstemcisi(a.db);
    await stokHareketiIsle(db, a.id, { urunId: kritik, tur: "giris", miktar: 8 });
    await stokHareketiIsle(db, a.id, { urunId: bol, tur: "giris", miktar: 500 });

    const liste = await kritikStoktakiUrunler(db);
    const adlar = liste.map((u) => u.ad);

    expect(adlar).toContain("Kritik Ürün");
    expect(adlar).not.toContain("Bol Ürün");
    // kritikStok = 0 "uyarma" demektir — stoğu 0 olsa bile listelenmez.
    expect(adlar).not.toContain("Eşiksiz Ürün");
  });

  it("kritik liste kiracı sınırını aşmaz", async () => {
    const bUrun = await urunKur(b.id, { ad: "Komşu Ürünü", kritikStok: 100 });
    await stokHareketiIsle(stokIstemcisi(b.db), b.id, {
      urunId: bUrun,
      tur: "giris",
      miktar: 1,
    });

    const liste = await kritikStoktakiUrunler(stokIstemcisi(a.db));
    expect(liste.map((u) => u.ad)).not.toContain("Komşu Ürünü");
  });
});
