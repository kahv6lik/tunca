import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { girisIstemcisi } from "./rls";
import {
  KILIT_ESIGI,
  IP_SAATLIK_SINIR,
  SIFIRLAMA_SAATLIK_SINIR,
  basarisizSonrasi,
  kilitliMi,
  kalanKilitDakika,
  cihazOzeti,
} from "./guvenlik-tanimlar";

/**
 * Giriş güvenliği — DÖRDÜNCÜ DAR KAPI (Faz 12 / F1-F4).
 *
 * Kiracı izolasyonunun bilinçli istisnalarından biridir. Diğer üçü gibi
 * (platform-db, davet-db, zamanlanmis) tek bir dosyada toplanmıştır ve
 * regresyon testi `girisIstemcisi`nin bu dosyanın dışında kullanılmadığını
 * sürekli denetler.
 *
 * NEDEN GEREKLİ: hız sınırlama sayacı, hesap kilidi, şifre sıfırlama isteği
 * ve oturum kaydı kimlik doğrulanmadan ÖNCE YAZILIR. `kimlikIstemcisi`
 * bilinçli olarak salt okumadır ve öyle kalmalıdır — o yüzden ayrı bir
 * bağlam açıldı. Bu bağlam iş verisine (firma, teklif, kişi…) erişemez;
 * yalnızca User, Tenant, Oturum, SifreSifirlama ve GirisDenemesi'ni görür.
 */

const db = () => girisIstemcisi();

export function tokenOzeti(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ── F4: Hız sınırlama ──────────────────────────────────────────────────────

export type GirisEngeli = { engel: true; mesaj: string } | { engel: false };

/**
 * Giriş denemesinden ÖNCE çalışır: IP saatlik sınırı aşmışsa dener bile.
 *
 * E-posta bazlı kilit burada DEĞİL, hesap bulunduktan sonra kontrol edilir;
 * aksi halde "bu e-posta kilitli" yanıtı hesabın varlığını sızdırırdı.
 */
export async function ipSinirlandiMi(ip: string | null): Promise<GirisEngeli> {
  if (!ip) return { engel: false };

  const birSaatOnce = new Date(Date.now() - 3_600_000);
  const sayi = await db().girisDenemesi.count({
    where: { ip, basarili: false, createdAt: { gt: birSaatOnce } },
  });

  if (sayi >= IP_SAATLIK_SINIR) {
    return {
      engel: true,
      mesaj: "Çok fazla başarısız deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.",
    };
  }
  return { engel: false };
}

export async function denemeKaydet(
  email: string,
  ip: string | null,
  basarili: boolean,
  sebep?: string
): Promise<void> {
  await db().girisDenemesi.create({
    data: { email: email.toLowerCase(), ip, basarili, sebep },
  });
}

/** Hesabın kilitli olup olmadığı; kilitliyse kullanıcıya gösterilecek mesaj. */
export function hesapKilidi(kilitBitis: Date | null): GirisEngeli {
  if (!kilitliMi(kilitBitis)) return { engel: false };
  return {
    engel: true,
    mesaj:
      `Çok fazla hatalı deneme yapıldı. Hesabınız ${kalanKilitDakika(kilitBitis)} dakika ` +
      `boyunca kilitli. Şifrenizi hatırlamıyorsanız "Şifremi unuttum" bağlantısını kullanın.`,
  };
}

/** Başarısız denemeden sonra sayaç artırılır, eşiğe gelince hesap kilitlenir. */
export async function basarisizDenemeIsle(
  userId: string,
  mevcutSayac: number
): Promise<void> {
  const { sayac, kilitBitis } = basarisizSonrasi(mevcutSayac);
  await db().user.updateMany({
    where: { id: userId },
    data: { basarisizGiris: sayac, kilitBitis },
  });
}

/** Başarılı girişte sayaç ve kilit sıfırlanır. */
export async function basariliGirisIsle(userId: string): Promise<void> {
  await db().user.updateMany({
    where: { id: userId },
    data: { basarisizGiris: 0, kilitBitis: null },
  });
}

export { KILIT_ESIGI };

// ── F3: Oturum kaydı ───────────────────────────────────────────────────────

/**
 * Oturum kaydı açar ve JWT'ye gömülecek `jti`yi döndürür.
 *
 * JWT tek başına iptal edilemez; sunucuda karşılığı olan bir satır tutmak,
 * "bu oturumu sonlandır" düğmesini mümkün kılan şeydir.
 */
export async function oturumAc(veri: {
  tenantId: string;
  userId: string;
  ua: string | null;
  ip: string | null;
  omurGun: number;
}): Promise<string> {
  const jti = randomUUID();
  const sonKullanma = new Date(Date.now() + veri.omurGun * 86_400_000);

  await db().oturum.create({
    data: {
      tenantId: veri.tenantId,
      userId: veri.userId,
      jti,
      cihaz: cihazOzeti(veri.ua),
      ip: veri.ip,
      sonKullanma,
    },
  });

  // Süresi geçmiş kayıtlar birikmesin (kullanıcı başına küçük bir temizlik).
  await db().oturum.deleteMany({
    where: { userId: veri.userId, sonKullanma: { lt: new Date() } },
  });

  return jti;
}

/**
 * Oturumun hâlâ geçerli olup olmadığı.
 *
 * Sonlandırılan oturumun satırı SİLİNİR; bu yüzden "satır yoksa geçersiz"
 * kuralı yeterlidir. `sonGorulme` en fazla dakikada bir güncellenir —
 * her istekte yazmak, okuma ağırlıklı bir uygulamayı yazma ağırlıklı yapardı.
 */
export async function oturumGecerliMi(jti: string): Promise<boolean> {
  const kayit = await db().oturum.findFirst({ where: { jti } });
  if (!kayit) return false;
  if (kayit.sonKullanma.getTime() < Date.now()) return false;

  if (Date.now() - kayit.sonGorulme.getTime() > 60_000) {
    await db().oturum.updateMany({ where: { jti }, data: { sonGorulme: new Date() } });
  }
  return true;
}

export async function oturumKapat(jti: string): Promise<void> {
  await db().oturum.deleteMany({ where: { jti } });
}

// ── F1: Şifre sıfırlama ────────────────────────────────────────────────────

export type SifirlamaSonucu =
  | { ok: true; token: string; email: string; ad: string; tenantId: string }
  // Hesap bulunamasa bile arayüz AYNI mesajı gösterir; "bu e-posta kayıtlı
  // değil" yanıtı, kimlerin müşteri olduğunu sızdıran bir sayaçtır.
  | { ok: false; sessiz: true }
  | { ok: false; sessiz: false; hata: string };

/**
 * Şifre sıfırlama isteği oluşturur.
 *
 * Davet akışıyla aynı desen: token'ın kendisi saklanmaz, yalnızca sha256
 * özeti. Aynı e-posta birden çok kiracıda varsa hepsi için ayrı istek açılır
 * — kullanıcı hangi kuruluşun bağlantısına tıklarsa o hesabı sıfırlar.
 */
export async function sifirlamaIstegiOlustur(
  email: string,
  ip: string | null
): Promise<SifirlamaSonucu[]> {
  const temizEmail = email.trim().toLowerCase();
  const kullanicilar = await db().user.findMany({
    where: { email: temizEmail, durum: "aktif" },
    include: { tenant: true },
  });

  const sonuclar: SifirlamaSonucu[] = [];
  for (const kullanici of kullanicilar) {
    if (kullanici.tenant.durum !== "aktif") continue;

    // Hız sınırı: aynı hesap için saatte en fazla N istek.
    const birSaatOnce = new Date(Date.now() - 3_600_000);
    const sayi = await db().sifreSifirlama.count({
      where: { userId: kullanici.id, createdAt: { gt: birSaatOnce } },
    });
    if (sayi >= SIFIRLAMA_SAATLIK_SINIR) {
      sonuclar.push({
        ok: false,
        sessiz: false,
        hata: "Çok fazla sıfırlama isteği gönderildi. Bir saat sonra tekrar deneyin.",
      });
      continue;
    }

    const token = randomBytes(32).toString("base64url");
    const sonKullanma = new Date(Date.now() + 60 * 60 * 1000); // 1 saat

    await db().sifreSifirlama.create({
      data: {
        tenantId: kullanici.tenantId,
        userId: kullanici.id,
        tokenOzeti: tokenOzeti(token),
        sonKullanma,
        istekIp: ip,
      },
    });

    sonuclar.push({
      ok: true,
      token,
      email: kullanici.email,
      ad: kullanici.name,
      tenantId: kullanici.tenantId,
    });
  }

  return sonuclar;
}

export type SifirlamaKaydi = {
  id: string;
  userId: string;
  tenantId: string;
  email: string;
  ad: string;
  kurulusAd: string;
};

/** Token geçerliyse ilgili kaydı döndürür; değilse null (sebep sızdırılmaz). */
export async function sifirlamaKaydiGetir(token: string): Promise<SifirlamaKaydi | null> {
  const kayit = await db().sifreSifirlama.findFirst({
    where: { tokenOzeti: tokenOzeti(token), kullanildi: null, sonKullanma: { gt: new Date() } },
  });
  if (!kayit) return null;

  const kullanici = await db().user.findFirst({
    where: { id: kayit.userId },
    include: { tenant: true },
  });
  if (!kullanici || kullanici.durum !== "aktif") return null;

  return {
    id: kayit.id,
    userId: kullanici.id,
    tenantId: kullanici.tenantId,
    email: kullanici.email,
    ad: kullanici.name,
    kurulusAd: kullanici.tenant.ad,
  };
}

/**
 * Sıfırlama e-postasını kuyruğa yazar.
 *
 * Oturum açılmadan yapılır (kullanıcı zaten giremiyor); giriş bağlamının
 * kuyrukta YALNIZCA INSERT izni vardır — başkasının postasını okuyamaz.
 * Gönderimi her zamanki zamanlanmış çalıştırıcı yapar.
 */
export async function sifirlamaEpostasiKuyrukla(veri: {
  tenantId: string;
  email: string;
  ad: string;
  baglanti: string;
}): Promise<void> {
  const govde =
    `Merhaba ${veri.ad},\n\n` +
    `Gezegen CRM hesabınız için şifre sıfırlama isteği alındı. ` +
    `Yeni şifrenizi belirlemek için aşağıdaki bağlantıya tıklayın:\n\n` +
    `${veri.baglanti}\n\n` +
    `Bağlantı 1 saat geçerlidir ve yalnızca bir kez kullanılabilir.\n\n` +
    `Bu isteği siz yapmadıysanız bu iletiyi yok sayabilirsiniz; şifreniz değişmez.`;

  await db().epostaKuyrugu.create({
    data: {
      tenantId: veri.tenantId,
      alici: veri.email,
      konu: "Şifre sıfırlama isteği",
      govde,
      tur: "sifre.sifirlama",
    },
  });
}

/**
 * Şifreyi değiştirir, isteği tüketir ve KULLANICININ BÜTÜN OTURUMLARINI
 * KAPATIR. Şifre sıfırlamanın sebebi çoğu zaman "hesabım ele geçirildi"
 * şüphesidir; eski oturumların açık kalması sıfırlamayı anlamsız kılardı.
 */
export async function sifirlamayiTamamla(
  kayitId: string,
  userId: string,
  yeniSifre: string
): Promise<void> {
  const hash = await bcrypt.hash(yeniSifre, 10);

  await db().user.updateMany({
    where: { id: userId },
    data: {
      password: hash,
      sifreGuncellendi: new Date(),
      basarisizGiris: 0,
      kilitBitis: null,
    },
  });
  await db().sifreSifirlama.updateMany({
    where: { id: kayitId },
    data: { kullanildi: new Date() },
  });
  await db().oturum.deleteMany({ where: { userId } });
}
