import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import AddPanel from "@/components/AddPanel";
import DeleteButton from "@/components/DeleteButton";
import EditRecordDialog from "@/components/edit-record-dialog";
import type { Field } from "@/components/RecordForm";
import { formatPara, formatTarih, toDateInput } from "@/lib/format";
import { deleteFirma } from "../actions";
import { createYatirim, updateYatirim, deleteYatirim } from "../../yatirim-destekleri/actions";
import { createEgitim, updateEgitim, deleteEgitim } from "../../egitimler/actions";
import { createHizmet, updateHizmet, deleteHizmet } from "../../hizmetler/actions";

export const dynamic = "force-dynamic";

export default async function FirmaDetayPage({
  params,
}: {
  params: { id: string };
}) {
  await yetkiGerektir(IZIN.firmaGoruntule);

  // Yetkiler — arayüzde yalnızca yapılabilecek işlemler gösterilir.
  // (Asıl koruma action'ların içindedir; burası kolaylık.)
  const [
    firmaDuzenlaybilir, firmaSilebilir,
    yatirimEkler, yatirimDuzenler, yatirimSiler,
    egitimEkler, egitimDuzenler, egitimSiler,
    hizmetEkler, hizmetDuzenler, hizmetSiler,
  ] = await Promise.all([
    yetkiVarMi(IZIN.firmaDuzenle), yetkiVarMi(IZIN.firmaSil),
    yetkiVarMi(IZIN.yatirimOlustur), yetkiVarMi(IZIN.yatirimDuzenle), yetkiVarMi(IZIN.yatirimSil),
    yetkiVarMi(IZIN.egitimOlustur), yetkiVarMi(IZIN.egitimDuzenle), yetkiVarMi(IZIN.egitimSil),
    yetkiVarMi(IZIN.hizmetOlustur), yetkiVarMi(IZIN.hizmetDuzenle), yetkiVarMi(IZIN.hizmetSil),
  ]);

  const db = await getTenantDb();

  // findFirst kullanılır: kiracı katmanı where'e tenantId ekler, böylece
  // başka kiracının firma ID'si ile gelen istek kayıt bulamaz (A3).
  const firma = await db.firma.findFirst({
    where: { id: params.id },
    include: {
      yatirimlar: { orderBy: { tarih: "desc" } },
      egitimler: { orderBy: { tarih: "desc" } },
      hizmetler: { orderBy: { tarih: "desc" } },
    },
  });

  if (!firma) notFound();

  const bugun = toDateInput(new Date());

  const toplamOnayliYatirim = firma.yatirimlar
    .filter((y) => ["onaylandi", "tamamlandi"].includes(y.durum) && y.paraBirimi === "TRY")
    .reduce((s, y) => s + y.tutar, 0);

  const yatirimFields: Field[] = [
    { name: "baslik", label: "Başlık", required: true, colSpan: 2 },
    {
      name: "tur",
      label: "Tür",
      type: "select",
      allowOther: true,
      options: ["Hibe", "Teşvik", "Kredi", "Diğer"].map((x) => ({ value: x, label: x })),
    },
    { name: "tutar", label: "Tutar", type: "number", step: "0.01", defaultValue: 0 },
    {
      name: "paraBirimi",
      label: "Para Birimi",
      type: "select",
      options: ["TRY", "USD", "EUR"].map((x) => ({ value: x, label: x })),
    },
    { name: "tarih", label: "Tarih", type: "date", required: true, defaultValue: bugun },
    {
      name: "durum",
      label: "Durum",
      type: "select",
      options: [
        { value: "basvuruldu", label: "Başvuruldu" },
        { value: "onaylandi", label: "Onaylandı" },
        { value: "reddedildi", label: "Reddedildi" },
        { value: "tamamlandi", label: "Tamamlandı" },
      ],
    },
    { name: "aciklama", label: "Açıklama", type: "textarea", colSpan: 2 },
  ];

  const egitimFields: Field[] = [
    { name: "baslik", label: "Başlık", required: true, colSpan: 2 },
    { name: "konu", label: "Konu" },
    { name: "egitmen", label: "Eğitmen" },
    { name: "tarih", label: "Tarih", type: "date", required: true, defaultValue: bugun },
    { name: "sureSaat", label: "Süre (saat)", type: "number", step: "0.5", defaultValue: 0 },
    { name: "katilimci", label: "Katılımcı Sayısı", type: "number", defaultValue: 0 },
    {
      name: "durum",
      label: "Durum",
      type: "select",
      options: [
        { value: "planlandi", label: "Planlandı" },
        { value: "tamamlandi", label: "Tamamlandı" },
        { value: "iptal", label: "İptal" },
      ],
    },
    { name: "notlar", label: "Notlar", type: "textarea", colSpan: 2 },
  ];

  const hizmetFields: Field[] = [
    { name: "baslik", label: "Başlık", required: true, colSpan: 2 },
    {
      name: "tur",
      label: "Tür",
      type: "select",
      allowOther: true,
      options: ["Danışmanlık", "Denetim", "Raporlama", "Eğitim", "Diğer"].map((x) => ({
        value: x,
        label: x,
      })),
    },
    { name: "tarih", label: "Tarih", type: "date", required: true, defaultValue: bugun },
    {
      name: "durum",
      label: "Durum",
      type: "select",
      options: [
        { value: "devam", label: "Devam Ediyor" },
        { value: "tamamlandi", label: "Tamamlandı" },
        { value: "iptal", label: "İptal" },
      ],
    },
    { name: "aciklama", label: "Açıklama", type: "textarea", colSpan: 2 },
  ];

  return (
    <div>
      <div className="mb-4">
        <Link href="/firmalar" className="text-sm text-primary hover:underline">
          ← Firmalar
        </Link>
      </div>

      <PageHeader
        title={firma.ad}
        subtitle={[firma.sektor, firma.il].filter(Boolean).join(" · ") || undefined}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge durum={firma.durum} />
            {firmaDuzenlaybilir && (
              <Link href={`/firmalar/${firma.id}/duzenle`} className="btn-secondary text-sm">
                Düzenle
              </Link>
            )}
            {firmaSilebilir && (
              <DeleteButton
                action={deleteFirma.bind(null, firma.id)}
                label="Firmayı Sil"
                confirmText="Bu firmayı ve tüm kayıtlarını silmek istediğinize emin misiniz?"
              />
            )}
          </div>
        }
      />

      {/* Firma bilgileri */}
      <div className="card mb-6 p-6">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Vergi No" value={firma.vergiNo} />
          <Info label="Sektör" value={firma.sektor} />
          <Info label="İl / İlçe" value={[firma.il, firma.ilce].filter(Boolean).join(" / ")} />
          <Info label="Yetkili Kişi" value={firma.yetkiliAd} />
          <Info label="Telefon" value={firma.telefon} />
          <Info label="E-posta" value={firma.email} />
          <Info label="Adres" value={firma.adres} />
          <Info label="Onaylı Yatırım (TRY)" value={formatPara(toplamOnayliYatirim)} />
        </dl>
        {firma.notlar && (
          <div className="mt-4 border-t border-border/50 pt-4">
            <p className="text-xs font-medium uppercase text-muted-foreground/70">Notlar</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{firma.notlar}</p>
          </div>
        )}
      </div>

      {/* Yatırım Destekleri */}
      <Section
        title="Yatırım Destekleri"
        count={firma.yatirimlar.length}
        addPanel={
          yatirimEkler ? (
          <AddPanel
            buttonLabel="Yatırım Desteği Ekle"
            action={createYatirim}
            fields={yatirimFields}
            hidden={{ firmaId: firma.id }}
          />
          ) : null
        }
      >
        {firma.yatirimlar.length === 0 ? (
          <Empty />
        ) : (
          <TableWrap
            head={["Başlık", "Tür", "Tutar", "Tarih", "Durum", "İşlem"]}
            rows={firma.yatirimlar.map((y) => (
              <tr key={y.id} className="hover:bg-muted/40">
                <td className="td font-medium">{y.baslik}</td>
                <td className="td">{y.tur ?? "—"}</td>
                <td className="td">{formatPara(y.tutar, y.paraBirimi)}</td>
                <td className="td">{formatTarih(y.tarih)}</td>
                <td className="td"><StatusBadge durum={y.durum} /></td>
                <td className="td text-right">
                  <div className="flex items-center justify-end gap-1">
                    {yatirimDuzenler && (
<EditRecordDialog
                      title="Yatırım Desteğini Düzenle"
                      fields={yatirimFields}
                      hidden={{ firmaId: firma.id }}
                      action={updateYatirim.bind(null, y.id)}
                      values={{
                        baslik: y.baslik,
                        tur: y.tur ?? "",
                        tutar: y.tutar,
                        paraBirimi: y.paraBirimi,
                        tarih: toDateInput(y.tarih),
                        durum: y.durum,
                        aciklama: y.aciklama ?? "",
                      }}
                    />
                    )}
                    {yatirimSiler && (
                      <DeleteButton action={deleteYatirim.bind(null, y.id, firma.id)} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          />
        )}
      </Section>

      {/* Eğitimler */}
      <Section
        title="Eğitimler"
        count={firma.egitimler.length}
        addPanel={
          egitimEkler ? (
          <AddPanel
            buttonLabel="Eğitim Ekle"
            action={createEgitim}
            fields={egitimFields}
            hidden={{ firmaId: firma.id }}
          />
          ) : null
        }
      >
        {firma.egitimler.length === 0 ? (
          <Empty />
        ) : (
          <TableWrap
            head={["Başlık", "Konu", "Eğitmen", "Tarih", "Süre", "Katılımcı", "Durum", "İşlem"]}
            rows={firma.egitimler.map((e) => (
              <tr key={e.id} className="hover:bg-muted/40">
                <td className="td font-medium">{e.baslik}</td>
                <td className="td">{e.konu ?? "—"}</td>
                <td className="td">{e.egitmen ?? "—"}</td>
                <td className="td">{formatTarih(e.tarih)}</td>
                <td className="td">{e.sureSaat} s</td>
                <td className="td">{e.katilimci}</td>
                <td className="td"><StatusBadge durum={e.durum} /></td>
                <td className="td text-right">
                  <div className="flex items-center justify-end gap-1">
                    {egitimDuzenler && (
<EditRecordDialog
                      title="Eğitimi Düzenle"
                      fields={egitimFields}
                      hidden={{ firmaId: firma.id }}
                      action={updateEgitim.bind(null, e.id)}
                      values={{
                        baslik: e.baslik,
                        konu: e.konu ?? "",
                        egitmen: e.egitmen ?? "",
                        tarih: toDateInput(e.tarih),
                        sureSaat: e.sureSaat,
                        katilimci: e.katilimci,
                        durum: e.durum,
                        notlar: e.notlar ?? "",
                      }}
                    />
                    )}
                    {egitimSiler && (
                      <DeleteButton action={deleteEgitim.bind(null, e.id, firma.id)} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          />
        )}
      </Section>

      {/* Hizmetler */}
      <Section
        title="Hizmetler"
        count={firma.hizmetler.length}
        addPanel={
          hizmetEkler ? (
          <AddPanel
            buttonLabel="Hizmet Ekle"
            action={createHizmet}
            fields={hizmetFields}
            hidden={{ firmaId: firma.id }}
          />
          ) : null
        }
      >
        {firma.hizmetler.length === 0 ? (
          <Empty />
        ) : (
          <TableWrap
            head={["Başlık", "Tür", "Tarih", "Durum", "İşlem"]}
            rows={firma.hizmetler.map((h) => (
              <tr key={h.id} className="hover:bg-muted/40">
                <td className="td font-medium">{h.baslik}</td>
                <td className="td">{h.tur ?? "—"}</td>
                <td className="td">{formatTarih(h.tarih)}</td>
                <td className="td"><StatusBadge durum={h.durum} /></td>
                <td className="td text-right">
                  <div className="flex items-center justify-end gap-1">
                    {hizmetDuzenler && (
<EditRecordDialog
                      title="Hizmeti Düzenle"
                      fields={hizmetFields}
                      hidden={{ firmaId: firma.id }}
                      action={updateHizmet.bind(null, h.id)}
                      values={{
                        baslik: h.baslik,
                        tur: h.tur ?? "",
                        tarih: toDateInput(h.tarih),
                        durum: h.durum,
                        aciklama: h.aciklama ?? "",
                      }}
                    />
                    )}
                    {hizmetSiler && (
                      <DeleteButton action={deleteHizmet.bind(null, h.id, firma.id)} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          />
        )}
      </Section>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-muted-foreground/70">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}

function Section({
  title,
  count,
  addPanel,
  children,
}: {
  title: string;
  count: number;
  addPanel: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card mb-6 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-foreground">
          {title} <span className="text-muted-foreground/70">({count})</span>
        </h2>
      </div>
      <div className="mb-4">{addPanel}</div>
      {children}
    </div>
  );
}

function TableWrap({ head, rows }: { head: string[]; rows: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border/60">
        <thead className="bg-muted/30">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="th">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">{rows}</tbody>
      </table>
    </div>
  );
}

function Empty() {
  return <p className="py-4 text-center text-sm text-muted-foreground/70">Henüz kayıt yok.</p>;
}
