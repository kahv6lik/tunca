import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "./db";
import { anketIstemcisi } from "./rls";
import { yanitDogrula, yanitlanabilirMi, type SoruTanimi } from "./anket-tanimlar";

/**
 * Anket yanıtlama veri erişimi (Faz 19 / N3) — BEŞİNCİ DAR KAPI.
 *
 * Anketi dolduran kişi uygulamanın KULLANICISI DEĞİLDİR: müşterinin bir
 * çalışanıdır, hesabı yoktur ve olmayacaktır. Oturum ve kiracı bağlamı
 * kurulamadığı için kiracı izolasyonunun beşinci bilinçli istisnası burada
 * açılır — davet akışıyla (Faz 5) aynı gerekçe.
 *
 * İSTİSNA BU DOSYADA TOPLANIR ki kapsamı bir bakışta görülebilsin:
 *
 *   - `app.anket` bağlamı yalnızca DÖRT anket tablosunu görür; iş verisine
 *     (firma, teklif, kişi, sipariş…) hiçbir erişimi yoktur.
 *   - Anket ve soru SALT OKUNURDUR: dolduran kişi soruyu değiştiremez.
 *   - Yanıt yalnızca YAZILIR, okunmaz: dolduran kişi başkalarının yanıtını
 *     göremez (RLS'te AnketYanit için yalnızca INSERT politikası var).
 *   - Kiracı, anket ve firma İSTEMCİDEN GELMEZ; gönderim kaydından okunur.
 *   - Token tahmin edilemez (32 rastgele bayt) ve veritabanında yalnızca
 *     sha256 ÖZETİ durur.
 *
 * Regresyon testi `anketIstemcisi`nin bu dosyanın dışında kullanılmadığını
 * sürekli denetler.
 */

export function anketTokenUret(): { token: string; ozet: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, ozet: anketTokenOzeti(token) };
}

export function anketTokenOzeti(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type AnketGorunumu = {
  gonderimId: string;
  anketId: string;
  baslik: string;
  aciklama: string | null;
  anonim: boolean;
  kiraciAd: string;
  alici: string | null;
  sorular: SoruTanimi[];
  /** Yanıtlanabiliyorsa `null`, değilse kullanıcıya gösterilecek mesaj. */
  engel: string | null;
};

/**
 * Anket sayfası için salt okuma. Geçersiz token'da `null` döner.
 *
 * Kiracının ADI gösterilir ("X firması sizden görüş istiyor") ama bu bilgi
 * Tenant tablosundan DEĞİL, gönderim kaydının anketi üzerinden okunamaz —
 * `app.anket` bağlamı Tenant'ı görmez. Bu yüzden marka adı gönderim anında
 * `ad` alanına yazılmaz; anketin başlığı yeterlidir ve kapı dar kalır.
 */
export async function anketGoruntule(token: string): Promise<AnketGorunumu | null> {
  const db = anketIstemcisi(prisma);

  const gonderim = await db.anketGonderim.findUnique({
    where: { tokenOzeti: anketTokenOzeti(token) },
    include: {
      anket: {
        include: { sorular: { orderBy: { sira: "asc" } } },
      },
    },
  });
  if (!gonderim) return null;

  const durum = yanitlanabilirMi(gonderim.anket, gonderim);

  return {
    gonderimId: gonderim.id,
    anketId: gonderim.anketId,
    baslik: gonderim.anket.baslik,
    aciklama: gonderim.anket.aciklama,
    anonim: gonderim.anket.anonim,
    // Kiracı adı bu bağlamda okunamaz; anket başlığı kimliği taşır.
    kiraciAd: "",
    alici: gonderim.ad,
    sorular: gonderim.anket.sorular.map((s) => ({
      id: s.id,
      tip: s.tip,
      metin: s.metin,
      secenekler: s.secenekler,
      zorunlu: s.zorunlu,
    })),
    engel: durum.ok ? null : durum.mesaj,
  };
}

export type YanitSonucu = { ok: true } | { ok: false; hata: string };

/**
 * Yanıtları kaydeder ve gönderimi damgalar.
 *
 * ANONİMLİK BURADA UYGULANIR: anket `anonim` ise yanıt satırlarına
 * `gonderimId` ve `firmaId` HİÇ yazılmaz. Söz arayüzde değil VERİDE tutulur —
 * sonradan "kim yanıtladı" diye sorulamaz, çünkü bağ yoktur.
 *
 * `yanitGrubu` yine de yazılır: aynı doldurmadaki yanıtları birbirine bağlar
 * (NPS gibi kişi başına hesaplar bunu kullanır) ama hiçbir kimliğe çevrilemez.
 */
export async function anketiYanitla(
  token: string,
  degerler: Record<string, string>
): Promise<YanitSonucu> {
  const db = anketIstemcisi(prisma);
  const ozet = anketTokenOzeti(token);

  const gonderim = await db.anketGonderim.findUnique({
    where: { tokenOzeti: ozet },
    include: { anket: { include: { sorular: { orderBy: { sira: "asc" } } } } },
  });
  if (!gonderim) return { ok: false, hata: "Bağlantı geçersiz." };

  const durum = yanitlanabilirMi(gonderim.anket, gonderim);
  if (!durum.ok) return { ok: false, hata: durum.mesaj };

  // Doğrulama YAZMADAN ÖNCE, tamamı: yarı kaydedilmiş bir anket, hem raporu
  // hem kullanıcının ikinci denemesini bozardı (bağlantı tek kullanımlık).
  const yazilacak: { soruId: string; deger: string }[] = [];
  for (const s of gonderim.anket.sorular) {
    const sonuc = yanitDogrula(
      {
        id: s.id,
        tip: s.tip,
        metin: s.metin,
        secenekler: s.secenekler,
        zorunlu: s.zorunlu,
      },
      degerler[s.id] ?? ""
    );
    if (!sonuc.ok) return { ok: false, hata: sonuc.hata };
    if (sonuc.deger !== "") yazilacak.push({ soruId: s.id, deger: sonuc.deger });
  }

  const anonim = gonderim.anket.anonim;
  const yanitGrubu = randomUUID();

  await db.anketYanit.createMany({
    data: yazilacak.map((y) => ({
      tenantId: gonderim.tenantId,
      anketId: gonderim.anketId,
      soruId: y.soruId,
      // ANONİM ANKETTE BAĞ YOKTUR.
      gonderimId: anonim ? null : gonderim.id,
      firmaId: anonim ? null : gonderim.firmaId,
      yanitGrubu,
      deger: y.deger,
    })),
  });

  // Bağlantı tek kullanımlıktır: damga hem "yanıtladı" bilgisidir hem de
  // ikinci gönderimi engeller. Anonim ankette de yazılır — "kime gönderdik,
  // kaçı yanıtladı" sorusu anonimlikle çelişmez.
  await db.anketGonderim.update({
    where: { id: gonderim.id },
    data: { yanitTarihi: new Date() },
  });

  return { ok: true };
}
