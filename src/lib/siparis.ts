import { Prisma } from "@prisma/client";
import { stokIstemcisi, stokHareketiIsle, type StokIstemcisi } from "./stok";
import { kampanyaIstemcisi, kampanyaKullan, kotaIade } from "./kampanya";

/**
 * Sipariş akışı — Faz 15 / S1, S3, S4.
 *
 * ═══ AKIŞIN SÖZÜ ═══
 *
 * Satış personelinin girdiği sipariş "onay bekliyor" durumunda açılır.
 * **ONAYLANMADAN sevkiyat kaydı doğmaz ve depoya hiçbir bildirim gitmez.**
 * Bu, ortağın açıkça istediği kuraldır ve burada TEK KAPIDAN geçer:
 * `sevkiyatAcilabilirMi` dışında hiçbir yerden sevkiyat oluşturulmaz.
 *
 * ═══ ONAY ANINDA NE OLUR ═══
 *
 *   1. Stok yeterliliği ÖNCE toptan kontrol edilir (hiçbir şey düşülmeden).
 *   2. Sonra satır satır düşülür — her düşüm atomiktir (Faz 14 / T7).
 *   3. Bir satır yarı yolda düşerse (eşzamanlı başka bir satış araya girdiyse)
 *      o ana kadar düşülenler TERS HAREKETLE iade edilir ve onay reddedilir.
 *
 * Neden "önce kontrol, sonra düş" yetmiyor: iki kontrol arasında başka bir
 * sipariş onaylanabilir. Bu yüzden gerçek koruma atomik düşümdedir; ön
 * kontrol yalnızca kullanıcıya erken ve anlaşılır hata vermek içindir.
 *
 * `server-only` DEĞİLDİR: testler onay akışını gerçek veritabanına karşı
 * sınar (yedek-saf / kampanya / stok deseni).
 */

export type SayacIstemcisi = {
  $queryRaw: <T>(sorgu: Prisma.Sql) => Promise<T>;
  belgeSayac: { upsert: (args: unknown) => Promise<unknown> };
};

export type SiparisIstemcisi = StokIstemcisi &
  SayacIstemcisi & {
  $queryRaw: <T>(sorgu: Prisma.Sql) => Promise<T>;
  $executeRaw: (sorgu: Prisma.Sql) => Promise<number>;
  siparis: {
    findFirst: (args?: unknown) => Promise<Record<string, unknown> | null>;
    findMany: (args?: unknown) => Promise<Record<string, unknown>[]>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
  kampanya: {
    findMany: (args?: unknown) => Promise<Record<string, unknown>[]>;
    findFirst: (args?: unknown) => Promise<Record<string, unknown> | null>;
  };
  kampanyaKullanim: {
    create: (args: unknown) => Promise<{ id: string }>;
    findMany: (args?: unknown) => Promise<Record<string, unknown>[]>;
  };
};

export function siparisIstemcisi(db: unknown): SiparisIstemcisi {
  return db as SiparisIstemcisi;
}

/** Belge numarası: SIP-2026-0001 / SVK-2026-0001. */
export function belgeNo(onEk: string, yil: number, sira: number): string {
  return `${onEk}-${yil}-${String(sira).padStart(4, "0")}`;
}

/**
 * Sıradaki belge numarasını ATOMİK alır (Faz 13 / H1 deseni).
 *
 * Numara YIL bazında sıfırlanır: muhasebe alışkanlığı böyledir ve
 * "2026'nın kaçıncı siparişi" sorusu doğrudan yanıtlanabilir.
 */
export async function siradakiBelgeNo(
  db: SayacIstemcisi,
  tenantId: string,
  tur: "siparis" | "sevkiyat" | "destek",
  yil = new Date().getFullYear()
): Promise<string> {
  await db.belgeSayac.upsert({
    where: { tenantId_tur_yil: { tenantId, tur, yil } },
    create: { tenantId, tur, yil, sonSira: 0 },
    update: {},
  });

  const satirlar = await db.$queryRaw<{ sonSira: number }[]>(
    Prisma.sql`
      UPDATE "BelgeSayac"
      SET "sonSira" = "sonSira" + 1, "updatedAt" = NOW()
      WHERE "tenantId" = ${tenantId} AND "tur" = ${tur} AND "yil" = ${yil}
      RETURNING "sonSira"
    `
  );

  const sira = satirlar[0]?.sonSira ?? 1;
  const onEk = tur === "siparis" ? "SIP" : tur === "sevkiyat" ? "SVK" : "DST";
  return belgeNo(onEk, yil, sira);
}

// ── Onay akışı ─────────────────────────────────────────────────────────────

export type OnaySonucu =
  | { ok: true; dusulenSatir: number }
  | { ok: false; hata: string };

type KalemBilgisi = {
  id: string;
  urunId: string | null;
  aciklama: string;
  miktar: number;
  kampanyaId: string | null;
  indirimTutari: number;
};

/**
 * Onay öncesi stok yeterliliğini kontrol eder — HİÇBİR ŞEY DÜŞMEZ.
 *
 * Kullanıcıya erken ve tek seferde anlaşılır bir liste vermek için: onayın
 * ortasında "üçüncü kalemde stok yok" demek, yöneticiyi tek tek denemeye
 * zorlardı.
 */
export async function stokYeterliMi(
  db: SiparisIstemcisi,
  kalemler: KalemBilgisi[]
): Promise<{ ok: boolean; eksikler: string[] }> {
  const eksikler: string[] = [];

  // Aynı ürün birden çok satırda olabilir; toplam ihtiyaç üzerinden bakılır.
  const ihtiyac = new Map<string, number>();
  for (const k of kalemler) {
    if (!k.urunId) continue;
    ihtiyac.set(k.urunId, (ihtiyac.get(k.urunId) ?? 0) + k.miktar);
  }

  for (const [urunId, miktar] of ihtiyac) {
    const urun = (await db.urun.findFirst({
      where: { id: urunId },
      select: { ad: true, stokTakibi: true, stokMiktar: true, birim: true },
    })) as { ad: string; stokTakibi: boolean; stokMiktar: number; birim: string } | null;

    if (!urun || !urun.stokTakibi) continue; // stok takibi yoksa kısıt da yok
    if (urun.stokMiktar < miktar) {
      eksikler.push(
        `${urun.ad}: elde ${urun.stokMiktar} ${urun.birim}, gereken ${miktar} ${urun.birim}`
      );
    }
  }

  return { ok: eksikler.length === 0, eksikler };
}

/**
 * Siparişi onaylar: stok ve kampanya kotasını düşer, durumu "onaylandı"
 * yapar.
 *
 * Yarı yolda kalan düşümler geri alınır — sipariş onaylanmadıysa stok da
 * düşmüş olmamalıdır.
 */
export async function siparisiOnayla(
  db: SiparisIstemcisi,
  tenantId: string,
  siparisId: string,
  onaylayanId: string
): Promise<OnaySonucu> {
  const siparis = (await db.siparis.findFirst({
    where: { id: siparisId },
    include: {
      kalemler: {
        select: {
          id: true, urunId: true, aciklama: true, miktar: true,
          kampanyaId: true, indirimTutari: true,
        },
      },
    },
  })) as unknown as
    | { id: string; no: string; durum: string; firmaId: string; stokDusuldu: boolean; kalemler: KalemBilgisi[] }
    | null;

  if (!siparis) return { ok: false, hata: "Sipariş bulunamadı." };
  if (siparis.durum === "onaylandi") {
    return { ok: false, hata: "Bu sipariş zaten onaylanmış." };
  }
  if (siparis.durum === "iptal") {
    return { ok: false, hata: "İptal edilmiş sipariş onaylanamaz." };
  }

  // 1) Ön kontrol — hiçbir şey düşmeden.
  const yeterli = await stokYeterliMi(db, siparis.kalemler);
  if (!yeterli.ok) {
    return {
      ok: false,
      hata: `Stok yetersiz — onay verilemez.\n${yeterli.eksikler.join("\n")}`,
    };
  }

  // 2) Stok düşümü — satır satır, her biri atomik.
  const dusulenler: { urunId: string; miktar: number }[] = [];

  for (const k of siparis.kalemler) {
    if (!k.urunId) continue;

    const urun = (await db.urun.findFirst({
      where: { id: k.urunId },
      select: { stokTakibi: true },
    })) as { stokTakibi: boolean } | null;
    if (!urun?.stokTakibi) continue;

    const sonuc = await stokHareketiIsle(stokIstemcisi(db), tenantId, {
      urunId: k.urunId,
      tur: "cikis",
      miktar: k.miktar,
      aciklama: `Sipariş onayı: ${siparis.no}`,
      referans: siparis.no,
      kullaniciId: onaylayanId,
    });

    if (!sonuc.ok) {
      // Yarış kaybedildi: araya başka bir onay girmiş. O ana kadar
      // düşülenleri İADE ET ve onayı reddet — yarım düşülmüş stok,
      // düzeltilmesi en zor durumdur.
      await dusulenleriGeriAl(db, tenantId, siparis.no, dusulenler, onaylayanId);
      return { ok: false, hata: sonuc.hata };
    }

    dusulenler.push({ urunId: k.urunId, miktar: k.miktar });
  }

  // 3) Kampanya kotası — satırda kampanya varsa kullanım defterine işlenir.
  for (const k of siparis.kalemler) {
    if (!k.kampanyaId) continue;

    const sonuc = await kampanyaKullan(kampanyaIstemcisi(db), tenantId, {
      kampanyaId: k.kampanyaId,
      firmaId: siparis.firmaId,
      adet: k.miktar,
      indirimTutari: k.indirimTutari,
      referans: siparis.no,
      kullananId: onaylayanId,
    });

    if (!sonuc.ok) {
      await dusulenleriGeriAl(db, tenantId, siparis.no, dusulenler, onaylayanId);
      return { ok: false, hata: sonuc.hata };
    }
  }

  // 4) Durum — en sonda. Buraya gelindiyse stok ve kota güvence altında.
  await db.siparis.updateMany({
    where: { id: siparisId, tenantId },
    data: {
      durum: "onaylandi",
      onaylayanId,
      onayTarihi: new Date(),
      redSebebi: null,
      stokDusuldu: dusulenler.length > 0,
    },
  });

  return { ok: true, dusulenSatir: dusulenler.length };
}

/** Yarı yolda kalan stok düşümlerini ters hareketle iade eder. */
async function dusulenleriGeriAl(
  db: SiparisIstemcisi,
  tenantId: string,
  siparisNo: string,
  dusulenler: { urunId: string; miktar: number }[],
  kullaniciId: string
): Promise<void> {
  for (const d of dusulenler) {
    await stokHareketiIsle(stokIstemcisi(db), tenantId, {
      urunId: d.urunId,
      tur: "iade",
      miktar: d.miktar,
      aciklama: `Onay geri alındı: ${siparisNo}`,
      referans: siparisNo,
      kullaniciId,
    });
  }
}

/**
 * Onaylanmış siparişi iptal eder ve düşülen stok/kotayı iade eder.
 *
 * Stok İADE HAREKETİYLE geri verilir, bakiye elle yazılmaz — defterde
 * "neden arttı" sorusunun yanıtı durmalıdır.
 */
export async function siparisiIptalEt(
  db: SiparisIstemcisi,
  tenantId: string,
  siparisId: string,
  kullaniciId: string
): Promise<{ ok: boolean; hata?: string }> {
  const siparis = (await db.siparis.findFirst({
    where: { id: siparisId },
    include: {
      kalemler: {
        select: { urunId: true, miktar: true, kampanyaId: true },
      },
      sevkiyatlar: { select: { id: true, durum: true } },
    },
  })) as unknown as
    | {
        no: string;
        durum: string;
        stokDusuldu: boolean;
        kalemler: { urunId: string | null; miktar: number; kampanyaId: string | null }[];
        sevkiyatlar: { id: string; durum: string }[];
      }
    | null;

  if (!siparis) return { ok: false, hata: "Sipariş bulunamadı." };
  if (siparis.durum === "iptal") return { ok: true };

  // Sevk edilmiş sipariş iptal EDİLEMEZ: mal yola çıkmıştır, stok iadesi
  // gerçeği yansıtmaz. Doğru yol sevkiyatı iptal edip iade sürecini işletmek.
  const sevkEdilmis = siparis.sevkiyatlar.some(
    (s) => s.durum === "sevkedildi" || s.durum === "teslim"
  );
  if (sevkEdilmis) {
    return {
      ok: false,
      hata: "Sevk edilmiş sipariş iptal edilemez. Önce sevkiyatı iptal edin.",
    };
  }

  if (siparis.stokDusuldu) {
    for (const k of siparis.kalemler) {
      if (!k.urunId) continue;
      const urun = (await db.urun.findFirst({
        where: { id: k.urunId },
        select: { stokTakibi: true },
      })) as { stokTakibi: boolean } | null;
      if (!urun?.stokTakibi) continue;

      await stokHareketiIsle(stokIstemcisi(db), tenantId, {
        urunId: k.urunId,
        tur: "iade",
        miktar: k.miktar,
        aciklama: `Sipariş iptali: ${siparis.no}`,
        referans: siparis.no,
        kullaniciId,
      });
    }

    for (const k of siparis.kalemler) {
      if (!k.kampanyaId) continue;
      await kotaIade(kampanyaIstemcisi(db), tenantId, k.kampanyaId, k.miktar);
    }
  }

  await db.siparis.updateMany({
    where: { id: siparisId, tenantId },
    data: { durum: "iptal", stokDusuldu: false },
  });

  return { ok: true };
}

/**
 * Sevkiyat açılabilir mi? — AKIŞIN SÖZÜNÜN TEK KAPISI.
 *
 * Sevkiyat kaydı yalnızca ONAYLANMIŞ siparişten doğar. Bu kural izinle
 * değil, VERİYLE korunur: depo yetkisi olan bir kullanıcı bile onaysız
 * siparişe sevkiyat açamaz.
 */
export function sevkiyatAcilabilirMi(siparisDurum: string): {
  ok: boolean;
  hata?: string;
} {
  if (siparisDurum === "onaylandi") return { ok: true };

  const sebep: Record<string, string> = {
    taslak: "Sipariş henüz taslak — önce onaya gönderilmeli.",
    onaybekliyor: "Sipariş onay bekliyor. Onaylanmadan sevkiyat açılamaz.",
    reddedildi: "Sipariş reddedilmiş; sevkiyat açılamaz.",
    iptal: "Sipariş iptal edilmiş; sevkiyat açılamaz.",
  };

  return { ok: false, hata: sebep[siparisDurum] ?? "Sipariş onaylanmamış." };
}
