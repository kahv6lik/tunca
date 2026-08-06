import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { kiraciCifti, temizle, temel, yonetim, baglantiyiKapat, type Kiraci } from "./fixture";
import { kimlikIstemcisi } from "../src/lib/rls";

/**
 * PostgreSQL Row-Level Security testleri (Faz 3 / A5).
 *
 * İzolasyon testleri uygulama katmanını ölçer. Bu dosya bir alt katmanı
 * ölçer: uygulama katmanı tamamen atlansa bile veritabanının kendisi doğru
 * satırı koruyor mu?
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

describe("Bağlam yoksa veri yok", () => {
  it("Prisma istemcisi bağlamsız hiçbir satır göremez", async () => {
    expect(await temel.firma.count()).toBe(0);
    expect(await temel.yatirimDestegi.count()).toBe(0);
    expect(await temel.egitim.count()).toBe(0);
    expect(await temel.hizmet.count()).toBe(0);
    expect(await temel.user.count()).toBe(0);
    expect(await temel.tenant.count()).toBe(0);
  });

  it("ham SQL de sıfır satır döner", async () => {
    const sonuc = await temel.$queryRawUnsafe<{ n: bigint }[]>(
      'SELECT count(*)::bigint AS n FROM "Firma"'
    );
    expect(Number(sonuc[0].n)).toBe(0);
  });

  it("bağlamsız yazma da işlemez", async () => {
    const sonuc = await temel.firma.updateMany({
      where: { id: a.firmaId },
      data: { ad: "RLS ATLANDI" },
    });
    expect(sonuc.count).toBe(0);

    const kayit = await yonetim.firma.findFirst({ where: { id: a.firmaId } });
    expect(kayit?.ad).not.toBe("RLS ATLANDI");
  });
});

describe("RLS veritabanı düzeyinde açık", () => {
  it("tüm kiracı tablolarında RLS ve FORCE etkin", async () => {
    const satirlar = await temel.$queryRawUnsafe<
      { relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]
    >(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname IN ('Tenant','User','Firma','YatirimDestegi','Egitim','Hizmet')
        AND relnamespace = 'test'::regnamespace
    `);

    expect(satirlar).toHaveLength(6);
    for (const s of satirlar) {
      expect(s.relrowsecurity, `${s.relname}: RLS kapalı`).toBe(true);
      // FORCE olmadan tablo sahibi politikalardan muaf olurdu — uygulama rolü
      // tabloların sahibi olduğu için bu ayar korumanın ta kendisidir.
      expect(s.relforcerowsecurity, `${s.relname}: FORCE kapalı`).toBe(true);
    }
  });

  it("uygulama rolü RLS'i atlayamaz", async () => {
    const rol = await temel.$queryRawUnsafe<{ rolsuper: boolean; rolbypassrls: boolean }[]>(
      "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
    );
    expect(rol[0].rolsuper, "uygulama rolü superuser olmamalı").toBe(false);
    expect(rol[0].rolbypassrls, "uygulama rolünde BYPASSRLS olmamalı").toBe(false);
  });
});

describe("Kimlik doğrulama bağlamının sınırları", () => {
  it("kullanıcı ve kiracı okunabilir (giriş için gerekli)", async () => {
    const kimlik = kimlikIstemcisi(temel);
    expect(await kimlik.user.count()).toBeGreaterThan(0);
    expect(await kimlik.tenant.count()).toBeGreaterThan(0);
  });

  it("iş verisi görünmez", async () => {
    const kimlik = kimlikIstemcisi(temel);
    expect(await kimlik.firma.count()).toBe(0);
    expect(await kimlik.yatirimDestegi.count()).toBe(0);
    expect(await kimlik.egitim.count()).toBe(0);
    expect(await kimlik.hizmet.count()).toBe(0);
  });

  it("yazma yapılamaz", async () => {
    const kimlik = kimlikIstemcisi(temel);
    const sonuc = await kimlik.user.updateMany({
      where: { id: a.kullaniciId },
      data: { name: "SIZINTI" },
    });
    expect(sonuc.count).toBe(0);

    const kayit = await yonetim.user.findFirst({ where: { id: a.kullaniciId } });
    expect(kayit?.name).not.toBe("SIZINTI");
  });
});

describe("Bağlam sızıntısı", () => {
  it("bir sorgunun bağlamı sonraki sorguya taşınmaz", async () => {
    // A bağlamında bir sorgu çalıştır…
    expect(await a.db.firma.count()).toBe(1);
    // …ardından bağlamsız istemci hâlâ hiçbir şey görmemeli.
    // (set_config'in üçüncü argümanı `true` olduğu için ayar işlemle sınırlıdır;
    //  aksi halde havuzdan gelen bağlantı bir sonraki isteğe bağlam sızdırırdı.)
    expect(await temel.firma.count()).toBe(0);
  });

  it("kiracılar arası geçişte bağlam karışmaz", async () => {
    expect(await a.db.firma.count()).toBe(1);
    expect(await b.db.firma.count()).toBe(1);
    const aFirmalar = await a.db.firma.findMany();
    expect(aFirmalar[0].tenantId).toBe(a.id);
    const bFirmalar = await b.db.firma.findMany();
    expect(bFirmalar[0].tenantId).toBe(b.id);
  });
});
