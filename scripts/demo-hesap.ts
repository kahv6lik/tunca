/**
 * Demo yönetici hesabını garantiye alır — VERİYİ SİLMEZ.
 *
 *   npm run demo:kur
 *
 * Geliştirme sırasında giriş yapamaz duruma düşerseniz bu komut yeterlidir:
 * kiracı yoksa oluşturur, demo kullanıcı yoksa oluşturur, varsa şifresini ve
 * rolünü sıfırlar. Firmalarınıza, yatırımlarınıza vb. dokunmaz.
 *
 * Ortam değişkenleriyle değiştirilebilir:
 *   DEMO_EMAIL     (varsayılan: admin@gezegen.com)
 *   DEMO_PASSWORD  (varsayılan: admin123)
 *   DEMO_TENANT    (varsayılan: gezegen)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.DEMO_EMAIL || "admin@gezegen.com").toLowerCase();
  const sifre = process.env.DEMO_PASSWORD || "admin123";
  const slug = (process.env.DEMO_TENANT || "gezegen").toLowerCase();

  let tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { ad: "Gezegen Danışmanlık", slug, durum: "aktif" },
    });
    console.log(`✅ Kiracı oluşturuldu: ${tenant.ad} (${slug})`);
  } else if (tenant.durum !== "aktif") {
    tenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { durum: "aktif" },
    });
    console.log(`✅ Kiracı yeniden aktifleştirildi: ${tenant.ad}`);
  } else {
    console.log(`ℹ️  Kiracı mevcut ve aktif: ${tenant.ad} (${slug})`);
  }

  const hash = await bcrypt.hash(sifre, 10);
  const mevcut = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });

  if (mevcut) {
    await prisma.user.update({
      where: { id: mevcut.id },
      data: { password: hash, role: "admin" },
    });
    console.log(`✅ Demo hesabın şifresi ve yönetici rolü sıfırlandı: ${email}`);
  } else {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        name: "Sistem Yöneticisi",
        password: hash,
        role: "admin",
      },
    });
    console.log(`✅ Demo yönetici hesabı oluşturuldu: ${email}`);
  }

  const firmaSayisi = await prisma.firma.count({ where: { tenantId: tenant.id } });
  console.log(`\nGiriş: ${email} / ${sifre}`);
  console.log(`Kiracı: ${tenant.ad} · ${firmaSayisi} firma (veriye dokunulmadı)`);
}

main()
  .catch((e) => {
    console.error("Hata:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
