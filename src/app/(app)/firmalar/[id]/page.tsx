import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import AddPanel from "@/components/AddPanel";
import DeleteButton from "@/components/DeleteButton";
import EditRecordDialog from "@/components/edit-record-dialog";
import type { Field } from "@/components/RecordForm";
import { formatPara, formatTarih, toDateInput } from "@/lib/format";
import { DEPARTMANLAR } from "@/lib/constants";
import { deleteFirma } from "../actions";
import { createYatirim, updateYatirim, deleteYatirim } from "../../yatirim-destekleri/actions";
import { createEgitim, updateEgitim, deleteEgitim } from "../../egitimler/actions";
import { createHizmet, updateHizmet, deleteHizmet } from "../../hizmetler/actions";
import { createKisi, updateKisi, deleteKisi } from "../../kisiler/actions";
import { deleteFirsat } from "../../firsatlar/actions";
import FirsatPanel from "@/components/firsatlar/FirsatPanel";
import { Star, Plus, FileText } from "lucide-react";
import { etkinIzinler } from "@/lib/yetki";
import { firmaTimeline } from "@/lib/timeline";
import { Timeline } from "@/components/firmalar/Timeline";
import EkPaneli from "@/components/ekler/EkPaneli";
import { haritaBaglantisi } from "@/lib/konum-saf";
import ZiyaretBaslat from "@/components/ziyaretler/ZiyaretBaslat";
import { MapPin } from "lucide-react";
import AktivitePanel from "@/components/aktiviteler/AktivitePanel";
import FirmaSekmeleri from "@/components/firmalar/FirmaSekmeleri";
import OncelikRozet from "@/components/destek/OncelikRozet";
import { sekmeSec } from "@/lib/firma-sekme-tanimlar";
import FirmaOzetPaneli from "@/components/ai/FirmaOzetPaneli";
import { firmaOzetSatirlari } from "@/lib/firma-ozet";
import { aiDurumu } from "@/lib/ai";
import { aiKapaliSebebi, aiKullanilabilir } from "@/lib/ai-tanimlar";
import {
  alanlariGetir,
  degerHaritasi,
  topluDegerHaritasi,
  degerBicimle,
  alanFieldTanimi,
  ozelAlanGirdiAdi,
} from "@/lib/ozel-alan";

export const dynamic = "force-dynamic";

/**
 * Firma çalışma ekranı — Faz 20 / U3.
 *
 * Eskiden bu sayfa firmanın HER modülünü tek uzun kolonda alt alta
 * çiziyordu; kullanıcı kontaklara bakmak için siparişlerin yanından
 * geçiyordu ve sayfa, bakılmayan her modülü de sorguluyordu.
 *
 * Artık sekmelidir (`?sekme=`) ve SEKME BİR SORGU KAPISIDIR: seçilmeyen
 * sekmenin sorgusu hiç çalışmaz. Hiçbir bölüm kaldırılmadı, yalnızca
 * gruplandı; ayrıca firmanın Faz 15/16/17 modülleri (sipariş, proje,
 * destek, ziyaret) ilk kez bu ekrana bağlandı.
 */
export default async function FirmaDetayPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const params = await props.params;
  const aramaParam = await props.searchParams;
  await yetkiGerektir(IZIN.firmaGoruntule);

  // Sekme, sorguların hangisinin çalışacağını belirlediği için EN BAŞTA
  // çözülür. Geçersiz/izinsiz değer sessizce "genel"e düşer.
  const izinler = await etkinIzinler();
  const sekme = sekmeSec(
    typeof aramaParam.sekme === "string" ? aramaParam.sekme : undefined,
    izinler
  );

  // Yetkiler — arayüzde yalnızca yapılabilecek işlemler gösterilir.
  // (Asıl koruma action'ların içindedir; burası kolaylık.)
  const [
    firmaDuzenlaybilir, firmaSilebilir,
    yatirimEkler, yatirimDuzenler, yatirimSiler,
    egitimEkler, egitimDuzenler, egitimSiler,
    hizmetEkler, hizmetDuzenler, hizmetSiler,
    kisiEkler, kisiDuzenler, kisiSiler,
    firsatEkler, firsatDuzenler, firsatSiler, firsatGorur,
    aktiviteEkler, teklifGorur, teklifEkler,
  ] = await Promise.all([
    yetkiVarMi(IZIN.firmaDuzenle), yetkiVarMi(IZIN.firmaSil),
    yetkiVarMi(IZIN.yatirimOlustur), yetkiVarMi(IZIN.yatirimDuzenle), yetkiVarMi(IZIN.yatirimSil),
    yetkiVarMi(IZIN.egitimOlustur), yetkiVarMi(IZIN.egitimDuzenle), yetkiVarMi(IZIN.egitimSil),
    yetkiVarMi(IZIN.hizmetOlustur), yetkiVarMi(IZIN.hizmetDuzenle), yetkiVarMi(IZIN.hizmetSil),
    yetkiVarMi(IZIN.kisiOlustur), yetkiVarMi(IZIN.kisiDuzenle), yetkiVarMi(IZIN.kisiSil),
    yetkiVarMi(IZIN.firsatOlustur), yetkiVarMi(IZIN.firsatDuzenle), yetkiVarMi(IZIN.firsatSil),
    yetkiVarMi(IZIN.firsatGoruntule),
    yetkiVarMi(IZIN.aktiviteOlustur),
    yetkiVarMi(IZIN.teklifGoruntule),
    yetkiVarMi(IZIN.teklifOlustur),
  ]);

  const { db, session } = await getTenantContext();

  // findFirst kullanılır: kiracı katmanı where'e tenantId ekler, böylece
  // başka kiracının firma ID'si ile gelen istek kayıt bulamaz (A3).
  // Kişiler her sekmede gerekir: künyedeki birincil kişi, aktivite/fırsat
  // panellerinin muhatap listesi ve destek kaydı formu hepsi onu okur.
  const firma = await db.firma.findFirst({
    where: { id: params.id },
    include: {
      kisiler: { orderBy: [{ birincil: "desc" }, { ad: "asc" }] },
      _count: {
        select: {
          yatirimlar: true,
          egitimler: true,
          hizmetler: true,
          firsatlar: true,
          teklifler: true,
          kisiler: true,
          Siparis: true,
          Proje: true,
          DestekKaydi: true,
          Dosya: true,
        },
      },
    },
  });

  if (!firma) notFound();

  // ── Sekmeye bağlı sorgular ────────────────────────────────────────────
  // Kural: seçilmeyen sekme HİÇ sorgulanmaz. İzin süzgeci de aynı yerde
  // uygulanır — izni olmayan modül, sekmesi açık olsa bile sorgulanmaz.
  const [yatirimlar, egitimler, hizmetler] =
    sekme === "kayit"
      ? await Promise.all([
          db.yatirimDestegi.findMany({
            where: { firmaId: firma.id },
            orderBy: { tarih: "desc" },
          }),
          db.egitim.findMany({
            where: { firmaId: firma.id },
            orderBy: { tarih: "desc" },
          }),
          db.hizmet.findMany({
            where: { firmaId: firma.id },
            orderBy: { tarih: "desc" },
          }),
        ])
      : [[], [], []];

  const firsatlar =
    sekme === "satis" && firsatGorur
      ? await db.firsat.findMany({
          where: { firmaId: firma.id },
          orderBy: { createdAt: "desc" },
          include: {
            asama: { select: { ad: true, renk: true } },
            kisi: { select: { ad: true } },
          },
        })
      : [];

  // Genel sekmesindeki aktivite panelinin fırsat seçicisi — ağır sorguya
  // gerek yok, yalnızca ad/id.
  const firsatSecenekleri =
    sekme === "genel" && firsatGorur
      ? await db.firsat.findMany({
          where: { firmaId: firma.id },
          orderBy: { createdAt: "desc" },
          select: { id: true, baslik: true },
        })
      : [];

  // Onaylı yatırım toplamı künyede durur (Genel sekmesi) ve tek satırlık bir
  // toplamadır; bütün yatırım kayıtlarını çekmek gerekmez.
  const yatirimToplami =
    sekme === "genel"
      ? await db.yatirimDestegi.aggregate({
          _sum: { tutar: true },
          where: {
            firmaId: firma.id,
            durum: { in: ["onaylandi", "tamamlandi"] },
            paraBirimi: "TRY",
          },
        })
      : null;
  const toplamOnayliYatirim = yatirimToplami?._sum.tutar ?? 0;

  // Fırsat panelinin ihtiyaç duyduğu seçenekler — yalnızca panelin çizildiği
  // sekmelerde. Aşama ve kullanıcı listesi Genel'de aktivite paneli, Satış'ta
  // fırsat paneli için gerekir.
  const panelSekmesi = sekme === "genel" || sekme === "satis";
  const [asamalar, kullanicilar] = panelSekmesi
    ? await Promise.all([
        firsatGorur
          ? db.asama.findMany({
              orderBy: { sira: "asc" },
              select: { id: true, ad: true, olasilik: true },
            })
          : Promise.resolve([]),
        db.user.findMany({
          where: { durum: "aktif" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
      ])
    : [[], []];

  const ekGorur = izinler.has(IZIN.dosyaGoruntule);
  const ziyaretGorur = izinler.has(IZIN.ziyaretGoruntule);
  const ziyaretAcabilir = izinler.has(IZIN.ziyaretOlustur);
  const siparisGorur = izinler.has(IZIN.siparisGoruntule);
  const projeGorur = izinler.has(IZIN.projeGoruntule);
  const destekGorur = izinler.has(IZIN.destekGoruntule);

  // Açık ziyaret varsa ikinci bir ziyaret açtırılmaz (kural action'da da var).
  const acikZiyaret =
    ziyaretAcabilir && (sekme === "genel" || sekme === "belge")
      ? await db.ziyaret.findFirst({
          where: { kullaniciId: session.userId, bitis: null },
          select: { id: true },
        })
      : null;

  // Zaman akışı (Faz 7 / C6) — izni olmayan modül hiç sorgulanmaz.
  const akis =
    sekme === "genel" ? await firmaTimeline(db, firma.id, izinler) : [];

  /*
    Firma özeti (Faz 21 / G2).

    Maddeler VERİDEN üretilir ve model olmadan da görünür; AI yalnızca
    kullanıcı "paragraf hâline getir" derse çağrılır. İzin süzgeci
    `firmaOzetSatirlari` içindedir — göremediği modül özete girmez.
  */
  const ozetGorur = sekme === "genel" && izinler.has(IZIN.aiKullan);
  const ozetSatirlariListesi = ozetGorur
    ? await firmaOzetSatirlari(db, firma, izinler)
    : [];
  const aiHali = ozetGorur ? await aiDurumu() : null;

  const [teklifler, siparisler] =
    sekme === "satis"
      ? await Promise.all([
          teklifGorur
            ? db.teklif.findMany({
                where: { firmaId: firma.id },
                orderBy: { createdAt: "desc" },
                select: {
                  id: true, no: true, baslik: true, durum: true, toplam: true,
                  paraBirimi: true, revizyonNo: true, gecerlilikTarihi: true,
                },
              })
            : Promise.resolve([]),
          // Siparişler (Faz 15) ilk kez firma ekranına bağlandı: satışın
          // teklifle bitmediği, siparişle sürdüğü yer burasıdır.
          siparisGorur
            ? db.siparis.findMany({
                where: { firmaId: firma.id },
                orderBy: { createdAt: "desc" },
                select: {
                  id: true, no: true, durum: true, toplam: true,
                  paraBirimi: true, createdAt: true,
                  _count: { select: { kalemler: true } },
                },
              })
            : Promise.resolve([]),
        ])
      : [[], []];

  const [projeler, destekKayitlari] =
    sekme === "destek"
      ? await Promise.all([
          projeGorur
            ? db.proje.findMany({
                where: { firmaId: firma.id },
                orderBy: { createdAt: "desc" },
                select: {
                  id: true, kod: true, ad: true, durum: true,
                  baslangic: true, bitis: true, butce: true, paraBirimi: true,
                },
              })
            : Promise.resolve([]),
          destekGorur
            ? db.destekKaydi.findMany({
                where: { firmaId: firma.id },
                orderBy: [{ durum: "asc" }, { createdAt: "desc" }],
                select: {
                  id: true, no: true, baslik: true, durum: true,
                  oncelik: true, kanal: true, createdAt: true,
                },
              })
            : Promise.resolve([]),
        ])
      : [[], []];

  // Firmaya ait belgeler (Faz 17 / A1) ve ziyaret geçmişi — izin yoksa sorgu
  // hiç çalışmaz.
  const [ekler, ziyaretler] =
    sekme === "belge"
      ? await Promise.all([
          ekGorur
            ? db.dosya.findMany({
                where: { firmaId: firma.id },
                orderBy: { createdAt: "desc" },
              })
            : Promise.resolve([]),
          ziyaretGorur
            ? db.ziyaret.findMany({
                where: { firmaId: firma.id },
                orderBy: { baslangic: "desc" },
                take: 20,
                select: {
                  id: true, baslangic: true, bitis: true, sureDakika: true,
                  dogrulama: true, mesafeM: true, not: true,
                },
              })
            : Promise.resolve([]),
        ])
      : [[], []];

  // Kiracıya özel alanlar (Faz 11 / E6): tanımlar + bu sayfadaki kayıtların
  // değerleri. Paket modülü kapalıysa alanlariGetir boş döner ve hiçbir ek
  // sorgu/giriş üretilmez.
  const [firmaAlanlari, kisiAlanlari, firsatAlanlari] = await Promise.all([
    alanlariGetir("firma"),
    alanlariGetir("kisi"),
    alanlariGetir("firsat"),
  ]);
  const [firmaOzel, kisiOzel, firsatOzel] = await Promise.all([
    firmaAlanlari.length > 0
      ? degerHaritasi(db, "firma", firma.id)
      : Promise.resolve(new Map<string, string>()),
    kisiAlanlari.length > 0
      ? topluDegerHaritasi(db, "kisi", firma.kisiler.map((k) => k.id))
      : Promise.resolve(new Map<string, Map<string, string>>()),
    firsatAlanlari.length > 0 && firsatlar.length > 0
      ? topluDegerHaritasi(db, "firsat", firsatlar.map((f) => f.id))
      : Promise.resolve(new Map<string, Map<string, string>>()),
  ]);

  const bugun = toDateInput(new Date());

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

  const kisiFields: Field[] = [
    { name: "ad", label: "Ad Soyad", required: true },
    { name: "unvan", label: "Unvan / Görev" },
    // Departman SABİT listeden seçilir (raporlanabilirlik için); unvan
    // serbest metin olarak kalır — kişinin kendi tanımı oradadır.
    {
      name: "departman",
      label: "Departman",
      type: "arama-secim",
      placeholder: "Departman seçin…",
      options: DEPARTMANLAR.map((d) => ({ value: d, label: d })),
    },
    { name: "telefon", label: "Telefon" },
    { name: "email", label: "E-posta" },
    {
      name: "birincil",
      label: "Birincil Kişi",
      type: "select",
      options: [
        { value: "0", label: "Hayır" },
        { value: "1", label: "Evet" },
      ],
    },
    { name: "notlar", label: "Notlar", type: "textarea", colSpan: 2 },
    // Kiracıya özel kişi alanları (Faz 11) — RecordForm'a ek girişler.
    ...kisiAlanlari.map((a) => alanFieldTanimi(a) as Field),
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
        subtitle={
          [firma.firmaNo, firma.sektor, firma.il].filter(Boolean).join(" · ") ||
          undefined
        }
        action={
          <div className="flex items-center gap-2">
            <StatusBadge durum={firma.durum} />
            {/* Firma dosyası (Faz 18 / R4) — tek belgede her şey. İçerik
                kullanıcının izinleriyle sınırlıdır. */}
            <Link
              href={`/firmalar/${firma.id}/dosya`}
              className="btn-secondary text-sm"
            >
              <FileText className="h-4 w-4" /> Dosya (PDF)
            </Link>
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

      {/* Sekmeler (Faz 20 / U3) — firma sabit, modüller değişir. */}
      <FirmaSekmeleri
        firmaId={firma.id}
        aktif={sekme}
        izinler={izinler}
        sayilar={{
          satis:
            firma._count.firsatlar + firma._count.teklifler + firma._count.Siparis,
          kontak: firma._count.kisiler,
          destek: firma._count.Proje + firma._count.DestekKaydi,
          kayit:
            firma._count.yatirimlar + firma._count.egitimler + firma._count.hizmetler,
          belge: firma._count.Dosya,
        }}
      />

      {sekme === "genel" && (
      <>
      {/* Firma bilgileri */}
      <div className="card mb-6 p-6">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Firma No (Faz 13 / H1) — oluşturmada verilir, DEĞİŞTİRİLEMEZ;
              bu yüzden düzenleme formunda karşılığı yoktur. */}
          <Info label="Firma No" value={firma.firmaNo} />
          <Info label="Vergi No" value={firma.vergiNo} />
          <Info label="Sektör" value={firma.sektor} />
          <Info label="İl / İlçe" value={[firma.il, firma.ilce].filter(Boolean).join(" / ")} />
          <Info
            label="Birincil Kişi"
            value={firma.kisiler.find((k) => k.birincil)?.ad ?? firma.yetkiliAd}
          />
          <Info label="Telefon" value={firma.telefon} />
          <Info label="E-posta" value={firma.email} />
          <Info label="Adres" value={firma.adres} />
          {/* Konum (Faz 17 / A3) — harita bağlantısı ANAHTAR GEREKTİRMEZ:
              gömülü harita her açılışta ücretli bir istek olurdu. */}
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground/70">
              Konum
            </dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {firma.enlem !== null && firma.boylam !== null ? (
                <a
                  href={haritaBaglantisi(firma.enlem, firma.boylam)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-primary"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {firma.enlem.toFixed(5)}, {firma.boylam.toFixed(5)}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <Info label="Onaylı Yatırım (TRY)" value={formatPara(toplamOnayliYatirim)} />
          {/* Kiracıya özel alanlar (Faz 11 / E6) */}
          {firmaAlanlari.map((a) => (
            <Info
              key={a.id}
              label={a.ad}
              value={degerBicimle(a, firmaOzel.get(a.id) ?? "")}
            />
          ))}
        </dl>
        {firma.notlar && (
          <div className="mt-4 border-t border-border/50 pt-4">
            <p className="text-xs font-medium uppercase text-muted-foreground/70">Notlar</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{firma.notlar}</p>
          </div>
        )}
      </div>

      {/* Özet (Faz 21 / G2) */}
      {ozetGorur && (
        <FirmaOzetPaneli
          firmaId={firma.id}
          satirlar={ozetSatirlariListesi}
          aiAcik={aiHali ? aiKullanilabilir(aiHali) : false}
          kapaliSebep={aiHali ? aiKapaliSebebi(aiHali) : null}
        />
      )}

      {/* Zaman akışı (Faz 7 / C6) */}
      <div className="card mb-6 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-foreground">
            Zaman Akışı <span className="text-muted-foreground/70">({akis.length})</span>
          </h2>
          {aktiviteEkler && (
            <AktivitePanel
              kullanicilar={kullanicilar}
              sabitFirmaId={firma.id}
              kisiler={firma.kisiler.map((k) => ({ id: k.id, ad: k.ad }))}
              firsatlar={firsatSecenekleri.map((f) => ({ id: f.id, ad: f.baslik }))}
              dugmeEtiketi="Aktivite Ekle"
            />
          )}
        </div>
        <Timeline ogeler={akis} />
      </div>

      {/* Saha ziyareti (Faz 17 / A4) — firmanın önündeyken tek dokunuş. */}
      {ziyaretAcabilir && !acikZiyaret && (
        <div className="card mt-6 p-5">
          <p className="mb-3 text-sm font-semibold text-foreground">Saha Ziyareti</p>
          <ZiyaretBaslat firmalar={[]} sabitFirmaId={firma.id} />
        </div>
      )}
      {ziyaretAcabilir && acikZiyaret && (
        <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
          Açık bir ziyaretiniz var. Yeni ziyaret açmadan önce{" "}
          <Link href="/ziyaretler" className="underline">onu bitirin</Link>.
        </p>
      )}
      </>
      )}

      {/* ── Belge & Saha sekmesi ─────────────────────────────────────────── */}
      {sekme === "belge" && (
      <>
      {/* Belgeler (Faz 17 / A1) */}
      {ekGorur && (
        <div className="card mb-6 p-5">
          <EkPaneli
            bag={{ firmaId: firma.id }}
            ekler={ekler.map((d) => ({
              id: d.id,
              ad: d.ad,
              mimeTuru: d.mimeTuru,
              boyut: d.boyut,
              yukleyen: d.yukleyenEmail,
              tarih: formatTarih(d.createdAt),
            }))}
            yukleyebilir={izinler.has(IZIN.dosyaYukle)}
            silebilir={izinler.has(IZIN.dosyaSil)}
          />
        </div>
      )}

      {/* Ziyaret geçmişi (Faz 17 / A4) — saha çalışmasının kaydı belgelerle
          aynı sekmededir: ikisi de "orada ne oldu" sorusunu yanıtlar. */}
      {ziyaretGorur && (
        <Section title="Saha Ziyaretleri" count={ziyaretler.length} addPanel={null}>
          {ziyaretler.length === 0 ? (
            <Empty />
          ) : (
            <TableWrap
              head={["Başlangıç", "Süre", "Konum", "Not"]}
              rows={ziyaretler.map((z) => (
                <tr key={z.id} className="hover:bg-muted/40">
                  <td className="td">{formatTarih(z.baslangic)}</td>
                  <td className="td">
                    {z.bitis
                      ? `${z.sureDakika ?? 0} dk`
                      : "Devam ediyor"}
                  </td>
                  <td className="td">
                    <StatusBadge durum={z.dogrulama} />
                    {z.mesafeM !== null && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {z.mesafeM} m
                      </span>
                    )}
                  </td>
                  <td className="td">{z.not ?? "—"}</td>
                </tr>
              ))}
            />
          )}
        </Section>
      )}
      </>
      )}

      {/* ── Satış sekmesi ────────────────────────────────────────────────── */}
      {sekme === "satis" && (
      <>
      {/* Teklifler (Faz 7 / C7) */}
      {teklifGorur && (
        <Section
          title="Teklifler"
          count={teklifler.length}
          addPanel={
            teklifEkler ? (
              <Link href={`/teklifler/yeni?firma=${firma.id}`} className="btn-primary">
                <Plus className="h-4 w-4" /> Teklif Hazırla
              </Link>
            ) : null
          }
        >
          {teklifler.length === 0 ? (
            <Empty />
          ) : (
            <TableWrap
              head={["No", "Başlık", "Toplam", "Geçerlilik", "Durum"]}
              rows={teklifler.map((t) => (
                <tr key={t.id} className="hover:bg-muted/40">
                  <td className="td">
                    <Link href={`/teklifler/${t.id}`} className="font-mono text-sm font-medium hover:text-primary">
                      {t.no}
                    </Link>
                    {t.revizyonNo > 1 && (
                      <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-400">
                        R{t.revizyonNo}
                      </span>
                    )}
                  </td>
                  <td className="td">{t.baslik}</td>
                  <td className="td font-medium">{formatPara(t.toplam, t.paraBirimi)}</td>
                  <td className="td">{t.gecerlilikTarihi ? formatTarih(t.gecerlilikTarihi) : "—"}</td>
                  <td className="td"><StatusBadge durum={t.durum} /></td>
                </tr>
              ))}
            />
          )}
        </Section>
      )}

      {/* Fırsatlar (Faz 6 / C2) */}
      {firsatGorur && (
        <Section
          title="Fırsatlar"
          count={firsatlar.length}
          addPanel={
            firsatEkler && asamalar.length > 0 ? (
              <FirsatPanel
                asamalar={asamalar}
                kullanicilar={kullanicilar}
                kisiler={firma.kisiler.map((k) => ({ id: k.id, ad: k.ad }))}
                sabitFirmaId={firma.id}
                ozelAlanlar={firsatAlanlari}
              />
            ) : null
          }
        >
          {firsatlar.length === 0 ? (
            <Empty />
          ) : (
            <TableWrap
              head={["Fırsat", "Aşama", "Kişi", "Tutar", "Olasılık", "Kapanış", "Durum", "İşlem"]}
              rows={firsatlar.map((f) => (
                <tr key={f.id} className="hover:bg-muted/40">
                  <td className="td font-medium">{f.baslik}</td>
                  <td className="td">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: f.asama.renk ?? "#6366f1" }}
                        aria-hidden
                      />
                      {f.asama.ad}
                    </span>
                  </td>
                  <td className="td">{f.kisi?.ad ?? "—"}</td>
                  <td className="td">{formatPara(f.tutar, f.paraBirimi)}</td>
                  <td className="td">%{f.olasilik}</td>
                  <td className="td">{f.kapanisTarihi ? formatTarih(f.kapanisTarihi) : "—"}</td>
                  <td className="td"><StatusBadge durum={f.durum} /></td>
                  <td className="td text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Fırsattan teklife geçiş (Faz 13 / H7): firma ve
                          başlık teklif formuna hazır gelir. */}
                      {teklifEkler && (
                        <Link
                          href={`/teklifler/yeni?firsat=${f.id}`}
                          className="btn-secondary h-9 px-3 text-xs"
                        >
                          Teklif Hazırla
                        </Link>
                      )}
                      {firsatDuzenler && (
                        <FirsatPanel
                          asamalar={asamalar}
                          kullanicilar={kullanicilar}
                          kisiler={firma.kisiler.map((k) => ({ id: k.id, ad: k.ad }))}
                          sabitFirmaId={firma.id}
                          ozelAlanlar={firsatAlanlari}
                          ozelDegerler={Object.fromEntries(firsatOzel.get(f.id) ?? new Map())}
                          mevcut={{
                            id: f.id,
                            firmaId: firma.id,
                            kisiId: f.kisiId ?? "",
                            asamaId: f.asamaId,
                            baslik: f.baslik,
                            tutar: f.tutar,
                            paraBirimi: f.paraBirimi,
                            olasilik: f.olasilik,
                            kapanisTarihi: f.kapanisTarihi ? toDateInput(f.kapanisTarihi) : "",
                            sorumluId: f.sorumluId ?? "",
                            durum: f.durum,
                            kapanisSebebi: f.kapanisSebebi ?? "",
                            aciklama: f.aciklama ?? "",
                          }}
                        />
                      )}
                      {firsatSiler && <DeleteButton action={deleteFirsat.bind(null, f.id, firma.id)} />}
                    </div>
                  </td>
                </tr>
              ))}
            />
          )}
        </Section>
      )}

      {/* Siparişler (Faz 15 / S1) — satış teklifte bitmez. */}
      {siparisGorur && (
        <Section title="Siparişler" count={siparisler.length} addPanel={null}>
          {siparisler.length === 0 ? (
            <Empty />
          ) : (
            <TableWrap
              head={["No", "Tarih", "Kalem", "Toplam", "Durum"]}
              rows={siparisler.map((s) => (
                <tr key={s.id} className="hover:bg-muted/40">
                  <td className="td">
                    <Link
                      href={`/siparisler/${s.id}`}
                      className="font-mono text-sm font-medium hover:text-primary"
                    >
                      {s.no}
                    </Link>
                  </td>
                  <td className="td">{formatTarih(s.createdAt)}</td>
                  <td className="td">{s._count.kalemler}</td>
                  <td className="td font-medium">{formatPara(s.toplam, s.paraBirimi)}</td>
                  <td className="td"><StatusBadge durum={s.durum} /></td>
                </tr>
              ))}
            />
          )}
        </Section>
      )}
      </>
      )}

      {/* ── Kontaklar sekmesi ────────────────────────────────────────────── */}
      {sekme === "kontak" && (
      <>
      {/* Kişiler (Faz 6 / C1) */}
      <Section
        title="Kişiler"
        count={firma.kisiler.length}
        addPanel={
          kisiEkler ? (
            <AddPanel
              buttonLabel="Kişi Ekle"
              action={createKisi}
              fields={kisiFields}
              hidden={{ firmaId: firma.id }}
            />
          ) : null
        }
      >
        {firma.kisiler.length === 0 ? (
          <Empty />
        ) : (
          <TableWrap
            head={["Ad", "Unvan", "Departman", "Telefon", "E-posta", "İşlem"]}
            rows={firma.kisiler.map((k) => (
              <tr key={k.id} className="hover:bg-muted/40">
                <td className="td font-medium">
                  <span className="flex items-center gap-1.5">
                    {k.birincil && (
                      <Star
                        className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                        aria-label="Birincil kişi"
                      />
                    )}
                    {k.ad}
                  </span>
                </td>
                <td className="td">{k.unvan ?? "—"}</td>
                <td className="td">{k.departman ?? "—"}</td>
                <td className="td">{k.telefon ?? "—"}</td>
                <td className="td">{k.email ?? "—"}</td>
                <td className="td text-right">
                  <div className="flex items-center justify-end gap-1">
                    {kisiDuzenler && (
                      <EditRecordDialog
                        title="Kişiyi Düzenle"
                        fields={kisiFields}
                        hidden={{ firmaId: firma.id }}
                        action={updateKisi.bind(null, k.id)}
                        values={{
                          ad: k.ad,
                          unvan: k.unvan ?? "",
                          telefon: k.telefon ?? "",
                          email: k.email ?? "",
                          departman: k.departman ?? "",
                          birincil: k.birincil ? "1" : "0",
                          notlar: k.notlar ?? "",
                          ...Object.fromEntries(
                            kisiAlanlari.map((a) => [
                              ozelAlanGirdiAdi(a.id),
                              kisiOzel.get(k.id)?.get(a.id) ?? "",
                            ])
                          ),
                        }}
                      />
                    )}
                    {kisiSiler && <DeleteButton action={deleteKisi.bind(null, k.id, firma.id)} />}
                  </div>
                </td>
              </tr>
            ))}
          />
        )}
      </Section>
      </>
      )}

      {/* ── Destek/Eğitim/Hizmet sekmesi ─────────────────────────────────── */}
      {sekme === "kayit" && (
      <>
      {/* Yatırım Destekleri */}
      <Section
        title="Yatırım Destekleri"
        count={yatirimlar.length}
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
        {yatirimlar.length === 0 ? (
          <Empty />
        ) : (
          <TableWrap
            head={["Başlık", "Tür", "Tutar", "Tarih", "Durum", "İşlem"]}
            rows={yatirimlar.map((y) => (
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
        count={egitimler.length}
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
        {egitimler.length === 0 ? (
          <Empty />
        ) : (
          <TableWrap
            head={["Başlık", "Konu", "Eğitmen", "Tarih", "Süre", "Katılımcı", "Durum", "İşlem"]}
            rows={egitimler.map((e) => (
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
        count={hizmetler.length}
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
        {hizmetler.length === 0 ? (
          <Empty />
        ) : (
          <TableWrap
            head={["Başlık", "Tür", "Tarih", "Durum", "İşlem"]}
            rows={hizmetler.map((h) => (
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
      </>
      )}

      {/* ── Proje & Destek sekmesi (Faz 16 / P1-P2) ──────────────────────── */}
      {sekme === "destek" && (
      <>
      {projeGorur && (
        <Section
          title="Projeler"
          count={projeler.length}
          addPanel={
            izinler.has(IZIN.projeOlustur) ? (
              <Link href={`/projeler?firma=${firma.id}`} className="btn-secondary">
                <Plus className="h-4 w-4" /> Proje Aç
              </Link>
            ) : null
          }
        >
          {projeler.length === 0 ? (
            <Empty />
          ) : (
            <TableWrap
              head={["Kod", "Ad", "Başlangıç", "Bitiş", "Bütçe", "Durum"]}
              rows={projeler.map((p) => (
                <tr key={p.id} className="hover:bg-muted/40">
                  <td className="td">
                    <Link
                      href={`/projeler/${p.id}`}
                      className="font-mono text-sm font-medium hover:text-primary"
                    >
                      {p.kod}
                    </Link>
                  </td>
                  <td className="td">{p.ad}</td>
                  <td className="td">{p.baslangic ? formatTarih(p.baslangic) : "—"}</td>
                  <td className="td">{p.bitis ? formatTarih(p.bitis) : "—"}</td>
                  <td className="td">{formatPara(p.butce, p.paraBirimi)}</td>
                  <td className="td"><StatusBadge durum={p.durum} /></td>
                </tr>
              ))}
            />
          )}
        </Section>
      )}

      {destekGorur && (
        <Section
          title="Destek Kayıtları"
          count={destekKayitlari.length}
          addPanel={
            izinler.has(IZIN.destekOlustur) ? (
              <Link href={`/destek?firma=${firma.id}`} className="btn-secondary">
                <Plus className="h-4 w-4" /> Destek Kaydı
              </Link>
            ) : null
          }
        >
          {destekKayitlari.length === 0 ? (
            <Empty />
          ) : (
            <TableWrap
              head={["No", "Başlık", "Kanal", "Öncelik", "Açılış", "Durum"]}
              rows={destekKayitlari.map((d) => (
                <tr key={d.id} className="hover:bg-muted/40">
                  <td className="td">
                    <Link
                      href={`/destek/${d.id}`}
                      className="font-mono text-sm font-medium hover:text-primary"
                    >
                      {d.no}
                    </Link>
                  </td>
                  <td className="td">{d.baslik}</td>
                  <td className="td">{d.kanal}</td>
                  <td className="td"><OncelikRozet oncelik={d.oncelik} /></td>
                  <td className="td">{formatTarih(d.createdAt)}</td>
                  <td className="td"><StatusBadge durum={d.durum} /></td>
                </tr>
              ))}
            />
          )}
        </Section>
      )}
      </>
      )}
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
