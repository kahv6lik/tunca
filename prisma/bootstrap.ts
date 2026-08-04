/**
 * Üretim ilk kurulum betiği.
 * Sahte firma verisi ÜRETMEZ — yalnızca ortam değişkenlerinden
 * bir yönetici kullanıcısı oluşturur (yoksa).
 *
 * Kullanılan ortam değişkenleri:
 *   ADMIN_EMAIL     (varsayılan: admin@gezegen.com)
 *   ADMIN_PASSWORD  (varsayılan: admin123 — MUTLAKA değiştirin)
 *   ADMIN_NAME      (varsayılan: Sistem Yöneticisi)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@gezegen.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const name = process.env.ADMIN_NAME || "Sistem Yöneticisi";

  const mevcut = await prisma.user.findUnique({ where: { email } });
  if (mevcut) {
    console.log(`ℹ️  Yönetici kullanıcısı zaten var: ${email}`);
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, name, password: hash, role: "admin" },
  });
  console.log(`✅ Yönetici kullanıcısı oluşturuldu: ${email}`);
}

main()
  .catch((e) => {
    console.error("Bootstrap hatası:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
