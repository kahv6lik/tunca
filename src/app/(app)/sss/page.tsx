import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { metinArama } from "@/lib/arama";
import { kategorileriTopla, etiketleriTopla, etiketMetni } from "@/lib/sss-tanimlar";
import SssPanel from "@/components/sss/SssPanel";
import SssKarti from "@/components/sss/SssKarti";
import DeleteButton from "@/components/DeleteButton";
import { sssSil } from "./actions";

export const dynamic = "force-dynamic";

/**
 * SSS — sık sorulan sorular / bilgi bankası (Faz 16 / P4).
 *
 * Arama Türkçe duyarsızdır (`metinArama`): "ıade" yazan "İADE"yi de bulur —
 * PostgreSQL'in ASCII eşlemesi tek başına bunu yapmaz (Faz 13 / H2).
 *
 * PASİF kayıtlar yalnızca YÖNETİCİYE görünür: arşivlenmiş bir yanıt destek
 * ekibine doğruymuş gibi sunulmamalı, ama tanımı yapan kişi onu bulabilmeli.
 */
export default async function SssPage(props: {
  searchParams: Promise<{ ara?: string; kategori?: string; etiket?: string }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.sssGoruntule);
  const yonetir = await yetkiVarMi(IZIN.sssYonet);

  const db = await getTenantDb();
  const ara = (searchParams.ara ?? "").trim();
  const kategori = (searchParams.kategori ?? "").trim();
  const etiket = (searchParams.etiket ?? "").trim();

  const where: Prisma.SssWhereInput = {
    AND: [
      yonetir ? {} : { durum: "aktif" },
      ara ? { OR: metinArama<Prisma.SssWhereInput>(ara, ["soru", "yanit", "kategori"]) } : {},
      kategori ? { kategori } : {},
      etiket ? { etiketler: { has: etiket } } : {},
    ],
  };

  // Kategori ve etiket süzgeçleri TÜM kayıtlardan çıkarılır; süzgeç sonucundan
  // çıkarılsaydı bir kategoriyi seçtikten sonra diğerleri kaybolurdu.
  const [kayitlar, hepsi] = await Promise.all([
    db.sss.findMany({ where, orderBy: [{ sira: "asc" }, { soru: "asc" }] }),
    db.sss.findMany({
      where: yonetir ? {} : { durum: "aktif" },
      select: { kategori: true, etiketler: true },
    }),
  ]);

  const kategoriler = kategorileriTopla(hepsi);
  const etiketler = etiketleriTopla(hepsi).slice(0, 20);
  const filtreVar = Boolean(ara || kategori || etiket);

  function baglanti(ek: Record<string, string>) {
    const p = new URLSearchParams();
    if (ara) p.set("ara", ara);
    if (kategori) p.set("kategori", kategori);
    if (etiket) p.set("etiket", etiket);
    for (const [a, d] of Object.entries(ek)) {
      if (d) p.set(a, d);
      else p.delete(a);
    }
    const q = p.toString();
    return q ? `/sss?${q}` : "/sss";
  }

  return (
    <div>
      <PageHeader
        title="Sık Sorulan Sorular"
        subtitle={`${kayitlar.length} kayıt`}
        action={yonetir ? <SssPanel kategoriler={kategoriler} /> : undefined}
      />

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="ara">Ara</label>
          <input
            id="ara"
            name="ara"
            defaultValue={ara}
            placeholder="Soru ya da yanıt içinde ara…"
            className="input"
          />
        </div>
        <div className="w-52">
          <label className="label" htmlFor="kategori">Kategori</label>
          <select id="kategori" name="kategori" defaultValue={kategori} className="input">
            <option value="">Tümü</option>
            {kategoriler.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        {etiket && <input type="hidden" name="etiket" value={etiket} />}
        <button type="submit" className="btn-primary">Ara</button>
        {filtreVar && <Link href="/sss" className="btn-secondary">Temizle</Link>}
      </form>

      {etiketler.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Etiketler:</span>
          {etiketler.map((e) => (
            <Link
              key={e.etiket}
              href={e.etiket === etiket ? baglanti({ etiket: "" }) : baglanti({ etiket: e.etiket })}
              className={`rounded-lg border px-2 py-1 transition-colors ${
                e.etiket === etiket
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              #{e.etiket} <span className="opacity-60">{e.adet}</span>
            </Link>
          ))}
        </div>
      )}

      {kayitlar.length === 0 ? (
        <EmptyState
          title="Kayıt bulunamadı"
          description="Destek ekibinin sık verdiği yanıtlar burada toplanır; aynı soruya her seferinde yeniden cevap yazmak gerekmez."
          action={yonetir ? <SssPanel kategoriler={kategoriler} /> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {kayitlar.map((s) => (
            <SssKarti
              key={s.id}
              id={s.id}
              soru={s.soru}
              yanit={s.yanit}
              kategori={s.kategori}
              etiketler={s.etiketler}
              goruntulenme={s.goruntulenme}
              pasif={s.durum !== "aktif"}
              duzenle={
                yonetir ? (
                  <SssPanel
                    kategoriler={kategoriler}
                    mevcut={{
                      id: s.id,
                      soru: s.soru,
                      yanit: s.yanit,
                      kategori: s.kategori ?? "",
                      etiketler: etiketMetni(s.etiketler),
                      durum: s.durum,
                      sira: s.sira,
                    }}
                  />
                ) : undefined
              }
              sil={
                yonetir ? (
                  <DeleteButton
                    action={sssSil.bind(null, s.id)}
                    label="Sil"
                    confirmText="Bu soru silinsin mi?"
                  />
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
