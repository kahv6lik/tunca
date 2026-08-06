/**
 * Platform yöneticisi oluşturur (Faz 5) — ÜRETİM İÇİN.
 *
 *   npm run platform:kur
 *
 * Admin panele (`/admin`) yalnızca `platform_admin` rolündeki bir kullanıcı
 * girebilir ve bu rol arayüzden verilemez — ilk platform yöneticisi bu betikle
 * oluşturulur. Sonraki yöneticiler admin panelden atanabilir.
 *
 * Platform yöneticisi de bir `User`'dır, dolayısıyla bir kiracıya bağlıdır.
 * Bunun için ayrı bir "platform" kiracısı kullanılır; içinde müşteri verisi
 * tutulmaz.
 *
 * Ortam değişkenleri:
 *   PLATFORM_EMAIL     (varsayılan: platform@gezegen.com)
 *   PLATFORM_PASSWORD  (varsayılan: yok — ZORUNLU)
 *   PLATFORM_NAME      (varsayılan: Platform Yöneticisi)
 *   PLATFORM_TENANT    (varsayılan: platform)
 *
 * Örnek:
 *   PLATFORM_EMAIL=ben@sirket.com PLATFORM_PASSWORD='...' npm run platform:kur
 *
 * Var olan bir hesap için çalıştırılırsa şifresini ve rolünü günceller —
 * yani parolanızı unuttuğunuzda da bu betik yeterlidir. Veriye dokunmaz.
 */
import { PrismaClient } from "@prisma/client";
import { yonetimIstemcisi } from "../src/lib/rls";
import bcrypt from "bcryptjs";

const temelIstemci = new PrismaClient();
const prisma = yonetimIstemcisi(temelIstemci) as unknown as PrismaClient;

async function main() {
  const email = (process.env.PLATFORM_EMAIL || "platform@gezegen.com").toLowerCase();
  const sifre = process.env.PLATFORM_PASSWORD;
  const ad = process.env.PLATFORM_NAME || "Platform Yöneticisi";
  const slug = (process.env.PLATFORM_TENANT || "platform").toLowerCase();

  if (!sifre || sifre.length < 8) {
    console.error(
      "❌ PLATFORM_PASSWORD tanımlı değil ya da 8 karakterden kısa.\n" +
        "   Örnek: PLATFORM_PASSWORD='guclu-bir-sifre' npm run platform:kur"
    );
    process.exit(1);
  }

  let tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { ad: "Platform", slug, durum: "aktif" },
    });
    console.log(`✅ Platform kiracısı oluşturuldu (${slug})`);
  }

  const hash = await bcrypt.hash(sifre, 10);
  const mevcut = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });

  if (mevcut) {
    await prisma.user.update({
      where: { id: mevcut.id },
      data: { password: hash, role: "platform_admin", durum: "aktif" },
    });
    console.log(`✅ Platform yöneticisinin şifresi ve rolü güncellendi: ${email}`);
  } else {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        name: ad,
        password: hash,
        role: "platform_admin",
      },
    });
    console.log(`✅ Platform yöneticisi oluşturuldu: ${email}`);
  }

  const kiraciSayisi = await prisma.tenant.count();
  console.log(`\nGiriş: ${email}`);
  console.log(`Panel: /admin  ·  Sistemde ${kiraciSayisi} kuruluş var.`);
}

main()
  .catch((e) => {
    console.error("Hata:", e);
    process.exit(1);
  })
  .finally(async () => {
    await temelIstemci.$disconnect();
  });
