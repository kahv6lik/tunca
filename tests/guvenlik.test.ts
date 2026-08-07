import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { kiraciCifti, temizle, yonetim, baglantiyiKapat, type Kiraci } from "./fixture";
import {
  SIFRE_ASGARI_UZUNLUK,
  sifreDogrula,
  sifreEskidiMi,
  KILIT_ESIGI,
  KILIT_DAKIKA,
  basarisizSonrasi,
  kilitliMi,
  kalanKilitDakika,
  base32Kodla,
  base32Coz,
  cihazOzeti,
  TOTP_PERIYOT,
} from "../src/lib/guvenlik-tanimlar";
import {
  totpSirUret,
  totpKod,
  totpDogrula,
  totpUri,
  yedekKodUret,
  yedekKodlarUret,
  yedekKodNormalize,
} from "../src/lib/guvenlik-totp";
import { saklamaEsigi, KVKK_SURUM, KVKK_METNI } from "../src/lib/kvkk-tanimlar";

/**
 * Hesap güvenliği ve KVKK (Faz 12 / F1-F4, F7).
 *
 * Saf katman: şifre politikası, kilit hesabı, TOTP, yedek kodlar, saklama.
 * Veritabanı katmanı: oturum/sıfırlama kayıtlarının kiracı sınırı ve giriş
 * denemesi tablosunun kiracı bağlamında GÖRÜNMEZ olması.
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

describe("F1 — Şifre politikası (saf)", () => {
  it("geçerli bir şifre kabul edilir", () => {
    expect(sifreDogrula("Kayisi2026Bahce")).toEqual({ ok: true });
  });

  it("kısa şifre reddedilir", () => {
    expect(sifreDogrula("Ab1cdef").ok).toBe(false);
    expect(sifreDogrula("A1" + "b".repeat(SIFRE_ASGARI_UZUNLUK - 3)).ok).toBe(false);
  });

  it("büyük/küçük harf ve rakam zorunludur", () => {
    expect(sifreDogrula("hepsikucukharf1").ok).toBe(false); // büyük harf yok
    expect(sifreDogrula("HEPSIBUYUKHARF1").ok).toBe(false); // küçük harf yok
    expect(sifreDogrula("BuradaRakamYokTur").ok).toBe(false);
  });

  it("yaygın parola içeren şifre reddedilir", () => {
    expect(sifreDogrula("Password12345").ok).toBe(false);
    expect(sifreDogrula("BenimParolam1").ok).toBe(false);
  });

  it("e-posta adının şifrede geçmesi reddedilir", () => {
    // Kullanıcı adı "mehmet" — şifrede geçemez.
    expect(sifreDogrula("Mehmet2026Ankara", "mehmet@firma.com").ok).toBe(false);
    expect(sifreDogrula("Kayisi2026Bahce", "mehmet@firma.com").ok).toBe(true);
  });

  it("şifre yaşı politikası: 0 = süresiz", () => {
    const eski = new Date(Date.now() - 200 * 86_400_000);
    expect(sifreEskidiMi(eski, 0)).toBe(false);
    expect(sifreEskidiMi(eski, 90)).toBe(true);
    expect(sifreEskidiMi(new Date(), 90)).toBe(false);
    expect(sifreEskidiMi(null, 90)).toBe(false);
  });
});

describe("F4 — Hız sınırlama ve kilit (saf)", () => {
  it("eşiğe gelen deneme hesabı kilitler ve sayacı sıfırlar", () => {
    let sayac = 0;
    for (let i = 1; i < KILIT_ESIGI; i++) {
      const sonuc = basarisizSonrasi(sayac);
      sayac = sonuc.sayac;
      expect(sonuc.kilitBitis).toBeNull();
    }
    const son = basarisizSonrasi(sayac);
    expect(son.kilitBitis).not.toBeNull();
    // Kilit süresi dolunca kullanıcı tam hakla başlar.
    expect(son.sayac).toBe(0);
  });

  it("kilit süresi geçince kilit düşer", () => {
    const simdi = new Date("2026-08-07T10:00:00Z");
    const kilit = new Date(simdi.getTime() + KILIT_DAKIKA * 60_000);

    expect(kilitliMi(kilit, simdi)).toBe(true);
    expect(kalanKilitDakika(kilit, simdi)).toBe(KILIT_DAKIKA);

    const sonra = new Date(kilit.getTime() + 1000);
    expect(kilitliMi(kilit, sonra)).toBe(false);
    expect(kalanKilitDakika(kilit, sonra)).toBe(0);
  });

  it("kilit yoksa engel yok", () => {
    expect(kilitliMi(null)).toBe(false);
  });
});

describe("F2 — TOTP (saf)", () => {
  it("base32 kodlama tersine çevrilebilir", () => {
    const veri = Buffer.from("gezegen-crm-deneme");
    expect(base32Coz(base32Kodla(veri)).toString()).toBe(veri.toString());
  });

  it("üretilen sır ile üretilen kod doğrulanır", () => {
    const sir = totpSirUret();
    const kod = totpKod(sir);
    expect(kod).toMatch(/^\d{6}$/);
    expect(totpDogrula(sir, kod)).toBe(true);
  });

  it("başka bir sırrın kodu doğrulanmaz", () => {
    const sir = totpSirUret();
    const baskaSir = totpSirUret();
    expect(totpDogrula(sir, totpKod(baskaSir))).toBe(false);
  });

  it("±1 pencere toleransı var, dışı reddedilir", () => {
    const sir = totpSirUret();
    const simdi = new Date("2026-08-07T10:00:00Z");

    const oncekiPencere = new Date(simdi.getTime() - TOTP_PERIYOT * 1000);
    const cokEski = new Date(simdi.getTime() - TOTP_PERIYOT * 5 * 1000);

    expect(totpDogrula(sir, totpKod(sir, oncekiPencere), simdi)).toBe(true);
    expect(totpDogrula(sir, totpKod(sir, cokEski), simdi)).toBe(false);
  });

  it("biçimsiz kod reddedilir", () => {
    const sir = totpSirUret();
    expect(totpDogrula(sir, "12345")).toBe(false);
    expect(totpDogrula(sir, "")).toBe(false);
    expect(totpDogrula(sir, "abcdef")).toBe(false);
  });

  it("RFC 6238 örnek vektörü doğrulanır", () => {
    // RFC 6238 test sırrı "12345678901234567890" (base32: GEZDGNBVGY3TQOJQ).
    // T = 59 sn için beklenen SHA1/6 hane kodu 287082'dir.
    const sir = base32Kodla(Buffer.from("12345678901234567890"));
    expect(sir).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(totpKod(sir, new Date(59 * 1000))).toBe("287082");
  });

  it("otpauth adresi doğrulama uygulamalarının beklediği biçimdedir", () => {
    const uri = totpUri("ABCD2345", "ali@firma.com", "Gezegen Danışmanlık");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=ABCD2345");
    expect(uri).toContain("issuer=Gezegen%20Dan");
    expect(uri).toContain("digits=6");
  });

  it("yedek kodlar okunur ve normalleştirilebilir", () => {
    const kod = yedekKodUret();
    expect(kod).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    // Karışan karakterler (I, O, 0, 1) alfabede yok.
    expect(kod).not.toMatch(/[IO01]/);
    expect(yedekKodNormalize(" a3f2-9k7q ")).toBe("A3F29K7Q");
    expect(yedekKodlarUret(8)).toHaveLength(8);
  });
});

describe("Cihaz özeti (saf)", () => {
  it("tarayıcı ve işletim sistemi okunur biçimde çıkarılır", () => {
    const chrome =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(cihazOzeti(chrome)).toBe("Chrome · macOS");
    expect(cihazOzeti("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1")).toContain("iOS");
    expect(cihazOzeti(null)).toBe("Bilinmeyen cihaz");
  });
});

describe("F7 — KVKK (saf)", () => {
  it("aydınlatma metni sürümlüdür ve zorunlu bölümleri içerir", () => {
    expect(KVKK_SURUM).toMatch(/^\d{4}-\d{2}-\d+$/);
    const basliklar = KVKK_METNI.map((b) => b.baslik);
    expect(basliklar).toContain("Veri sorumlusu");
    expect(basliklar).toContain("Saklama süresi");
    expect(basliklar.some((b) => b.includes("Haklarınız"))).toBe(true);
  });

  it("saklama eşiği: 0 = silme yok", () => {
    const simdi = new Date("2026-08-07T00:00:00Z");
    expect(saklamaEsigi(0, simdi)).toBeNull();
    const esik = saklamaEsigi(90, simdi)!;
    expect(esik.toISOString().slice(0, 10)).toBe("2026-05-09");
  });
});

describe("Veritabanı katmanı", () => {
  it("oturum kaydı kiracı sınırına tabidir", async () => {
    await yonetim.oturum.create({
      data: {
        tenantId: b.id,
        userId: b.kullaniciId,
        jti: "b-nin-oturumu",
        sonKullanma: new Date(Date.now() + 86_400_000),
      },
    });

    const aGorunum = await a.db.oturum.findMany({});
    expect(aGorunum.some((o) => o.jti === "b-nin-oturumu")).toBe(false);
  });

  it("şifre sıfırlama kaydı kiracı sınırına tabidir", async () => {
    await yonetim.sifreSifirlama.create({
      data: {
        tenantId: b.id,
        userId: b.kullaniciId,
        tokenOzeti: "b-nin-ozeti",
        sonKullanma: new Date(Date.now() + 3_600_000),
      },
    });

    const aGorunum = await a.db.sifreSifirlama.findMany({});
    expect(aGorunum.some((s) => s.tokenOzeti === "b-nin-ozeti")).toBe(false);
  });

  it("giriş denemeleri kiracı bağlamında HİÇ görünmez", async () => {
    // Bu tablo tasarımı gereği kiracıya bağlı değildir (giriş öncesi yazılır).
    // Kiracı bağlamında sıfır satır dönmeli — kimin ne zaman giriş denediği
    // müşteriye açılan bir yüzey olmamalıdır.
    await yonetim.girisDenemesi.create({
      data: { email: "deneme@test.local", ip: "10.0.0.1", basarili: false },
    });

    const aGorunum = await a.db.girisDenemesi.findMany({});
    expect(aGorunum).toHaveLength(0);
  });

  it("kullanıcı silinince oturumları da silinir (cascade)", async () => {
    const kullanici = await yonetim.user.create({
      data: {
        tenantId: a.id,
        email: `silinecek-${Date.now()}@test.local`,
        name: "Silinecek",
        password: "x",
      },
    });
    const oturum = await yonetim.oturum.create({
      data: {
        tenantId: a.id,
        userId: kullanici.id,
        jti: `jti-${Date.now()}`,
        sonKullanma: new Date(Date.now() + 86_400_000),
      },
    });

    await yonetim.user.delete({ where: { id: kullanici.id } });

    const kalan = await yonetim.oturum.findUnique({ where: { id: oturum.id } });
    expect(kalan).toBeNull();
  });

  it("jti tekildir — aynı oturum kimliği iki kez açılamaz", async () => {
    const jti = `tekil-${Date.now()}`;
    await yonetim.oturum.create({
      data: {
        tenantId: a.id,
        userId: a.kullaniciId,
        jti,
        sonKullanma: new Date(Date.now() + 86_400_000),
      },
    });
    await expect(
      yonetim.oturum.create({
        data: {
          tenantId: b.id,
          userId: b.kullaniciId,
          jti,
          sonKullanma: new Date(Date.now() + 86_400_000),
        },
      })
    ).rejects.toThrow();
  });

  it("kuruluş güvenlik politikaları varsayılanlarla gelir", async () => {
    const kiraci = await yonetim.tenant.findUnique({ where: { id: a.id } });
    // Varsayılanlar geriye dönük uyumlu: 2FA zorunlu değil, saklama süresiz.
    expect(kiraci?.ikiFaktorZorunlu).toBe(false);
    expect(kiraci?.veriSaklamaGun).toBe(0);
    expect(kiraci?.oturumOmruGun).toBe(7);
  });
});
