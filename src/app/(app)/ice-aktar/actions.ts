"use server";

import { revalidatePath } from "next/cache";
import { yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { veriKumesiBul } from "@/lib/disa-aktar-tanimlar";
import {
  dosyaOku,
  otomatikEslestir,
  onIzlemeUret,
  satirlariYaz,
  AZAMI_SATIR,
  type OnIzleme,
  type SatirSonucu,
} from "@/lib/ice-aktar";

/**
 * İçe aktarım işlemleri — Faz 9 / E2.
 *
 * İki action: `dosyaAnalizEt` (yazmaz, yalnızca okur ve doğrular) ve
 * `iceAktar` (yazar). Ayrılmalarının sebebi kullanıcının onaylamadan önce
 * ne olacağını görmesidir.
 *
 * YETKİ: veri kümesinin KENDİ oluşturma izni aranır. Firma içe aktarmak için
 * `firma.olustur` gerekir — içe aktarımın ayrı ve daha gevşek bir izni
 * olsaydı, yetkisi olmayan biri toplu kayıt açabilirdi.
 */

const OLUSTURMA_IZNI: Record<string, string> = {
  firmalar: "firma.olustur",
  kisiler: "kisi.olustur",
  adaylar: "lead.olustur",
  yatirimlar: "yatirim.olustur",
  egitimler: "egitim.olustur",
  hizmetler: "hizmet.olustur",
};

export type AnalizState = {
  error?: string;
  kume?: string;
  basliklar?: string[];
  eslesme?: Record<string, string>;
  onIzleme?: OnIzleme;
  toplamSatir?: number;
};

export async function dosyaAnalizEt(
  _prev: AnalizState,
  formData: FormData
): Promise<AnalizState> {
  const kumeAdi = String(formData.get("kume") ?? "");
  const kume = veriKumesiBul(kumeAdi);

  if (!kume?.iceAktarilir) return { error: "Bu veri kümesi içe aktarıma kapalı." };

  const izin = OLUSTURMA_IZNI[kumeAdi];
  if (!izin || !(await yetkiVarMi(izin as never))) {
    return { error: "Bu veri kümesini içe aktarma yetkiniz yok." };
  }

  const dosya = formData.get("dosya");
  if (!(dosya instanceof File) || dosya.size === 0) {
    return { error: "Bir dosya seçin." };
  }
  if (dosya.size > 10 * 1024 * 1024) {
    return { error: "Dosya 10 MB'tan büyük olamaz." };
  }

  try {
    const okunan = await dosyaOku(dosya);
    if (okunan.basliklar.length === 0) {
      return { error: "Dosya boş ya da okunamadı. İlk satır başlık olmalıdır." };
    }

    // Elle eşleştirme gönderildiyse onu kullan, yoksa otomatik öner.
    const elle: Record<string, string> = {};
    for (const sutun of kume.sutunlar) {
      const secim = formData.get(`eslesme-${sutun.anahtar}`);
      if (typeof secim === "string" && secim) elle[sutun.anahtar] = secim;
    }
    const eslesme = Object.keys(elle).length
      ? elle
      : otomatikEslestir(okunan.basliklar, kume);

    return {
      kume: kumeAdi,
      basliklar: okunan.basliklar,
      eslesme,
      onIzleme: onIzlemeUret(okunan, kume, eslesme),
      toplamSatir: okunan.toplamSatir,
    };
  } catch (e) {
    return {
      error: `Dosya okunamadı: ${e instanceof Error ? e.message : "bilinmeyen hata"}`,
    };
  }
}

export type AktarimState = {
  error?: string;
  ok?: boolean;
  eklenen?: number;
  atlanan?: number;
  hatalar?: { satirNo: number; hata: string }[];
};

/**
 * Onaylanan satırları yazar.
 *
 * Satırlar istemciden GELİR ama yetki, kiracı sınırı ve paket limiti
 * sunucuda yeniden uygulanır: kiracı katmanı `tenantId`'yi kendisi damgalar,
 * firma limiti her yeni firmada kontrol edilir. Yani istemcinin gönderdiği
 * veri en fazla "hangi satırlar" bilgisidir; nereye yazılacağına o karar
 * veremez.
 */
export async function iceAktar(
  _prev: AktarimState,
  formData: FormData
): Promise<AktarimState> {
  const kumeAdi = String(formData.get("kume") ?? "");
  const kume = veriKumesiBul(kumeAdi);
  if (!kume?.iceAktarilir) return { error: "Bu veri kümesi içe aktarıma kapalı." };

  const izin = OLUSTURMA_IZNI[kumeAdi];
  if (!izin || !(await yetkiVarMi(izin as never))) {
    return { error: "Bu veri kümesini içe aktarma yetkiniz yok." };
  }

  let satirlar: SatirSonucu[];
  try {
    satirlar = JSON.parse(String(formData.get("satirlar") ?? "[]"));
  } catch {
    return { error: "Aktarılacak satırlar okunamadı. Dosyayı yeniden yükleyin." };
  }

  if (!Array.isArray(satirlar) || satirlar.length === 0) {
    return { error: "Aktarılacak geçerli satır yok." };
  }
  if (satirlar.length > AZAMI_SATIR) {
    return { error: `Tek seferde en fazla ${AZAMI_SATIR} satır aktarılabilir.` };
  }

  const sonuc = await satirlariYaz(kumeAdi, satirlar);

  await denetimYaz({
    islem: "olustur",
    varlik: "Firma", // denetimde "toplu içe aktarım" olayı olarak görünür
    varlikId: kumeAdi,
    ozet: `${kume.etiket} içe aktarıldı: ${sonuc.eklenen} eklendi, ${sonuc.atlanan} atlandı`,
    yeni: { veriKumesi: kumeAdi, eklenen: sonuc.eklenen, atlanan: sonuc.atlanan },
  });

  revalidatePath("/firmalar");
  revalidatePath("/kisiler");
  revalidatePath("/adaylar");
  revalidatePath("/");

  return {
    ok: true,
    eklenen: sonuc.eklenen,
    atlanan: sonuc.atlanan,
    hatalar: sonuc.hatalar.slice(0, 20),
  };
}
