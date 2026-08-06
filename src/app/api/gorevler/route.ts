import { NextRequest, NextResponse } from "next/server";
import { anahtarGecerliMi, zamanlanmisIsleriCalistir } from "@/lib/zamanlanmis";

export const dynamic = "force-dynamic";
// Bir çalıştırma uzun sürebilir (posta gönderimi, IMAP taraması).
export const maxDuration = 300;

/**
 * Zamanlanmış iş çalıştırıcısı — Faz 8.
 *
 * Next.js'in kendi zamanlayıcısı yoktur; bu uç nokta DIŞARIDAN çağrılır
 * (cron, systemd timer, Docker sidecar). Kurulumu `docs/DEPLOY.md` içinde
 * anlatılır. Örnek:
 *
 *   *\/10 * * * * curl -fsS -H "X-Gorev-Anahtari: $GOREV_ANAHTARI" \
 *     https://crm.ornek.com/api/gorevler
 *
 * GÜVENLİK:
 *   - Uç nokta oturum gerektirmez (cron'un oturumu olamaz) ama paylaşımlı
 *     bir gizle korunur. Anahtar TANIMSIZSA uç nokta tamamen kapalıdır —
 *     "tanımsızsa serbest" davranışı üretimde açık kapı bırakırdı.
 *   - Anahtar başlıkta (`X-Gorev-Anahtari`) taşınır, sorgu dizesinde değil:
 *     sorgu dizesi sunucu erişim günlüklerine düz metin olarak yazılır.
 *   - Yanıt yalnızca sayıları döndürür; hiçbir müşteri verisi sızmaz.
 *
 * `middleware.ts` bu yolu zaten dışarıda bırakır (`/api` eşleşmez).
 */
export async function POST(req: NextRequest) {
  return calistir(req);
}

/**
 * GET de kabul edilir: pek çok basit cron kurulumu yalnızca `curl <url>`
 * yapar. Yan etkisi olan bir GET normalde istenmez ama burada uç nokta
 * gizle korunduğu ve tarayıcıdan çağrılabilir olmadığı için kabul edilebilir
 * bir kolaylıktır.
 */
export async function GET(req: NextRequest) {
  return calistir(req);
}

async function calistir(req: NextRequest) {
  const anahtar =
    req.headers.get("x-gorev-anahtari") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;

  if (!anahtarGecerliMi(anahtar)) {
    // Anahtarın tanımlı olup olmadığını sızdırmamak için tek tip yanıt.
    return NextResponse.json({ hata: "Yetkisiz" }, { status: 401 });
  }

  const baslangic = Date.now();

  try {
    const sonuc = await zamanlanmisIsleriCalistir();
    return NextResponse.json({
      ok: true,
      sureMs: Date.now() - baslangic,
      ...sonuc,
    });
  } catch (e) {
    console.error("Zamanlanmış iş hatası:", e);
    return NextResponse.json(
      { ok: false, hata: e instanceof Error ? e.message : "Bilinmeyen hata" },
      { status: 500 }
    );
  }
}
