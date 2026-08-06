import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * Regresyon koruması (Faz 3 / A5).
 *
 * İzolasyon testleri "bugün sızıntı var mı" sorusunu yanıtlar. Bu dosya farklı
 * bir soruyu yanıtlar: "yarın biri yanlışlıkla sızıntı ekleyebilir mi?"
 *
 * Kiracı katmanını atlayan bir kod yolu eklendiği anda bu testler kırmızıya
 * döner — kod incelemesinde gözden kaçsa bile.
 */

function dosyalar(desen: string): string[] {
  const cikti = execSync(`find src -type f \\( ${desen} \\)`, { encoding: "utf8" });
  return cikti.trim().split("\n").filter(Boolean);
}

const KAYNAK_DOSYALAR = dosyalar("-name '*.ts' -o -name '*.tsx'");

/**
 * `prisma`'yı doğrudan kullanmasına izin verilen dosyalar.
 *
 * Bu liste bilinçli olarak KISA tutulur. Buraya bir dosya eklemek, o dosyanın
 * kiracı sınırını kendi başına koruması gerektiği anlamına gelir — yani ayrıca
 * gözden geçirilmesi gereken bir karardır.
 */
const IZINLI = [
  "src/lib/db.ts", // Prisma istemcisinin kendisi
  "src/lib/rls.ts", // RLS bağlam katmanı
  "src/lib/tenant-db.ts", // kiracı kapsamlı erişim katmanı
];

describe("Veri erişimi kiracı katmanından geçiyor", () => {
  it("izinli dosyalar dışında doğrudan prisma kullanılmıyor", () => {
    const ihlaller: string[] = [];

    for (const dosya of KAYNAK_DOSYALAR) {
      if (IZINLI.includes(dosya)) continue;
      const icerik = readFileSync(dosya, "utf8");

      if (/from ["']@\/lib\/db["']/.test(icerik)) {
        ihlaller.push(`${dosya}: @/lib/db doğrudan import ediliyor`);
      }
      // `prisma.model.` kalıbı — yorum satırları dışında
      const satirlar = icerik.split("\n");
      satirlar.forEach((satir, i) => {
        const kirpik = satir.trim();
        if (kirpik.startsWith("//") || kirpik.startsWith("*")) return;
        if (/\bprisma\.[a-zA-Z]+\.(find|create|update|delete|count|aggregate|groupBy|upsert)/.test(satir)) {
          ihlaller.push(`${dosya}:${i + 1}: doğrudan prisma sorgusu`);
        }
      });
    }

    expect(
      ihlaller,
      "Veri erişimi src/lib/tenant-db.ts (veya rls.ts) üzerinden yapılmalıdır.\n" +
        "İhlaller:\n" + ihlaller.join("\n")
    ).toEqual([]);
  });

  it("giriş action'ı kimlik bağlamını kullanıyor", () => {
    const icerik = readFileSync("src/app/login/actions.ts", "utf8");
    // Giriş, oturum öncesi kiracılar ötesi okuma yapan tek yerdir; bunu
    // `kimlikIstemcisi` ile yapmalıdır (salt okuma, iş verisine erişimsiz).
    expect(icerik).toContain("kimlikIstemcisi");
    expect(icerik).not.toMatch(/from ["']@\/lib\/db["']/);
  });
});

describe("Sayfalar ve action'lar kiracı katmanını çağırıyor", () => {
  const SAYFA_VE_ACTIONLAR = KAYNAK_DOSYALAR.filter(
    (d) =>
      d.startsWith("src/app/(app)/") &&
      (d.endsWith("page.tsx") || d.endsWith("actions.ts"))
  );

  it("veri okuyan her sayfa/action getTenantDb veya yardımcılarını kullanıyor", () => {
    const ihlaller: string[] = [];

    for (const dosya of SAYFA_VE_ACTIONLAR) {
      const icerik = readFileSync(dosya, "utf8");
      const veriKullaniyor = /\bdb\.[a-zA-Z]+\.(find|create|update|delete|count|aggregate|groupBy)/.test(icerik);
      const yardimciKullaniyor = /(tenantOlustur|tenantGuncelle|tenantSil|sahiplikDogrula|firmaSahipligiDogrula)/.test(icerik);

      if (!veriKullaniyor && !yardimciKullaniyor) continue;

      if (!icerik.includes("@/lib/tenant-db")) {
        ihlaller.push(`${dosya}: veri erişimi var ama tenant-db import edilmemiş`);
      }
    }

    expect(ihlaller, "İhlaller:\n" + ihlaller.join("\n")).toEqual([]);
  });

  it("en az bir sayfa ve bir action taranmış olmalı (tarayıcı boşa düşmesin)", () => {
    // Bu test, dosya yollarının değişmesi sonucu taramanın sessizce
    // hiçbir dosyaya bakmadığı durumu yakalar.
    expect(SAYFA_VE_ACTIONLAR.some((d) => d.endsWith("page.tsx"))).toBe(true);
    expect(SAYFA_VE_ACTIONLAR.some((d) => d.endsWith("actions.ts"))).toBe(true);
    expect(SAYFA_VE_ACTIONLAR.length).toBeGreaterThanOrEqual(8);
  });
});

describe("Şema kuralları", () => {
  const sema = readFileSync("prisma/schema.prisma", "utf8");

  it("kiracıya ait tüm modellerde tenantId var", () => {
    const modeller = ["User", "Firma", "YatirimDestegi", "Egitim", "Hizmet"];
    for (const model of modeller) {
      const blok = sema.match(new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
      expect(blok, `${model} modeli bulunamadı`).not.toBe("");
      expect(blok, `${model} modelinde tenantId yok`).toMatch(/tenantId\s+String/);
    }
  });

  it("indekslerde tenantId ilk sütun", () => {
    /**
     * Belgelenmiş istisnalar — her biri bilinçli bir karardır:
     *
     *   @@index([durum])  → Tenant modeli; kiracının kendisi tenantId taşımaz.
     *   @@index([email])  → User modeli; giriş akışı kiracı bilinmeden e-postayla
     *                       arama yapar (kimlik doğrulama bağlamı). Bu indeks
     *                       olmadan her giriş tam tablo taraması yapardı.
     *
     * Yeni bir istisna eklemek isteyen, önce bunun neden gerekli olduğunu
     * buraya yazmalıdır.
     */
    const ISTISNALAR = ["@@index([durum])", "@@index([email])"];

    const indeksler = sema.match(/@@index\(\[[^\]]+\]\)/g) ?? [];
    for (const i of indeksler) {
      if (ISTISNALAR.includes(i)) continue;
      expect(i, `indeks tenantId ile başlamıyor: ${i}`).toMatch(/@@index\(\[tenantId/);
    }

    // İstisna listesi sessizce büyümesin.
    const istisnaSayisi = indeksler.filter((i) => ISTISNALAR.includes(i)).length;
    expect(istisnaSayisi, "belgelenmemiş istisna eklenmiş olabilir").toBeLessThanOrEqual(2);
  });

  it("PostgreSQL kullanılıyor", () => {
    expect(sema).toMatch(/provider\s*=\s*"postgresql"/);
  });
});

describe("RLS migration'ı yerinde", () => {
  it("politikalar migration dosyasında tanımlı", () => {
    const yollar = execSync("find prisma/migrations -name migration.sql", {
      encoding: "utf8",
    })
      .trim()
      .split("\n");
    const hepsi = yollar.map((y) => readFileSync(y, "utf8")).join("\n");

    for (const tablo of ["Tenant", "User", "Firma", "YatirimDestegi", "Egitim", "Hizmet"]) {
      expect(hepsi, `${tablo}: RLS açılmamış`).toContain(
        `ALTER TABLE "${tablo}" ENABLE ROW LEVEL SECURITY`
      );
      expect(hepsi, `${tablo}: FORCE eksik`).toContain(
        `ALTER TABLE "${tablo}" FORCE ROW LEVEL SECURITY`
      );
    }
  });
});
