import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { kiraciCifti, temizle, yonetim, baglantiyiKapat, type Kiraci } from "./fixture";
import { sifrele, coz, maskele } from "../src/lib/sifreleme";
import { TETIKLEYICILER, EYLEMLER } from "../src/lib/is-akisi-tanimlar";
import { PAKET_MODULLERI, modulKapaliMi } from "../src/lib/constants";
import { IZIN, ROL, ROL_IZINLERI } from "../src/lib/yetki-tanimlar";

/**
 * Otomasyon ve iletişim testleri (Faz 8 / D1-D5).
 *
 * Üç şey sınanır:
 *   1. Şifreleme gerçekten çalışıyor mu, kurcalanan veri yakalanıyor mu?
 *   2. Yeni tablolar kiracı sınırına tabi mi? (bildirim, kuyruk, kural)
 *   3. Bildirim ve kural tanımları tutarlı mı?
 */

let a: Kiraci;
let b: Kiraci;

beforeAll(async () => {
  ({ a, b } = await kiraciCifti());
  // Şifreleme AUTH_SECRET'a bağlıdır; test ortamında tanımlı olmayabilir.
  process.env.AUTH_SECRET ??= "test-icin-gecici-sir-degeri-1234567890";
});

afterAll(async () => {
  await temizle(a, b);
  await baglantiyiKapat();
});

describe("Şifreleme (D1/D3 — posta parolaları)", () => {
  it("şifrelenen metin geri çözülür", () => {
    const sifreli = sifrele("gizli-posta-parolasi");
    expect(sifreli).not.toBeNull();
    expect(sifreli).not.toContain("gizli-posta-parolasi");
    expect(coz(sifreli)).toBe("gizli-posta-parolasi");
  });

  it("aynı metin her seferinde FARKLI şifreli metin üretir", () => {
    // Rastgele IV kullanılmasaydı aynı parolaya sahip iki kiracı
    // veritabanında aynı değeri taşır, bu da bilgi sızdırırdı.
    const bir = sifrele("aynidegersifre");
    const iki = sifrele("aynidegersifre");
    expect(bir).not.toBe(iki);
    expect(coz(bir)).toBe(coz(iki));
  });

  it("kurcalanmış şifreli metin çözülmez (GCM bütünlük)", () => {
    const sifreli = sifrele("dokunulmaz")!;
    const parcalar = sifreli.split(":");
    // Son bölümün (şifreli veri) bir karakterini değiştir.
    const bozuk = [
      parcalar[0],
      parcalar[1],
      parcalar[2],
      parcalar[3].slice(0, -2) + (parcalar[3].endsWith("A") ? "B=" : "A="),
    ].join(":");

    expect(coz(bozuk)).toBeNull();
  });

  it("boş ve geçersiz girdiler hata FIRLATMAZ", () => {
    expect(sifrele(null)).toBeNull();
    expect(sifrele("")).toBeNull();
    expect(coz(null)).toBeNull();
    expect(coz("bozuk-bicim")).toBeNull();
    expect(coz("v9:a:b:c")).toBeNull();
  });

  it("maskeleme parolayı sızdırmaz", () => {
    const sifreli = sifrele("cok-gizli")!;
    expect(maskele(sifreli)).toBe("••••••••");
    expect(maskele(null)).toBe("");
  });
});

describe("Bildirimler kiracı ve kullanıcı sınırına tabi (D5)", () => {
  it("A, B'nin bildirimini göremez", async () => {
    await yonetim.bildirim.create({
      data: {
        tenantId: b.id,
        kullaniciId: b.kullaniciId,
        tur: "gorev.atandi",
        baslik: "B'nin bildirimi",
      },
    });

    const aGorunum = await a.db.bildirim.findMany({});
    expect(aGorunum.some((x) => x.baslik === "B'nin bildirimi")).toBe(false);
  });

  it("A, B kiracısı adına bildirim yazamaz (RLS WITH CHECK)", async () => {
    await expect(
      a.db.bildirim.create({
        data: {
          tenantId: b.id,
          kullaniciId: b.kullaniciId,
          tur: "gorev.atandi",
          baslik: "Sızıntı",
        },
      })
    ).rejects.toThrow();
  });

  it("okundu damgası saklanır", async () => {
    const bildirim = await yonetim.bildirim.create({
      data: {
        tenantId: a.id,
        kullaniciId: a.kullaniciId,
        tur: "otomasyon",
        baslik: "Okunacak",
      },
    });
    expect(bildirim.okundu).toBeNull();

    const sonra = await yonetim.bildirim.update({
      where: { id: bildirim.id },
      data: { okundu: new Date() },
    });
    expect(sonra.okundu).not.toBeNull();
  });

  it("tercih kaydı yoksa varsayılan geçerlidir (satır zorunlu değil)", async () => {
    const tercih = await yonetim.bildirimTercihi.findFirst({
      where: { kullaniciId: a.kullaniciId, tur: "gorev.atandi" },
    });
    // Kayıt olmaması normaldir; katman `?? true` ile varsayılanı uygular.
    expect(tercih).toBeNull();
  });
});

describe("E-posta kuyruğu ve ayarı (D1)", () => {
  it("kuyruk kiracı sınırına tabidir", async () => {
    await yonetim.epostaKuyrugu.create({
      data: { tenantId: b.id, alici: "b@test.local", konu: "B'nin postası", govde: "..." },
    });

    const aGorunum = await a.db.epostaKuyrugu.findMany({});
    expect(aGorunum.some((k) => k.konu === "B'nin postası")).toBe(false);
  });

  it("parola veritabanında AÇIK saklanmaz", async () => {
    const duzParola = "cok-gizli-smtp-parolasi";
    await yonetim.epostaAyari.create({
      data: {
        tenantId: a.id,
        smtpHost: "smtp.test.local",
        smtpKullanici: "kullanici",
        smtpParola: sifrele(duzParola),
        aktif: true,
      },
    });

    const satir = await yonetim.epostaAyari.findFirst({ where: { tenantId: a.id } });
    expect(satir?.smtpParola).not.toBeNull();
    expect(satir?.smtpParola).not.toContain(duzParola);
    expect(JSON.stringify(satir)).not.toContain(duzParola);
    // Uygulama katmanı çözebilmeli.
    expect(coz(satir!.smtpParola)).toBe(duzParola);
  });

  it("her kiracının kendi ayarı vardır (tenantId birincil anahtar)", async () => {
    await yonetim.epostaAyari.create({
      data: { tenantId: b.id, smtpHost: "smtp.b.local", aktif: false },
    });

    const aAyar = await a.db.epostaAyari.findFirst({});
    expect(aAyar?.smtpHost).toBe("smtp.test.local");
    expect(aAyar?.tenantId).toBe(a.id);
  });
});

describe("İş akışı kuralları (D2)", () => {
  it("kural kiracıya özeldir, aynı ad iki kiracıda kullanılabilir", async () => {
    const aKural = await yonetim.isAkisi.create({
      data: {
        tenantId: a.id,
        ad: "Bekleyen fırsatlar",
        tetikleyici: "firsat.beklemede",
        kosullar: { gun: 7 },
        eylemler: [{ tur: "bildirim" }],
      },
    });
    const bKural = await yonetim.isAkisi.create({
      data: {
        tenantId: b.id,
        ad: "Bekleyen fırsatlar",
        tetikleyici: "firsat.beklemede",
        kosullar: { gun: 3 },
        eylemler: [{ tur: "bildirim" }],
      },
    });

    expect(aKural.id).not.toBe(bKural.id);

    const aGorunum = await a.db.isAkisi.findMany({});
    expect(aGorunum).toHaveLength(1);
    expect(aGorunum[0].id).toBe(aKural.id);

    // Aynı kiracıda aynı ad ikinci kez kullanılamaz.
    await expect(
      yonetim.isAkisi.create({
        data: {
          tenantId: a.id,
          ad: "Bekleyen fırsatlar",
          tetikleyici: "gorev.gecikti",
          eylemler: [],
        },
      })
    ).rejects.toThrow();
  });

  it("kural silinince çalışma kayıtları da silinir (cascade)", async () => {
    const kural = await yonetim.isAkisi.create({
      data: {
        tenantId: a.id,
        ad: "Silinecek kural",
        tetikleyici: "gorev.gecikti",
        eylemler: [{ tur: "bildirim" }],
      },
    });
    await yonetim.isAkisiCalismasi.create({
      data: { tenantId: a.id, isAkisiId: kural.id, sonuc: "basarili", ozet: "test" },
    });

    await yonetim.isAkisi.delete({ where: { id: kural.id } });
    expect(await yonetim.isAkisiCalismasi.count({ where: { isAkisiId: kural.id } })).toBe(0);
  });

  it("her tetikleyicinin etiketi ve açıklaması var", () => {
    expect(TETIKLEYICILER.length).toBeGreaterThanOrEqual(4);
    for (const t of TETIKLEYICILER) {
      expect(t.etiket.length).toBeGreaterThan(0);
      expect(t.aciklama.length).toBeGreaterThan(0);
      // Anahtar "<modül>.<durum>" biçiminde olmalı.
      expect(t.deger).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
    }
    expect(EYLEMLER.map((e) => e.deger)).toEqual(["bildirim", "gorev"]);
  });
});

describe("Faz 8 yetkileri ve paket modülleri", () => {
  it("otomasyon ve e-posta ayarı kuruluş yöneticisine aittir", () => {
    expect(ROL_IZINLERI[ROL.tenantAdmin]).toContain(IZIN.otomasyonYonet);
    expect(ROL_IZINLERI[ROL.tenantAdmin]).toContain(IZIN.epostaAyarYonet);
    // Bir kural bütün ekibe e-posta yollar; üye tanımlayamamalı.
    expect(ROL_IZINLERI[ROL.uye]).not.toContain(IZIN.otomasyonYonet);
    expect(ROL_IZINLERI[ROL.uye]).not.toContain(IZIN.epostaAyarYonet);
  });

  it("takvimi herkes görür, salt okunur dahil", () => {
    expect(ROL_IZINLERI[ROL.saltOkunur]).toContain(IZIN.takvimGoruntule);
    expect(ROL_IZINLERI[ROL.uye]).toContain(IZIN.takvimGoruntule);
  });

  it("paket takvim ve otomasyonu kapatabilir", () => {
    const degerler = PAKET_MODULLERI.map((m) => m.deger);
    expect(degerler).toContain("takvim");
    expect(degerler).toContain("otomasyon");

    const kapali = new Set(["takvim", "otomasyon"]);
    expect(modulKapaliMi(IZIN.takvimGoruntule, kapali)).toBe(true);
    expect(modulKapaliMi(IZIN.otomasyonYonet, kapali)).toBe(true);
    // E-posta ayarı da "otomasyon." ön ekiyle tanımlı olduğu için düşer.
    expect(modulKapaliMi(IZIN.epostaAyarYonet, kapali)).toBe(true);
    expect(modulKapaliMi(IZIN.firmaGoruntule, kapali)).toBe(false);
  });
});
