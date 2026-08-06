import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPlatformDb } from "@/lib/platform-db";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import KiraciForm from "@/components/admin/KiraciForm";
import KullaniciSatiri from "@/components/admin/KullaniciSatiri";
import DavetPanel from "@/components/admin/DavetPanel";
import {
  ImpersonateDugmesi,
  DurumDugmesi,
  KiraciSilPaneli,
} from "@/components/admin/KiraciIslemler";

export const dynamic = "force-dynamic";

/** Kuruluş detayı — B1 (kiracı), B2 (kullanıcılar), B3 (davet), B5 (impersonation). */
export default async function KiraciDetayPage({ params }: { params: { id: string } }) {
  const db = await getPlatformDb();

  const kiraci = await db.tenant.findUnique({
    where: { id: params.id },
    include: {
      plan: true,
      kullanicilar: { orderBy: { createdAt: "asc" } },
      davetler: { orderBy: { createdAt: "desc" }, take: 20 },
      _count: {
        select: {
          kullanicilar: true,
          firmalar: true,
          yatirimlar: true,
          egitimler: true,
          hizmetler: true,
          gruplar: true,
          denetim: true,
        },
      },
    },
  });

  if (!kiraci) notFound();

  const planlar = await db.plan.findMany({
    orderBy: { ad: "asc" },
    select: { id: true, ad: true },
  });

  const c = kiraci._count;
  const kayitSayisi =
    c.kullanicilar + c.firmalar + c.yatirimlar + c.egitimler + c.hizmetler + c.gruplar + c.denetim;

  const kullaniciLimiti = kiraci.plan?.kullaniciLimiti ?? 0;
  const firmaLimiti = kiraci.plan?.firmaLimiti ?? 0;

  return (
    <div>
      <Link
        href="/admin/kiracilar"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kuruluşlar
      </Link>

      <PageHeader
        title={kiraci.ad}
        subtitle={`${kiraci.slug} · ${kiraci.plan?.ad ?? "Paketsiz"}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge durum={kiraci.durum} />
            <DurumDugmesi tenantId={kiraci.id} durum={kiraci.durum} />
            <ImpersonateDugmesi tenantId={kiraci.id} kiraciAd={kiraci.ad} />
          </div>
        }
      />

      {/* Kullanım — paket limitleri karşısında nerede durduğu */}
      <div className="card mb-6 grid gap-4 p-5 sm:grid-cols-4">
        <Kutu
          etiket="Kullanıcı"
          deger={c.kullanicilar}
          limit={kullaniciLimiti}
        />
        <Kutu etiket="Firma" deger={c.firmalar} limit={firmaLimiti} />
        <Kutu etiket="Yatırım / Eğitim / Hizmet" deger={c.yatirimlar + c.egitimler + c.hizmetler} limit={0} />
        <Kutu etiket="Denetim kaydı" deger={c.denetim} limit={0} />
      </div>

      <div className="space-y-6">
        <KiraciForm
          planlar={planlar}
          mevcut={{
            id: kiraci.id,
            ad: kiraci.ad,
            slug: kiraci.slug,
            durum: kiraci.durum,
            iletisimAd: kiraci.iletisimAd ?? "",
            iletisimEmail: kiraci.iletisimEmail ?? "",
            iletisimTel: kiraci.iletisimTel ?? "",
            notlar: kiraci.notlar ?? "",
            planId: kiraci.planId ?? "",
            logoUrl: kiraci.logoUrl ?? "",
            anaRenk: kiraci.anaRenk ?? "",
            altAlan: kiraci.altAlan ?? "",
          }}
        />

        <div className="card p-5">
          <h2 className="mb-1 font-semibold text-foreground">Kullanıcılar</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            {c.kullanicilar}
            {kullaniciLimiti > 0 ? ` / ${kullaniciLimiti}` : ""} kullanıcı. Pasif
            kullanıcı giriş yapamaz; verisi ve geçmişi korunur.
          </p>
          {kiraci.kullanicilar.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Bu kuruluşta henüz kullanıcı yok. Aşağıdan davet gönderin.
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {kiraci.kullanicilar.map((k) => (
                <KullaniciSatiri
                  key={k.id}
                  kullanici={{
                    id: k.id,
                    ad: k.name,
                    email: k.email,
                    rol: k.role,
                    durum: k.durum,
                    createdAt: k.createdAt.toISOString(),
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <DavetPanel
          tenantId={kiraci.id}
          davetler={kiraci.davetler.map((d) => ({
            id: d.id,
            ad: d.ad,
            email: d.email,
            rol: d.rol,
            sonKullanma: d.sonKullanma.toISOString(),
            kullanildi: d.kullanildi?.toISOString() ?? null,
            olusturanEmail: d.olusturanEmail,
          }))}
        />

        <KiraciSilPaneli
          tenantId={kiraci.id}
          kiraciAd={kiraci.ad}
          kayitSayisi={kayitSayisi}
        />
      </div>
    </div>
  );
}

function Kutu({ etiket, deger, limit }: { etiket: string; deger: number; limit: number }) {
  const doluluk = limit > 0 ? Math.min(100, Math.round((deger / limit) * 100)) : 0;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {etiket}
      </p>
      <p className="mt-1 text-xl font-bold text-foreground">
        {deger}
        {limit > 0 && <span className="text-sm font-normal text-muted-foreground"> / {limit}</span>}
      </p>
      {limit > 0 && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={doluluk >= 100 ? "h-full bg-rose-500" : "h-full bg-primary"}
            style={{ width: `${doluluk}%` }}
          />
        </div>
      )}
    </div>
  );
}
