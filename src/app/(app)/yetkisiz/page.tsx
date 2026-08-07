import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { IZIN_ETIKET } from "@/lib/yetki";

export const dynamic = "force-dynamic";

/**
 * Yetkisiz erişim sayfası.
 *
 * Kiracı dışı erişimde 404 gösteriyoruz (kaydın varlığını sızdırmamak için),
 * ama AYNI kiracı içinde yetkisiz erişimde durum farklı: kullanıcı zaten
 * kuruluşun bir parçası, ona ne olduğunu açıkça söylemek doğru.
 */
export default async function YetkisizPage(
  props: {
    searchParams: Promise<{ izin?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const izin = searchParams.izin;
  const etiket = izin ? IZIN_ETIKET[izin] : undefined;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card flex max-w-md flex-col items-center gap-5 p-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 ring-1 ring-inset ring-amber-500/25">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-foreground">
            Bu sayfaya erişim yetkiniz yok
          </h1>
          <p className="text-sm text-muted-foreground">
            {etiket
              ? `Bu bölüm için “${etiket}” yetkisi gerekiyor.`
              : "Bu bölüm için gerekli yetkiye sahip değilsiniz."}{" "}
            Erişim gerekiyorsa kuruluş yöneticinizle görüşün.
          </p>
        </div>

        <Link href="/" className="btn-primary">
          <ArrowLeft className="h-4 w-4" /> Genel Bakış'a dön
        </Link>
      </div>
    </div>
  );
}
