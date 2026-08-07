import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Phone, Users, Mail, StickyNote, CheckSquare, type LucideIcon } from "lucide-react";
import { getTenantContext } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import AktivitePanel, { AktiviteIslemleri } from "@/components/aktiviteler/AktivitePanel";
import { formatTarih, toDateInput } from "@/lib/format";
import { AKTIVITE_TUR } from "@/lib/constants";
import DisaAktarDugmesi from "@/components/DisaAktarDugmesi";

export const dynamic = "force-dynamic";

const IKONLAR: Record<string, LucideIcon> = {
  arama: Phone,
  toplanti: Users,
  eposta: Mail,
  not: StickyNote,
  gorev: CheckSquare,
};

const TUR_ETIKET = Object.fromEntries(AKTIVITE_TUR.map((t) => [t.deger, t.etiket]));

/**
 * Aktiviteler ve görevler (Faz 7 / C4).
 *
 * Üç sekme: "Bugün" (bugüne kadar vadesi gelen açık görevler), "Görevler"
 * (tüm açık işler) ve "Akış" (her şey, kronolojik). Varsayılan sekme
 * bilinçli olarak Bugün'dür — sabah açılınca ilk görülmesi gereken budur.
 */
export default async function AktivitelerPage(
  props: {
    searchParams: Promise<{ sekme?: string; atanan?: string; tur?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.aktiviteGoruntule);

  const [ekleyebilir, duzenleyebilir, silebilir] = await Promise.all([
    yetkiVarMi(IZIN.aktiviteOlustur),
    yetkiVarMi(IZIN.aktiviteDuzenle),
    yetkiVarMi(IZIN.aktiviteSil),
  ]);

  const { db, session } = await getTenantContext();

  const sekme = ["gorevler", "akis"].includes(searchParams.sekme ?? "")
    ? searchParams.sekme!
    : "bugun";
  // Atanan filtresi varsayılan olarak OTURUM SAHİBİDİR: "bugün ne yapacağım"
  // sorusu kişiseldir. "Herkes" seçeneğiyle ekip görünümüne geçilir.
  const atanan = searchParams.atanan ?? session.userId;
  const tur = AKTIVITE_TUR.some((t) => t.deger === searchParams.tur)
    ? searchParams.tur
    : "";

  // Bugünün sonu: vadesi bugün olan görevler de "bugün" sayılır.
  const bugunSonu = new Date();
  bugunSonu.setHours(23, 59, 59, 999);

  const where: Prisma.AktiviteWhereInput = {
    AND: [
      atanan === "herkes" ? {} : { atananId: atanan },
      tur ? { tur } : {},
      sekme === "bugun"
        ? { tamamlandi: null, sonTarih: { not: null, lte: bugunSonu } }
        : sekme === "gorevler"
          ? { tamamlandi: null, sonTarih: { not: null } }
          : {},
    ],
  };

  const [aktiviteler, kullanicilar, firmalar, gecikmisSayi] = await Promise.all([
    db.aktivite.findMany({
      where,
      orderBy: sekme === "akis" ? { createdAt: "desc" } : { sonTarih: "asc" },
      take: 200,
      include: {
        firma: { select: { id: true, ad: true } },
        kisi: { select: { ad: true } },
        firsat: { select: { baslik: true } },
      },
    }),
    db.user.findMany({
      where: { durum: "aktif" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.firma.findMany({ orderBy: { ad: "asc" }, take: 500, select: { id: true, ad: true } }),
    db.aktivite.count({
      where: {
        tamamlandi: null,
        sonTarih: { not: null, lt: new Date(new Date().setHours(0, 0, 0, 0)) },
        ...(atanan === "herkes" ? {} : { atananId: atanan }),
      },
    }),
  ]);

  const kullaniciAdi = new Map(kullanicilar.map((k) => [k.id, k.name]));
  const bugunBasi = new Date(new Date().setHours(0, 0, 0, 0));

  const sekmeQs = (s: string) => {
    const qs = new URLSearchParams();
    if (s !== "bugun") qs.set("sekme", s);
    if (atanan !== session.userId) qs.set("atanan", atanan);
    if (tur) qs.set("tur", tur);
    const q = qs.toString();
    return `/aktiviteler${q ? `?${q}` : ""}`;
  };

  const SEKMELER = [
    { deger: "bugun", etiket: "Bugün" },
    { deger: "gorevler", etiket: "Açık Görevler" },
    { deger: "akis", etiket: "Akış" },
  ];

  return (
    <div>
      <PageHeader
        title="Aktiviteler"
        subtitle={
          gecikmisSayi > 0
            ? `${gecikmisSayi} gecikmiş görev`
            : "Arama, toplantı, not ve görevler"
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <DisaAktarDugmesi
              tur="aktiviteler"
              filtreler={{ aktiviteTur: tur || undefined, atanan }}
            />
            {ekleyebilir && (
              <AktivitePanel kullanicilar={kullanicilar} firmalar={firmalar} />
            )}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-xl border border-border/70">
          {SEKMELER.map((s) => (
            <Link
              key={s.deger}
              href={sekmeQs(s.deger)}
              className={`border-l border-border/70 px-3 py-2 text-sm first:border-l-0 ${
                sekme === s.deger
                  ? "bg-secondary/70 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.etiket}
            </Link>
          ))}
        </div>

        <form method="get" className="flex flex-wrap items-center gap-2">
          {sekme !== "bugun" && <input type="hidden" name="sekme" value={sekme} />}
          <select name="atanan" defaultValue={atanan} className="input h-10 w-auto py-0 text-sm">
            <option value={session.userId}>Bana atananlar</option>
            <option value="herkes">Herkes</option>
            {kullanicilar
              .filter((k) => k.id !== session.userId)
              .map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
          </select>
          <select name="tur" defaultValue={tur} className="input h-10 w-auto py-0 text-sm">
            <option value="">Tüm türler</option>
            {AKTIVITE_TUR.map((t) => (
              <option key={t.deger} value={t.deger}>
                {t.etiket}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-secondary">
            Uygula
          </button>
        </form>
      </div>

      {aktiviteler.length === 0 ? (
        <EmptyState
          title={sekme === "bugun" ? "Bugün için iş yok" : "Kayıt bulunamadı"}
          description={
            sekme === "bugun"
              ? "Vadesi bugün ya da daha önce olan açık göreviniz yok."
              : "Filtreleri değiştirin ya da yeni bir aktivite ekleyin."
          }
        />
      ) : (
        <div className="card divide-y divide-border/50">
          {aktiviteler.map((a) => {
            const Ikon = IKONLAR[a.tur] ?? StickyNote;
            const gorev = Boolean(a.sonTarih);
            const gecikmis = gorev && !a.tamamlandi && a.sonTarih! < bugunBasi;

            return (
              <div key={a.id} className="flex flex-wrap items-start gap-3 p-4">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    a.tamamlandi
                      ? "bg-emerald-500/10 text-emerald-500"
                      : gecikmis
                        ? "bg-rose-500/10 text-rose-400"
                        : "bg-primary/10 text-primary"
                  }`}
                >
                  <Ikon className="h-4 w-4" />
                </div>

                <div className="min-w-[200px] flex-1">
                  <p
                    className={`font-medium ${
                      a.tamamlandi ? "text-muted-foreground line-through" : "text-foreground"
                    }`}
                  >
                    {a.baslik}
                  </p>
                  {a.aciklama && (
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">
                      {a.aciklama}
                    </p>
                  )}
                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground/80">
                    <span>{TUR_ETIKET[a.tur] ?? a.tur}</span>
                    {a.firma && (
                      <>
                        <span>·</span>
                        <Link href={`/firmalar/${a.firma.id}`} className="hover:text-primary">
                          {a.firma.ad}
                        </Link>
                      </>
                    )}
                    {a.kisi && (
                      <>
                        <span>·</span>
                        <span>{a.kisi.ad}</span>
                      </>
                    )}
                    {a.firsat && (
                      <>
                        <span>·</span>
                        <span>{a.firsat.baslik}</span>
                      </>
                    )}
                    {a.atananId && (
                      <>
                        <span>·</span>
                        <span>{kullaniciAdi.get(a.atananId) ?? "—"}</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {gorev && (
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        a.tamamlandi
                          ? "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25"
                          : gecikmis
                            ? "bg-rose-500/15 text-rose-400 ring-rose-500/25"
                            : "bg-amber-500/15 text-amber-400 ring-amber-500/25"
                      }`}
                    >
                      {a.tamamlandi
                        ? `Tamamlandı ${formatTarih(a.tamamlandi)}`
                        : `${gecikmis ? "Gecikti" : "Son"} ${formatTarih(a.sonTarih!)}`}
                    </span>
                  )}

                  {duzenleyebilir && (
                    <AktivitePanel
                      kullanicilar={kullanicilar}
                      firmalar={firmalar}
                      mevcut={{
                        id: a.id,
                        tur: a.tur,
                        baslik: a.baslik,
                        aciklama: a.aciklama ?? "",
                        firmaId: a.firmaId ?? "",
                        kisiId: a.kisiId ?? "",
                        firsatId: a.firsatId ?? "",
                        atananId: a.atananId ?? "",
                        sonTarih: a.sonTarih ? toDateInput(a.sonTarih) : "",
                      }}
                    />
                  )}

                  <AktiviteIslemleri
                    id={a.id}
                    baslik={a.baslik}
                    tamamlandi={Boolean(a.tamamlandi)}
                    gorev={gorev}
                    duzenleyebilir={duzenleyebilir}
                    silebilir={silebilir}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
