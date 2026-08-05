/**
 * Üretim ilk kurulum betiği.
 * Sahte firma verisi ÜRETMEZ — yalnızca bir kiracı ve o kiracıya bağlı
 * bir yönetici kullanıcısı oluşturur (yoksa).
 *
 * Kullanılan ortam değişkenleri:
 *   TENANT_NAME     (varsayılan: Gezegen Danışmanlık)
 *   TENANT_SLUG     (varsayılan: gezegen)  — giriş ekranındaki kiracı kodu
 *   ADMIN_EMAIL     (varsayılan: admin@gezegen.com)
 *   ADMIN_PASSWORD  (varsayılan: admin123 — MUTLAKA değiştirin)
 *   ADMIN_NAME      (varsayılan: Sistem Yöneticisi)
 */
import { PrismaClient } from "@prisma/client";
import { yonetimIstemcisi } from "../src/lib/rls";
import bcrypt from "bcryptjs";

// RLS yönetim bağlamı: kurulum betikleri kiracılar ötesi yazabilmelidir.
const temelIstemci = new PrismaClient();
const prisma = yonetimIstemcisi(temelIstemci) as unknown as PrismaClient;

async function main() {
  const tenantAd = process.env.TENANT_NAME || "Gezegen Danışmanlık";
  const tenantSlug = (process.env.TENANT_SLUG || "gezegen").toLowerCase();
  const email = (process.env.ADMIN_EMAIL || "admin@gezegen.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const name = process.env.ADMIN_NAME || "Sistem Yöneticisi";

  let tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { ad: tenantAd, slug: tenantSlug },
    });
    console.log(`✅ Kiracı oluşturuldu: ${tenantAd} (${tenantSlug})`);
  } else {
    console.log(`ℹ️  Kiracı zaten var: ${tenant.ad} (${tenant.slug})`);
  }

  const mevcut = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });
  if (mevcut) {
    console.log(`ℹ️  Yönetici kullanıcısı zaten var: ${email}`);
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { tenantId: tenant.id, email, name, password: hash, role: "admin" },
  });
  console.log(`✅ Yönetici kullanıcısı oluşturuldu: ${email}`);
}

main()
  .catch((e) => {
    console.error("Bootstrap hatası:", e);
    process.exit(1);
  })
  .finally(async () => {
    await temelIstemci.$disconnect();
  });
