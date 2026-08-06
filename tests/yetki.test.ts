import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { kiraciCifti, temizle, yonetim, baglantiyiKapat, type Kiraci } from "./fixture";
import {
  IZIN,
  ROL,
  ROL_IZINLERI,
  TUM_IZINLER,
  IZIN_ETIKET,
  IZIN_MODULLERI,
  rolNormalize,
} from "../src/lib/yetki-tanimlar";

/**
 * Yetkilendirme testleri (Faz 4 / A6, A7).
 *
 * İki ayrı soru sınanır:
 *   1. İzin matrisi doğru mu? (rol → izinler)
 *   2. Gruplar izinleri gerçekten ekliyor mu? (rol ∪ grup)
 *
 * NOT: `etkinIzinler()` oturum gerektirdiği için (server-only) burada doğrudan
 * çağrılamaz. Matris ve grup birleşimi mantığı burada; uçtan uca yetki
 * davranışı `kontrol:kimlik` betiğinde gerçek tarayıcıyla sınanır.
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

describe("İzin matrisi", () => {
  it("platform yöneticisi her şeyi yapabilir", () => {
    const izinler = ROL_IZINLERI[ROL.platformAdmin];
    expect(izinler).toEqual(TUM_IZINLER);
    expect(izinler).toContain(IZIN.kiraciYonet);
  });

  it("kuruluş yöneticisi kendi kiracısında her şeyi yapar, kiracı yönetemez", () => {
    const izinler = ROL_IZINLERI[ROL.tenantAdmin];
    expect(izinler).toContain(IZIN.firmaSil);
    expect(izinler).toContain(IZIN.kullaniciYonet);
    expect(izinler).toContain(IZIN.grupYonet);
    expect(izinler).toContain(IZIN.denetimGoruntule);
    // Platform düzeyi yetki YOK — kiracılar birbirini yönetemez.
    expect(izinler).not.toContain(IZIN.kiraciYonet);
  });

  it("üye iş verisini yönetir ama yönetim ekranlarına giremez", () => {
    const izinler = ROL_IZINLERI[ROL.uye];
    expect(izinler).toContain(IZIN.firmaOlustur);
    expect(izinler).toContain(IZIN.firmaDuzenle);
    expect(izinler).toContain(IZIN.firmaSil);
    expect(izinler).not.toContain(IZIN.kullaniciYonet);
    expect(izinler).not.toContain(IZIN.grupYonet);
    expect(izinler).not.toContain(IZIN.denetimGoruntule);
    expect(izinler).not.toContain(IZIN.kiraciYonet);
  });

  it("salt okunur HİÇBİR yazma iznine sahip değil", () => {
    const izinler = ROL_IZINLERI[ROL.saltOkunur];
    const yazmaIzinleri = izinler.filter((i) => !i.endsWith(".goruntule"));
    expect(yazmaIzinleri).toEqual([]);
    expect(izinler).toContain(IZIN.firmaGoruntule);
    expect(izinler).toContain(IZIN.raporGoruntule);
  });

  it("her rol tanımlı ve boş değil", () => {
    for (const rol of Object.values(ROL)) {
      expect(ROL_IZINLERI[rol], `${rol} rolü tanımsız`).toBeDefined();
      expect(ROL_IZINLERI[rol].length, `${rol} rolü boş`).toBeGreaterThan(0);
    }
  });

  it("her izin bir role atanmış (kimsenin kullanmadığı izin kalmasın)", () => {
    const atanmis = new Set(Object.values(ROL_IZINLERI).flat());
    for (const izin of TUM_IZINLER) {
      expect(atanmis.has(izin), `${izin} hiçbir role atanmamış`).toBe(true);
    }
  });

  it("her iznin Türkçe etiketi ve bir modülü var", () => {
    const modullerdeki = new Set(IZIN_MODULLERI.flatMap((m) => m.izinler));
    for (const izin of TUM_IZINLER) {
      expect(IZIN_ETIKET[izin], `${izin} için etiket yok`).toBeTruthy();
      // kiraci.yonet Faz 5'te admin panele ait; grup ekranında görünmez.
      if (izin !== IZIN.kiraciYonet) {
        expect(modullerdeki.has(izin), `${izin} hiçbir modülde yok`).toBe(true);
      }
    }
  });
});

describe("Eski rol adları", () => {
  it("Faz 4 öncesi 'admin' ve 'user' rolleri karşılanıyor", () => {
    // Migration bunları taşır; bu eşleme yine de bir emniyet kemeridir —
    // taşınmamış bir kayıt yüzünden kimse yetkisiz kalmasın.
    expect(rolNormalize("admin")).toBe(ROL.tenantAdmin);
    expect(rolNormalize("user")).toBe(ROL.uye);
  });

  it("yeni rol adları değişmeden geçer", () => {
    expect(rolNormalize(ROL.tenantAdmin)).toBe(ROL.tenantAdmin);
    expect(rolNormalize(ROL.saltOkunur)).toBe(ROL.saltOkunur);
  });
});

describe("Gruplar — izinleri toplu atama", () => {
  it("grup oluşturulabilir ve izinleri saklanır", async () => {
    const grup = await a.db.grup.create({
      data: {
        tenantId: a.id,
        ad: "Test Grubu",
        izinler: [IZIN.firmaOlustur, IZIN.egitimDuzenle],
      },
    });
    const okunan = await a.db.grup.findFirst({ where: { id: grup.id } });
    expect(okunan?.izinler).toEqual([IZIN.firmaOlustur, IZIN.egitimDuzenle]);
  });

  it("grup ve üyelik kiracı sınırına tabi", async () => {
    const grup = await a.db.grup.findFirst({ where: { ad: "Test Grubu" } });
    expect(grup).not.toBeNull();

    // B kiracısı A'nın grubunu göremez
    expect(await b.db.grup.findFirst({ where: { id: grup!.id } })).toBeNull();
    expect(await b.db.grup.count()).toBe(0);

    // Üyelik ekle
    await a.db.kullaniciGrup.create({
      data: { tenantId: a.id, userId: a.kullaniciId, grupId: grup!.id },
    });
    expect(await a.db.kullaniciGrup.count()).toBe(1);
    expect(await b.db.kullaniciGrup.count()).toBe(0);
  });

  it("etkin izin = rol ∪ grup (birleşim mantığı)", async () => {
    // Salt okunur bir kullanıcı + "firma.olustur" veren bir grup
    const rolIzinleri = new Set(ROL_IZINLERI[ROL.saltOkunur]);
    expect(rolIzinleri.has(IZIN.firmaOlustur)).toBe(false);

    const grup = await a.db.grup.findFirst({ where: { ad: "Test Grubu" } });
    const etkin = new Set([...rolIzinleri, ...(grup?.izinler ?? [])]);

    // Grup yetki EKLER
    expect(etkin.has(IZIN.firmaOlustur)).toBe(true);
    // Rolün izinleri korunur
    expect(etkin.has(IZIN.firmaGoruntule)).toBe(true);
    // Grup vermediği yetkiyi vermez
    expect(etkin.has(IZIN.firmaSil)).toBe(false);
  });

  it("grup silinince üyelikler de silinir (cascade)", async () => {
    const grup = await a.db.grup.findFirst({ where: { ad: "Test Grubu" } });
    await a.db.grup.deleteMany({ where: { id: grup!.id } });
    expect(await a.db.kullaniciGrup.count()).toBe(0);
  });
});
