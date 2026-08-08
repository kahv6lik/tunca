import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { kiraciIstemcisi, yonetimIstemcisi } from "../src/lib/rls";

/**
 * Test veri fabrikası.
 *
 * Her test dosyası KENDİ kiracı çiftini üretir (rastgele slug ile). Böylece
 * dosyalar aynı veritabanını paylaşsa bile birbirlerinin verisini görmez ve
 * bir testin sildiği kayıt başka bir testi düşürmez.
 */

export const temel = new PrismaClient();
export const yonetim = yonetimIstemcisi(temel);

export type Kiraci = {
  id: string;
  slug: string;
  ad: string;
  firmaId: string;
  yatirimId: string;
  egitimId: string;
  hizmetId: string;
  kullaniciId: string;
  email: string;
  db: ReturnType<typeof kiraciIstemcisi>;
};

async function kiraciKur(etiket: string): Promise<Kiraci> {
  const slug = `${etiket}-${randomUUID().slice(0, 8)}`;
  const tenant = await yonetim.tenant.create({
    data: { ad: `Test ${etiket}`, slug, durum: "aktif" },
  });

  const email = `${slug}@test.local`;
  const kullanici = await yonetim.user.create({
    data: {
      tenantId: tenant.id,
      email,
      name: `Test Kullanıcı ${etiket}`,
      password: "$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttest",
      role: "admin",
    },
  });

  const firma = await yonetim.firma.create({
    data: {
      tenantId: tenant.id,
      ad: `Firma ${slug}`,
      firmaNo: "A0001",
      vergiNo: `VN-${slug}`,
      sektor: "Tekstil",
      il: "Bursa",
      durum: "aktif",
    },
  });

  const yatirim = await yonetim.yatirimDestegi.create({
    data: {
      tenantId: tenant.id,
      firmaId: firma.id,
      baslik: `Yatirim ${slug}`,
      tur: "Hibe",
      tutar: 100_000,
      paraBirimi: "TRY",
      durum: "onaylandi",
    },
  });

  const egitim = await yonetim.egitim.create({
    data: {
      tenantId: tenant.id,
      firmaId: firma.id,
      baslik: `Egitim ${slug}`,
      sureSaat: 8,
      katilimci: 20,
      durum: "tamamlandi",
    },
  });

  const hizmet = await yonetim.hizmet.create({
    data: {
      tenantId: tenant.id,
      firmaId: firma.id,
      baslik: `Hizmet ${slug}`,
      tur: "Denetim",
      durum: "devam",
    },
  });

  return {
    id: tenant.id,
    slug,
    ad: tenant.ad,
    firmaId: firma.id,
    yatirimId: yatirim.id,
    egitimId: egitim.id,
    hizmetId: hizmet.id,
    kullaniciId: kullanici.id,
    email,
    db: kiraciIstemcisi(tenant.id, temel),
  };
}

/** İzolasyon testleri için iki bağımsız kiracı üretir. */
export async function kiraciCifti(): Promise<{ a: Kiraci; b: Kiraci }> {
  const a = await kiraciKur("a");
  const b = await kiraciKur("b");
  return { a, b };
}

/** Test sonunda kiracıları ve tüm kayıtlarını siler (cascade). */
export async function temizle(...kiracilar: Kiraci[]) {
  for (const k of kiracilar) {
    await yonetim.tenant.deleteMany({ where: { id: k.id } });
  }
}

export async function baglantiyiKapat() {
  await temel.$disconnect();
}
