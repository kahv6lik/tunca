import "server-only";
import { getTenantContext, tenantOlustur } from "@/lib/tenant-db";
import { kiraciAyari } from "@/lib/kiraci-ayar";
import { etkinIzinler, IZIN } from "@/lib/yetki";
import {
  AI_ZAMAN_ASIMI_MS,
  aiKapaliSebebi,
  aiKullanilabilir,
  type AiDurumu,
  type AiTuru,
} from "@/lib/ai-tanimlar";

/**
 * AI sağlayıcı katmanı — Faz 21, TEK KAPI.
 *
 * Dil modeline yapılan her çağrı buradan geçer. Sebebi Faz 8'deki bildirim
 * ve Faz 17'deki dosya kapılarıyla aynıdır: kural her çağrıda aynıdır
 * (modül açık mı, kiracı açmış mı, anahtar var mı, defter yazıldı mı) ve
 * her ekran kendi çağrısını yazsaydı bu dörtten biri er ya da geç
 * unutulurdu.
 *
 * ANAHTAR TANIMSIZSA KAPALIDIR — "tanımsızsa serbest" davranışı, ücretli bir
 * servise sessizce istek atmak ya da her ekranda hata basmak demektir
 * (Faz 17 / geocoding ve Faz 8 / `/api/gorevler` aynı gerekçe).
 *
 * ÇAĞRI BAŞARISIZ OLURSA EKRAN DÜŞMEZ. AI ikincil bir yardımdır; model
 * yanıt vermediğinde firma sayfası açılmaya devam eder ve kullanıcıya
 * yalnızca "özet üretilemedi" denir.
 */

const VARSAYILAN_MODEL = "claude-sonnet-4-5";

function anahtar(): string | undefined {
  return process.env.ANTHROPIC_API_KEY?.trim() || undefined;
}

export function aiModeli(): string {
  return process.env.AI_MODEL?.trim() || VARSAYILAN_MODEL;
}

/**
 * Kiracının AI durumu — üç kapının da hâli.
 *
 * İzin süzgeci ÇAĞIRANDA değil burada: `ai.kullan` izni olmayan kullanıcı
 * için modül kapalı sayılır, böylece hiçbir ekran ayrıca kontrol yazmak
 * zorunda kalmaz.
 */
export async function aiDurumu(): Promise<AiDurumu> {
  const izinler = await etkinIzinler();
  // Paket modülü kapalıysa `etkinIzinler` zaten ai.* izinlerini düşürür
  // (Faz 5 / B4) — yani bu tek kontrol iki kapıyı birden yoklar.
  const modulAcik = izinler.has(IZIN.aiKullan);

  // Kiracı ayarı istek başına önbelleklidir (`cache()`), yani bu kontrol
  // sayfada kaç kez sorulursa sorulsun tek sorgu çalışır.
  const kiraciAcik = modulAcik ? (await kiraciAyari()).aiAcik : false;

  return { modulAcik, kiraciAcik, anahtarVar: Boolean(anahtar()) };
}

export type AiSonucu =
  | { ok: true; metin: string }
  | { ok: false; hata: string };

/**
 * Modele bir istem gönderir ve düz metin yanıt alır.
 *
 * `konu` kullanım defterine yazılan TEK SATIRLIK künyedir ("Firma özeti ·
 * ACME A.Ş."). İstemin ya da yanıtın METNİ saklanmaz: defter bir denetim
 * kaydıdır, ikinci bir müşteri veri kopyası değildir.
 */
export async function aiCagir(
  tur: AiTuru,
  konu: string,
  istem: string,
  secenek: { enFazlaToken?: number; sistem?: string } = {}
): Promise<AiSonucu> {
  const durum = await aiDurumu();
  if (!aiKullanilabilir(durum)) {
    return { ok: false, hata: aiKapaliSebebi(durum) ?? "AI kapalı." };
  }

  const model = aiModeli();
  const basladi = Date.now();
  let sonuc: AiSonucu;
  let girisToken = 0;
  let cikisToken = 0;

  try {
    const yanit = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anahtar() as string,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: secenek.enFazlaToken ?? 700,
        ...(secenek.sistem ? { system: secenek.sistem } : {}),
        messages: [{ role: "user", content: istem }],
      }),
      signal: AbortSignal.timeout(AI_ZAMAN_ASIMI_MS),
    });

    if (!yanit.ok) {
      sonuc = { ok: false, hata: `Model servisi yanıt vermedi (${yanit.status}).` };
    } else {
      const veri = (await yanit.json()) as {
        content?: { type?: string; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      girisToken = veri.usage?.input_tokens ?? 0;
      cikisToken = veri.usage?.output_tokens ?? 0;
      const metin = (veri.content ?? [])
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      sonuc = metin
        ? { ok: true, metin }
        : { ok: false, hata: "Model boş yanıt döndürdü." };
    }
  } catch {
    // Zaman aşımı ve ağ hataları aynı yere düşer: kullanıcıya teknik detay
    // vermek bir şey kazandırmaz, ekranın düşmemesi kazandırır.
    sonuc = { ok: false, hata: "Model servisine ulaşılamadı." };
  }

  await kullanimYaz(tur, konu, model, {
    girisToken,
    cikisToken,
    basarili: sonuc.ok,
    hata: sonuc.ok ? null : sonuc.hata,
    sureMs: Date.now() - basladi,
  });

  return sonuc;
}

/**
 * Kullanım defterine yazar.
 *
 * Defter yazımı ÇAĞRIYI DÜŞÜRMEZ: defter yazılamadı diye kullanıcının
 * özeti kaybolmamalıdır. Yine de sessiz kalmaz — sunucu günlüğüne düşer.
 */
async function kullanimYaz(
  tur: AiTuru,
  konu: string,
  model: string,
  olcum: {
    girisToken: number;
    cikisToken: number;
    basarili: boolean;
    hata: string | null;
    sureMs: number;
  }
): Promise<void> {
  try {
    const { db, session } = await getTenantContext();
    await tenantOlustur(db, "aiKullanim", {
      kullaniciId: session.userId,
      kullaniciEmail: session.email,
      tur,
      konu: konu.slice(0, 200),
      model,
      girisToken: olcum.girisToken,
      cikisToken: olcum.cikisToken,
      basarili: olcum.basarili,
      hata: olcum.hata?.slice(0, 300) ?? null,
      sureMs: olcum.sureMs,
    });
  } catch (e) {
    console.error("AI kullanım defteri yazılamadı:", e);
  }
}
