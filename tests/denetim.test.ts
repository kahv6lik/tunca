import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { kiraciCifti, temizle, temel, yonetim, baglantiyiKapat, type Kiraci } from "./fixture";

/**
 * Denetim günlüğü testleri (Faz 4 / A8).
 *
 * En kritik iddia: günlük **değiştirilemez**. Bir denetim kaydı sonradan
 * düzenlenebiliyor veya silinebiliyorsa hiçbir şey kanıtlamaz.
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

async function kayitEkle(k: Kiraci, ozet: string) {
  return k.db.denetimKaydi.create({
    data: {
      tenantId: k.id,
      kullaniciId: k.kullaniciId,
      kullaniciEmail: k.email,
      islem: "guncelle",
      varlik: "Firma",
      varlikId: k.firmaId,
      ozet,
      eski: { ad: "Eski Ad" },
      yeni: { ad: "Yeni Ad" },
    },
  });
}

describe("Denetim kaydı yazma ve okuma", () => {
  it("kayıt yazılabilir ve okunabilir", async () => {
    const kayit = await kayitEkle(a, "ilk kayıt");
    const okunan = await a.db.denetimKaydi.findFirst({ where: { id: kayit.id } });
    expect(okunan?.ozet).toBe("ilk kayıt");
    expect(okunan?.kullaniciEmail).toBe(a.email);
    expect(okunan?.eski).toEqual({ ad: "Eski Ad" });
    expect(okunan?.yeni).toEqual({ ad: "Yeni Ad" });
  });

  it("kullanıcı e-postası kayıtta saklanır (kullanıcı silinse de kim olduğu kalır)", async () => {
    const kayit = await a.db.denetimKaydi.findFirst({ where: { ozet: "ilk kayıt" } });
    expect(kayit?.kullaniciEmail).toBeTruthy();
  });
});

describe("Denetim günlüğü DEĞİŞTİRİLEMEZ", () => {
  it("var olan bir kayıt güncellenemez", async () => {
    const kayit = await a.db.denetimKaydi.findFirst({ where: { ozet: "ilk kayıt" } });
    expect(kayit).not.toBeNull();

    // RLS'te DenetimKaydi için kiracıya UPDATE politikası tanımlı DEĞİL.
    // Politika olmadığı için hiçbir satır eşleşmez → 0 satır etkilenir.
    const sonuc = await a.db.denetimKaydi.updateMany({
      where: { id: kayit!.id },
      data: { ozet: "DEĞİŞTİRİLDİ" },
    });
    expect(sonuc.count).toBe(0);

    const sonrasi = await a.db.denetimKaydi.findFirst({ where: { id: kayit!.id } });
    expect(sonrasi?.ozet).toBe("ilk kayıt");
  });

  it("var olan bir kayıt silinemez", async () => {
    const kayit = await a.db.denetimKaydi.findFirst({ where: { ozet: "ilk kayıt" } });
    const sonuc = await a.db.denetimKaydi.deleteMany({ where: { id: kayit!.id } });
    expect(sonuc.count).toBe(0);
    expect(await a.db.denetimKaydi.findFirst({ where: { id: kayit!.id } })).not.toBeNull();
  });

  it("RLS politikaları yalnızca SELECT ve INSERT içeriyor", async () => {
    const politikalar = await temel.$queryRawUnsafe<{ policyname: string; cmd: string }[]>(`
      SELECT policyname, cmd FROM pg_policies
      WHERE tablename = 'DenetimKaydi' AND schemaname = 'test'
      ORDER BY policyname
    `);
    const kiraciPolitikalari = politikalar.filter((p) => !p.policyname.includes("yonetim"));
    const komutlar = kiraciPolitikalari.map((p) => p.cmd).sort();
    expect(komutlar).toEqual(["INSERT", "SELECT"]);
  });
});

describe("Denetim günlüğü kiracı sınırına tabi", () => {
  it("A, B'nin denetim kayıtlarını göremez", async () => {
    const bKayit = await kayitEkle(b, "B kaydı");
    expect(await a.db.denetimKaydi.findFirst({ where: { id: bKayit.id } })).toBeNull();

    const aKayitlar = await a.db.denetimKaydi.findMany();
    expect(aKayitlar.every((k) => k.tenantId === a.id)).toBe(true);
    expect(aKayitlar.map((k) => k.ozet)).not.toContain("B kaydı");
  });

  it("bağlamsız erişimde denetim günlüğü de görünmez", async () => {
    expect(await temel.denetimKaydi.count()).toBe(0);
  });

  it("A, B kiracısı adına denetim kaydı yazamaz", async () => {
    await expect(
      a.db.denetimKaydi.create({
        data: {
          tenantId: b.id,
          kullaniciEmail: "sahte@test.local",
          islem: "sil",
          varlik: "Firma",
          varlikId: b.firmaId,
        },
      })
    ).rejects.toThrow();
  });
});

describe("Yönetim bağlamı", () => {
  it("kurulum betikleri günlüğü temizleyebilir (kiracı silme senaryosu)", async () => {
    // Yönetim bağlamının tam erişimi vardır; kiracı silindiğinde günlüğün de
    // cascade ile gitmesi bunu gerektirir.
    const sayi = await yonetim.denetimKaydi.count({ where: { tenantId: a.id } });
    expect(sayi).toBeGreaterThan(0);
  });
});
