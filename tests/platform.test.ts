import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { kiraciCifti, temizle, yonetim, temel, baglantiyiKapat, type Kiraci } from "./fixture";
import { kiraciIstemcisi, kimlikIstemcisi } from "../src/lib/rls";
import { davetTokenUret, tokenOzeti } from "../src/lib/davet";
import { PAKET_MODULLERI, modulKapaliMi } from "../src/lib/constants";

/**
 * Admin panel testleri (Faz 5 / B1-B7).
 *
 * Faz 5 kiracı izolasyonuna BİLİNÇLİ bir istisna ekliyor: platform yöneticisi
 * bütün kiracıları görür. Bu testler o istisnanın kapsamının gerçekten dar
 * olduğunu sınar:
 *
 *   - Yönetim bağlamı kiracılar ötesi okur (beklenen).
 *   - Kiracı bağlamı Plan'ı okur ama YAZAMAZ.
 *   - Kiracı bağlamı BAŞKA kiracının davetini göremez.
 *   - Davet token'ının kendisi veritabanında durmaz.
 *   - Paket limitleri ve modül kısıtları doğru hesaplanır.
 */

let a: Kiraci;
let b: Kiraci;
let planId: string;

beforeAll(async () => {
  ({ a, b } = await kiraciCifti());
  const plan = await yonetim.plan.create({
    data: {
      ad: `Test Paket ${randomUUID().slice(0, 8)}`,
      kullaniciLimiti: 2,
      firmaLimiti: 3,
      moduller: ["firma", "rapor"],
    },
  });
  planId = plan.id;
});

afterAll(async () => {
  await yonetim.plan.deleteMany({ where: { id: planId } });
  await temizle(a, b);
  await baglantiyiKapat();
});

describe("Platform bağlamı (B1)", () => {
  it("yönetim bağlamı bütün kiracıları görür", async () => {
    const hepsi = await yonetim.tenant.findMany({ where: { id: { in: [a.id, b.id] } } });
    expect(hepsi.map((t) => t.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("kiracı bağlamı yalnızca KENDİ kiracı satırını görür", async () => {
    const kendi = await a.db.tenant.findMany({ where: { id: { in: [a.id, b.id] } } });
    expect(kendi).toHaveLength(1);
    expect(kendi[0].id).toBe(a.id);
  });

  it("kiracı bağlamı başka bir kiracıyı güncelleyemez", async () => {
    const sonuc = await a.db.tenant.updateMany({
      where: { id: b.id },
      data: { ad: "Ele geçirildi" },
    });
    expect(sonuc.count).toBe(0);

    const b_ = await yonetim.tenant.findUnique({ where: { id: b.id } });
    expect(b_?.ad).toBe(b.ad);
  });
});

describe("Paketler (B4)", () => {
  it("kiracı kendi paketini okuyabilir — limitini bilmelidir", async () => {
    await yonetim.tenant.update({ where: { id: a.id }, data: { planId } });
    const kiraci = await a.db.tenant.findUnique({
      where: { id: a.id },
      include: { plan: true },
    });
    expect(kiraci?.plan?.firmaLimiti).toBe(3);
  });

  it("kiracı bağlamı paketi DEĞİŞTİREMEZ", async () => {
    const sonuc = await a.db.plan.updateMany({
      where: { id: planId },
      data: { firmaLimiti: 9999 },
    });
    expect(sonuc.count).toBe(0);

    const plan = await yonetim.plan.findUnique({ where: { id: planId } });
    expect(plan?.firmaLimiti).toBe(3);
  });

  it("paket silinince kiracı erişimsiz kalmaz (SetNull)", async () => {
    const gecici = await yonetim.plan.create({
      data: { ad: `Gecici ${randomUUID().slice(0, 8)}`, moduller: [] },
    });
    await yonetim.tenant.update({ where: { id: b.id }, data: { planId: gecici.id } });
    await yonetim.plan.delete({ where: { id: gecici.id } });

    const kiraci = await yonetim.tenant.findUnique({ where: { id: b.id } });
    expect(kiraci).not.toBeNull();
    expect(kiraci?.planId).toBeNull();
  });

  it("kapalı modülün izinleri düşer, açık modülünkiler kalır", () => {
    const acik = new Set(["firma", "rapor"]);
    const kapali = new Set(
      PAKET_MODULLERI.filter((m) => !acik.has(m.deger)).map((m) => m.deger)
    );

    expect(modulKapaliMi("firma.olustur", kapali)).toBe(false);
    expect(modulKapaliMi("rapor.goruntule", kapali)).toBe(false);
    expect(modulKapaliMi("yatirim.goruntule", kapali)).toBe(true);
    expect(modulKapaliMi("hizmet.sil", kapali)).toBe(true);

    // Paket kısıtı yönetim izinlerine dokunmaz.
    expect(modulKapaliMi("kullanici.yonet", kapali)).toBe(false);
    expect(modulKapaliMi("kiraci.yonet", kapali)).toBe(false);
  });
});

describe("Davetler (B3)", () => {
  it("token veritabanında saklanmaz, yalnızca sha256 özeti tutulur", async () => {
    const { token, ozet } = davetTokenUret();
    const davet = await yonetim.davet.create({
      data: {
        tenantId: a.id,
        email: "davetli@test.local",
        ad: "Davetli",
        rol: "uye",
        tokenOzeti: ozet,
        sonKullanma: new Date(Date.now() + 86_400_000),
        olusturanEmail: "platform@test.local",
      },
    });

    const satir = await yonetim.davet.findUnique({ where: { id: davet.id } });
    expect(satir?.tokenOzeti).toBe(ozet);
    expect(JSON.stringify(satir)).not.toContain(token);
    expect(ozet).toHaveLength(64);

    // Özet, aynı token için her zaman aynı; farklı token için farklı.
    expect(tokenOzeti(token)).toBe(ozet);
    expect(tokenOzeti(token + "x")).not.toBe(ozet);
  });

  it("bir kiracı BAŞKA kiracının davetini göremez", async () => {
    const { ozet } = davetTokenUret();
    await yonetim.davet.create({
      data: {
        tenantId: a.id,
        email: "gizli@test.local",
        ad: "Gizli",
        rol: "uye",
        tokenOzeti: ozet,
        sonKullanma: new Date(Date.now() + 86_400_000),
        olusturanEmail: "platform@test.local",
      },
    });

    const bGorunum = await b.db.davet.findMany({});
    expect(bGorunum.every((d) => d.tenantId === b.id)).toBe(true);
    expect(bGorunum.some((d) => d.email === "gizli@test.local")).toBe(false);
  });

  it("kimlik bağlamı daveti okuyabilir ama YAZAMAZ", async () => {
    const { ozet } = davetTokenUret();
    await yonetim.davet.create({
      data: {
        tenantId: a.id,
        email: "kimlik@test.local",
        ad: "Kimlik",
        rol: "uye",
        tokenOzeti: ozet,
        sonKullanma: new Date(Date.now() + 86_400_000),
        olusturanEmail: "platform@test.local",
      },
    });

    const kimlik = kimlikIstemcisi(temel);
    const okunan = await kimlik.davet.findUnique({ where: { tokenOzeti: ozet } });
    expect(okunan?.email).toBe("kimlik@test.local");

    await expect(
      kimlik.davet.update({ where: { tokenOzeti: ozet }, data: { rol: "tenant_admin" } })
    ).rejects.toThrow();
  });
});

describe("Kullanıcı yönetimi (B2)", () => {
  it("pasifleştirilen kullanıcının kaydı ve geçmişi silinmez", async () => {
    await yonetim.user.update({ where: { id: a.kullaniciId }, data: { durum: "pasif" } });
    const kullanici = await yonetim.user.findUnique({ where: { id: a.kullaniciId } });

    expect(kullanici).not.toBeNull();
    expect(kullanici?.durum).toBe("pasif");
    expect(kullanici?.email).toBe(a.email);

    await yonetim.user.update({ where: { id: a.kullaniciId }, data: { durum: "aktif" } });
  });

  it("aynı e-posta farklı kiracılarda ayrı hesap olabilir", async () => {
    const email = `ortak-${randomUUID().slice(0, 8)}@test.local`;
    const u1 = await yonetim.user.create({
      data: { tenantId: a.id, email, name: "A", password: "x", role: "uye" },
    });
    const u2 = await yonetim.user.create({
      data: { tenantId: b.id, email, name: "B", password: "x", role: "uye" },
    });

    expect(u1.id).not.toBe(u2.id);

    // Kiracı bağlamı yalnızca kendi hesabını görür.
    const aGorunum = await kiraciIstemcisi(a.id, temel).user.findMany({ where: { email } });
    expect(aGorunum).toHaveLength(1);
    expect(aGorunum[0].id).toBe(u1.id);
  });
});

describe("Kuruluş silme (B1)", () => {
  it("kiracı silinince tüm alt kayıtları da silinir (cascade)", async () => {
    const tenant = await yonetim.tenant.create({
      data: { ad: "Silinecek", slug: `sil-${randomUUID().slice(0, 8)}` },
    });
    const firma = await yonetim.firma.create({
      data: { tenantId: tenant.id, ad: "Firma", durum: "aktif" },
    });
    await yonetim.yatirimDestegi.create({
      data: { tenantId: tenant.id, firmaId: firma.id, baslik: "Y", tutar: 1 },
    });

    await yonetim.tenant.delete({ where: { id: tenant.id } });

    expect(await yonetim.firma.count({ where: { tenantId: tenant.id } })).toBe(0);
    expect(await yonetim.yatirimDestegi.count({ where: { tenantId: tenant.id } })).toBe(0);
  });
});
