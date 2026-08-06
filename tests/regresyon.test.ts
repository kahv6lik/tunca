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
  "src/lib/yetki.ts", // izin hesabı — kiraciIstemcisi kullanır
  "src/lib/denetim.ts", // denetim günlüğü — kiraciIstemcisi kullanır
  "src/lib/kiraci-ayar.ts", // kiracının kendi ayarları — kiraciIstemcisi kullanır
  "src/lib/platform-db.ts", // Faz 5: admin panel, yönetim bağlamı (tek kapı)
  "src/lib/davet-db.ts", // Faz 5: davet akışı, oturum öncesi (tek kapı)
];

/**
 * Yönetim bağlamı (`yonetimIstemcisi`) kiracı sınırını AŞAR. Uygulama kodunda
 * kullanılmasına izin verilen dosyalar bunlardır ve her biri kendi içinde
 * yetki kontrolü yapar. Liste büyüyorsa durup düşünmek gerekir.
 */
const YONETIM_BAGLAMI_IZINLI = [
  "src/lib/rls.ts", // bağlamı tanımlayan dosya
  "src/lib/platform-db.ts",
  "src/lib/davet-db.ts",
];

describe("Veri erişimi kiracı katmanından geçiyor", () => {
  it("izinli dosyalar dışında doğrudan prisma kullanılmıyor", () => {
    const ihlaller: string[] = [];

    for (const dosya of KAYNAK_DOSYALAR) {
      if (IZINLI.includes(dosya)) continue;
      const icerik = readFileSync(dosya, "utf8");

      // Hem "@/lib/db" hem de src/lib içinden göreli "./db" yakalanır.
      if (/from ["'](@\/lib\/db|\.\/db|\.\.\/lib\/db)["']/.test(icerik)) {
        ihlaller.push(`${dosya}: Prisma istemcisi doğrudan import ediliyor`);
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

describe("Platform katmanı kiracı sınırını dar bir kapıdan aşıyor (Faz 5)", () => {
  it("yönetim bağlamı yalnızca izinli lib dosyalarında kullanılıyor", () => {
    const ihlaller = KAYNAK_DOSYALAR.filter(
      (d) =>
        !YONETIM_BAGLAMI_IZINLI.includes(d) &&
        /\byonetimIstemcisi\s*\(/.test(readFileSync(d, "utf8"))
    );

    expect(
      ihlaller,
      "Yönetim bağlamı kiracı sınırını aşar; yalnızca platform-db.ts ve\n" +
        "davet-db.ts üzerinden kullanılmalıdır.\nİhlaller:\n" + ihlaller.join("\n")
    ).toEqual([]);
  });

  it("admin panelinin her sayfası platform kapısından geçiyor", () => {
    const adminSayfalari = KAYNAK_DOSYALAR.filter(
      (d) => d.startsWith("src/app/admin/") && d.endsWith("page.tsx")
    );
    expect(adminSayfalari.length).toBeGreaterThanOrEqual(4);

    const ihlaller = adminSayfalari.filter(
      (d) => !readFileSync(d, "utf8").includes("@/lib/platform-db")
    );
    expect(ihlaller, "İhlaller:\n" + ihlaller.join("\n")).toEqual([]);
  });

  it("admin action'larının tamamı platform kapısını çağırıyor", () => {
    const icerik = readFileSync("src/app/admin/actions.ts", "utf8");
    const actionlar = [...icerik.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
    expect(actionlar.length).toBeGreaterThanOrEqual(10);

    // Her action gövdesi getPlatformDb ya da platformOturumu çağırmalı.
    // Tek istisna impersonationBitir'dir: o bağlamda oturum artık
    // platform_admin değildir, gerekçesi platform-db.ts içinde yazılıdır.
    const govdeler = icerik.split(/export async function /).slice(1);
    const ihlaller = govdeler
      .filter((g) => !/(getPlatformDb|platformOturumu|impersonatorOku)\(/.test(g))
      .map((g) => g.split("(")[0]);

    expect(ihlaller, "Platform kapısını çağırmayan action'lar:\n" + ihlaller.join("\n")).toEqual(
      []
    );
  });

  it("paket kısıtı izin hesabının içinde uygulanıyor", () => {
    // Paketi kapalı bir modülün izinleri `etkinIzinler()` içinde düşürülür;
    // böylece bütün sayfa ve action korumaları paketi otomatik uygular.
    const icerik = readFileSync("src/lib/yetki.ts", "utf8");
    expect(icerik).toContain("kapaliModulIzinleri");
    expect(icerik).toContain("modulKapaliMi");
  });

  it("davet sayfası ve action'ı yalnızca davet katmanını kullanıyor", () => {
    for (const dosya of ["src/app/davet/actions.ts", "src/app/davet/[token]/page.tsx"]) {
      const icerik = readFileSync(dosya, "utf8");
      expect(icerik).toContain("@/lib/davet-db");
      expect(icerik).not.toMatch(/from ["']@\/lib\/db["']/);
    }
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

    /**
     * Tablo listesi ŞEMADAN türetilir, elle yazılmaz. Elle yazılan bir listeye
     * yeni model eklemeyi unutmak, o tabloyu sessizce RLS'siz bırakırdı —
     * yani kiracı sınırındaki ikinci savunma hattı yalnızca o tablo için
     * kapalı olurdu ve kimse fark etmezdi.
     */
    const sema = readFileSync("prisma/schema.prisma", "utf8");
    const modeller = [...sema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);

    // Plan bilinçli olarak kiracıya ait değildir (platform geneli); yine de
    // RLS'i vardır, o yüzden listeden çıkarılmaz.
    expect(modeller.length).toBeGreaterThanOrEqual(12);

    for (const tablo of modeller) {
      expect(hepsi, `${tablo}: RLS açılmamış`).toContain(
        `ALTER TABLE "${tablo}" ENABLE ROW LEVEL SECURITY`
      );
      expect(hepsi, `${tablo}: FORCE eksik`).toContain(
        `ALTER TABLE "${tablo}" FORCE ROW LEVEL SECURITY`
      );
    }
  });
});


describe("Yetkilendirme her yazma yolunda zorunlu (Faz 4)", () => {
  const ACTION_DOSYALARI = KAYNAK_DOSYALAR.filter(
    (d) => d.startsWith("src/app/(app)/") && d.endsWith("actions.ts")
  );

  it("veri yazan her action yetki kontrolü yapıyor", () => {
    const ihlaller: string[] = [];

    for (const dosya of ACTION_DOSYALARI) {
      const icerik = readFileSync(dosya, "utf8");

      // Yazma yapan action'lar: tenantOlustur / tenantGuncelle / tenantSil
      const yaziyor = /(tenantOlustur|tenantGuncelle|tenantSil)\(/.test(icerik);
      if (!yaziyor) continue;

      if (!/yetkiVarMi|yetkiZorunlu|yetkiKontrolu/.test(icerik)) {
        ihlaller.push(`${dosya}: veri yazıyor ama yetki kontrolü yok`);
      }

      /**
       * YAZAN HER ACTION kendi içinde yetki kontrolü yapmalı.
       *
       * Kontrol action BAZINDA yapılır, yazma çağrısı bazında değil: tek bir
       * action birden çok satır yazabilir (ör. aday dönüşümü firma + kişi +
       * fırsat açar, teklif kaydı kalemlerini yazar) ve bunlar tek bir yetki
       * kararına bağlıdır. Çağrı sayısını saymak bu meşru durumları ihlal
       * sayardı; asıl kural "yetkisiz bir çağrıyla yazma yapılamaz"dır.
       */
      const govdeler = icerik.split(/export async function /).slice(1);
      for (const govde of govdeler) {
        const ad = govde.split("(")[0];
        const yazar = /(tenantOlustur|tenantGuncelle|tenantSil)\(/.test(govde);
        const kontrol = /(yetkiVarMi|yetkiZorunlu|yetkiKontrolu)\(/.test(govde);
        if (yazar && !kontrol) {
          ihlaller.push(`${dosya}: ${ad}() yetki kontrolü yapmadan veri yazıyor`);
        }
      }
    }

    expect(ihlaller, "İhlaller:\n" + ihlaller.join("\n")).toEqual([]);
  });

  it("veri yazan her action denetim kaydı bırakıyor", () => {
    const ihlaller: string[] = [];

    for (const dosya of ACTION_DOSYALARI) {
      const icerik = readFileSync(dosya, "utf8");
      if (!/(tenantOlustur|tenantGuncelle|tenantSil)\(/.test(icerik)) continue;

      if (!icerik.includes("denetimYaz")) {
        ihlaller.push(`${dosya}: veri yazıyor ama denetim kaydı yok`);
      }
    }

    expect(ihlaller, "İhlaller:\n" + ihlaller.join("\n")).toEqual([]);
  });

  it("yetki gerektiren sayfalar kapıyı veri okumadan önce koyuyor", () => {
    const ihlaller: string[] = [];
    const SAYFALAR = KAYNAK_DOSYALAR.filter(
      (d) => d.startsWith("src/app/(app)/") && d.endsWith("page.tsx")
    );

    for (const dosya of SAYFALAR) {
      const icerik = readFileSync(dosya, "utf8");
      if (!icerik.includes("getTenantDb")) continue;

      // İki geçerli kalıp var:
      //   1. `yetkiGerektir` — tek modüllü sayfalar (firmalar, raporlar…)
      //   2. `yetkiVarMi` ile bölüm bölüm kontrol — Genel Bakış gibi birden
      //      çok modülü toplayan sayfalar; kullanıcı yalnızca yetkili olduğu
      //      bölümleri görür ve yetkisiz modülün sorgusu hiç çalışmaz.
      const kapili = icerik.includes("yetkiGerektir");
      const bolumluk = icerik.includes("yetkiVarMi");

      if (!kapili && !bolumluk) {
        ihlaller.push(`${dosya}: veri okuyor ama yetki kontrolü yok`);
        continue;
      }

      // Tek kapılı sayfalarda kapı, veri erişiminden ÖNCE gelmeli
      if (kapili) {
        const kapi = icerik.indexOf("yetkiGerektir");
        const veri = icerik.indexOf("await getTenantDb()");
        if (kapi > veri) {
          ihlaller.push(`${dosya}: yetki kapısı veri erişiminden SONRA geliyor`);
        }
      }
    }

    expect(ihlaller, "İhlaller:\n" + ihlaller.join("\n")).toEqual([]);
  });

  it("denetim günlüğünde UPDATE/DELETE politikası tanımlı değil", () => {
    const yollar = execSync("find prisma/migrations -name migration.sql", {
      encoding: "utf8",
    }).trim().split("\n");
    const hepsi = yollar.map((y) => readFileSync(y, "utf8")).join("\n");

    // Kiracı için yalnızca SELECT ve INSERT politikası olmalı; günlüğü
    // sonradan değiştirilebilir yapan bir politika eklenirse bu test kırılır.
    expect(hepsi).toContain('CREATE POLICY denetim_okuma ON "DenetimKaydi"');
    expect(hepsi).toContain('CREATE POLICY denetim_ekleme ON "DenetimKaydi"');
    expect(hepsi).not.toMatch(/CREATE POLICY denetim_\w+ ON "DenetimKaydi"\s+FOR (UPDATE|DELETE)/);
  });
});
