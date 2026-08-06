# Sürüm Bazlı Test Senaryoları

Her sürümde **ne eklendi** ve **elle nasıl doğrulanır**.

Bu belge otomatik testlerin yerine geçmez; onların tamamlayıcısıdır. Otomatik
doğrulama `npm run dogrula` ile koşar ve sonucu
[`docs/dogrulama/`](dogrulama/) altına yazılır. Buradaki senaryolar, bir
insanın ekrana bakarak "gerçekten çalışıyor mu?" sorusunu yanıtlaması içindir.

## Hazırlık

```bash
npm install
npm run db:migrate
npm run db:seed        # demo veri (iki kiracı + platform)
npm run dev
```

Demo hesaplar:

| Kiracı | Rol | Giriş |
|---|---|---|
| Gezegen Platform | Platform Yöneticisi | `platform@gezegen.com` / `platform123` |
| Gezegen Danışmanlık (800 firma) | Kuruluş Yöneticisi | `admin@gezegen.com` / `admin123` |
| Gezegen Danışmanlık | Üye | `kullanici@gezegen.com` / `user123` |
| Gezegen Danışmanlık | Salt Okunur | `okuyucu@gezegen.com` / `okuyucu123` |
| Anadolu Yatırım (120 firma) | Kuruluş Yöneticisi | `admin@anadolu.com` / `anadolu123` |

> Salt okunur hesap, seed'deki **"Saha Ekibi"** grubuna üyedir ve bu grup ona
> `firma.olustur` + `egitim.olustur` izni ekler. Grupların yetki *eklediğini*
> göstermek için bilinçli kurulmuştur; senaryolarda bu kullanılır.

---

## Özet Tablo

| Sürüm | Ne eklendi | Test senaryosu (kısa) | Beklenen sonuç | Kontrol |
|---|---|---|---|---|
| **v1.0.1** | Mevcut CRM'in ilk etiketi: firma, yatırım desteği, eğitim, hizmet, raporlar, dark mode | `git checkout v1.0.1` → uygulamayı aç | Temel CRM çalışıyor; versiyonlamanın başlangıç noktası | — |
| **v1.0.2** | Sürüm çıkarma otomasyonu (`scripts/release.sh`) | `npm run release:minor -- "deneme"` | `package.json` sürümü artar, commit + annotated tag oluşur, branch push edilir | — |
| **v1.0.3** | Sürüm betiğinde token seçimi düzeltmesi | Ortamda `GH_TOKEN=proxy-...` varken sürüm çıkar | Betik `proxy-*` yer tutucusunu eler, dosyadaki gerçek token'ı kullanır | — |
| **v1.0.4** | 13 fazlık yol haritası (`docs/ROADMAP.md`) | Dosyayı aç | Fazlar, çalışma paketleri, kabul kriterleri ve "Şu An Neredeyiz" tablosu yerinde | — |
| **v1.1.0** | **Faz 1** — Çok kiracılılık temeli: `Tenant` modeli, her modelde `tenantId`, oturumda kiracı bağlamı, sahiplik doğrulaması | İki farklı kiracıyla ayrı ayrı giriş yap; A'daki bir firma ID'sini B oturumundayken URL'ye yaz | Listeler tamamen ayrı; başka kiracının ID'si **404** verir (403 değil — "var ama senin değil" bilgisi bile sızmaz) | — |
| **v1.1.1** | Yol haritası iki kişilik ekip için genişletildi (iş alma, dal düzeni, kapanış listesi) | `docs/ROADMAP.md` → "Nasıl Çalışıyoruz" | İş alma kuralları ve dal adlandırması yazılı | 58 |
| **v1.1.2** | Doğrulama raporu altyapısı (`npm run dogrula`), `npm run demo:kur`, arayüzdeki sürüm etiketi | `npm run dogrula` → sol alttaki sürüm etiketine bak | Rapor `docs/dogrulama/` altına yazılır; arayüzdeki sürüm git tag'i ile aynı | 58 |
| **v1.1.3** | Sunucuya sürüm alma kılavuzu (`docs/DEPLOY.md`) | Dosyayı aç | Adım adım deploy komutları yerinde | — |
| **v1.2.0** | **Faz 2** — PostgreSQL + Row-Level Security: kiracı sınırı veritabanı katmanında da zorunlu | `psql` ile bağlan, bağlam ayarlamadan `SELECT * FROM "Firma"` | **0 satır** döner. Uygulama katmanı filtreyi unutsa bile veri sızmaz | 70 |
| **v1.2.1** | Deploy kılavuzuna "Sık Karşılaşılan Sorunlar" (502, parola, volume, `--env-file`) | `docs/DEPLOY.md` sonu | Altı gerçek tuzak ve çözümü yazılı | — |
| **v1.3.0** | **Faz 3** — Vitest altyapısı, çapraz kiracı sızıntı testleri, regresyon koruması, CI | `npm test` | Testler ayrı `test` şemasında koşar, geliştirme veritabanına dokunmaz | 74 |
| **v1.4.0** | **Faz 4** — RBAC (4 rol), kullanıcı grupları, değiştirilemez denetim günlüğü | Üye hesabıyla `/gruplar` adresini elle yaz | `/yetkisiz`e düşer. Denetim günlüğünde kayıt düzenlenemez/silinemez | 114 |
| **v1.5.0** | **Faz 5** — Admin panel: kiracı, kullanıcı, davet, paket, impersonation, markalama | Platform hesabıyla gir → `/admin`; sonra kuruluş yöneticisiyle aynı adresi dene | Platform yöneticisi tüm kuruluşları görür; kuruluş yöneticisi `/yetkisiz`e düşer | 142 |
| **v1.6.0** | **Faz 6** — Satış çekirdeği: kişi, fırsat, kiracıya özel aşamalarla kanban | `/firsatlar` → bir kartı başka sütuna sürükle | Aşama değişir, denetim günlüğüne düşer, sütun toplamları güncellenir | 170 |
| **v1.7.0** | **Faz 7** — Aktivite/görev, aday (Lead) ve dönüştürme, firma timeline, kalemli/revizyonlu teklif | Bir adayı **Dönüştür** → sonra bir teklifi **Revize Et** | Firma + kişi (+ fırsat) açılır, aday silinmez; revizyon yeni satır olur, eski sürüm dondurulur | 203 |
| **v1.8.0** | **Faz 8** — Bildirim merkezi, kiracı bazlı SMTP (şifreli), iş akışı otomasyonu, IMAP senkron, takvim + `.ics` | Bir görevi başkasına ata → `/otomasyon`'da bir kuralı **şimşek** düğmesiyle çalıştır | Atanan kişinin zilinde rozet çıkar; kural çalışır ve aynı kayda ikinci kez bildirim göndermez | 235 |
| **v1.9.0** | **Faz 9** — Excel/CSV dışa aktarım (filtreye saygılı), sütun eşleştirmeli içe aktarım, kiracı markalı PDF | Firmalarda filtre uygula → **Dışa Aktar**; sonra `/ice-aktar` ile geri yükle; bir teklifte **Yazdır / PDF** | İnen dosya ekrandaki filtreyle aynı; içe aktarım ön izleme gösterir, hatalı satırı atlar; PDF kuruluş logosu ve rengiyle çıkar | 273 |
| **v1.10.0** | **Faz 10** — Özelleştirilebilir pano, kayıtlı görünümler (kaydet/paylaş/varsayılan), kiracı yedekleri (ekleyici geri yükleme + gece yedeği) | Panoda **Panoyu Düzenle** ile kart seç; `/firmalar`da filtre kur → **Görünümler → Kaydet**; `/yedekler`de **Şimdi Yedek Al** → bir kaydı sil → **Geri Yükle** | Pano yalnızca seçilen (ve izinli) kartları gösterir; liste parametresiz açılınca varsayılan görünüm uygulanır; silinen kayıt döner, mevcutlara dokunulmaz | 296 |

> **Kontrol** sütunu, o sürümde `npm run dogrula` ile geçen otomatik kontrol
> sayısıdır. Raporun tamamı `docs/dogrulama/v<sürüm>.md` dosyasındadır.

---

## Ayrıntılı Senaryolar

Aşağıdakiler "tıklaya tıklaya" izlenecek biçimde yazılmıştır. Her senaryonun
sonunda **beklenen sonuç** vardır; farklı bir şey görürseniz hata var demektir.

### v1.1.0 — Kiracı izolasyonu (Faz 1)

| # | Adım | Beklenen |
|---|---|---|
| 1 | `admin@gezegen.com` ile gir, `/firmalar` aç, bir firmaya tıkla, adres çubuğundaki ID'yi kopyala | Firma detayı açılır |
| 2 | Çıkış yap, `admin@anadolu.com` ile gir | Anadolu'nun 120 firması listelenir, Gezegen'inkiler görünmez |
| 3 | Adres çubuğuna `/firmalar/<kopyaladığın-id>` yaz | **404** sayfası. 403 değil — başka kiracının kaydının *varlığı* bile sızmaz |
| 4 | Üst çubuktaki kuruluş adına bak | Aktif kuruluş her ekranda yazılı |

### v1.2.0 — Veritabanı katmanı (Faz 2)

| # | Adım | Beklenen |
|---|---|---|
| 1 | `psql "$DATABASE_URL"` ile bağlan | Bağlanır |
| 2 | `SELECT count(*) FROM "Firma";` | **0** — bağlam ayarlanmadığı için RLS hiçbir satır döndürmez |
| 3 | `SELECT set_config('app.tenant_id','<bir-tenant-id>',false); SELECT count(*) FROM "Firma";` | Yalnızca o kiracının firma sayısı |
| 4 | Uygulamadan normal kullan | Her şey çalışır; bağlam `src/lib/rls.ts` tarafından her sorguya sarılır |

### v1.4.0 — Yetkilendirme ve denetim (Faz 4)

| # | Adım | Beklenen |
|---|---|---|
| 1 | `kullanici@gezegen.com` (Üye) ile gir | Menüde **Gruplar** ve **Denetim Günlüğü** yok |
| 2 | Adres çubuğuna `/gruplar` yaz | `/yetkisiz` sayfası — menüyü gizlemek koruma değil, sunucu da reddediyor |
| 3 | `admin@gezegen.com` ile gir, bir firma düzenle | Kayıt olur |
| 4 | `/denetim` aç | Değişiklik kaydı görünür: kim, ne zaman, hangi alan eskiden neydi |
| 5 | Denetim kaydını silmeyi/düzenlemeyi dene | Arayüzde böyle bir düğme yok; veritabanında da yalnızca SELECT+INSERT politikası var |
| 6 | `okuyucu@gezegen.com` ile gir, `/firmalar` aç | **Yeni Firma** düğmesi görünür — çünkü "Saha Ekibi" grubu bu izni ekliyor (grup yalnızca *ekler*) |

### v1.5.0 — Admin panel (Faz 5)

| # | Adım | Beklenen |
|---|---|---|
| 1 | `platform@gezegen.com` ile gir | Üst çubukta turuncu **Platform** düğmesi |
| 2 | `/admin/kiracilar` | Bütün kuruluşlar listelenir (kiracılar ötesi tek yer) |
| 3 | `/admin/paketler` → paket oluştur, bir modülü kapat, kiracıya ata | Kiracının menüsünden o modül düşer; sayfası URL ile de açılmaz |
| 4 | Kuruluş detayında **Davet Et** | Bağlantı bir kez gösterilir; kopyala |
| 5 | Gizli sekmede bağlantıyı aç | Şifre belirleme ekranı; giriş gerektirmez |
| 6 | Bozuk bir token ile `/davet/xyz` aç | "Davet geçersiz" — hiçbir kuruluş adı sızmaz |
| 7 | Kuruluş detayında **Kiracı olarak görüntüle** | Üstte kapatılamaz turuncu bant; yapılan işlem denetim günlüğüne **gerçek yönetici** adına düşer |
| 8 | `admin@gezegen.com` ile `/admin` dene | `/yetkisiz` |

### v1.6.0 — Satış hattı (Faz 6)

| # | Adım | Beklenen |
|---|---|---|
| 1 | `/firsatlar` | Kanban; sütun başlıklarında adet, toplam ve **beklenen ciro** |
| 2 | Bir kartı başka sütuna sürükle | Kart taşınır, toplamlar güncellenir |
| 3 | `/denetim` | "X: Teklif → Müzakere" kaydı |
| 4 | Kartın üzerine gel → aşama seçicisini kullan | Dokunmatik/klavye için aynı işi yapar |
| 5 | `/firsatlar/asamalar` → içinde fırsat olan aşamayı sil | Engellenir: "Bu aşamada N fırsat var" |
| 6 | Üye hesabıyla `/firsatlar/asamalar` | `/yetkisiz` — hattın biçimi kuruluş çapında bir karar |
| 7 | Bir firmanın kişisini sil | Kişi gider, fırsat kalır (muhatap alanı boşalır) |

### v1.7.0 — Satış derinleştirme (Faz 7)

| # | Adım | Beklenen |
|---|---|---|
| 1 | `/aktiviteler` | Varsayılan sekme **Bugün**, varsayılan süzgeç "bana atananlar" |
| 2 | Yeni aktivite ekle, **Son Tarih** boş bırak | Not olarak kaydolur, görev listesinde çıkmaz |
| 3 | Son tarih vererek ekle | Görev olur; gecikmişse kırmızı görünür |
| 4 | `/adaylar` → bir adayda **Dönüştür** | Firma + birincil kişi (+ istenirse fırsat) açılır, firmaya yönlenirsin |
| 5 | `/adaylar` listesine dön | Aday **silinmemiş**, durumu "Dönüştürüldü", firma adı bağlantılı |
| 6 | Firma detayına git | **Zaman Akışı** bölümünde yedi modülün kayıtları kronolojik |
| 7 | `/teklifler/yeni` → kalem gir | Toplam anlık hesaplanır (önizleme) |
| 8 | Kaydet, sonra **Revize Et** | Yeni sürüm açılır; eskisi "Revize Edildi" olur ve **salt okunur** görünür |
| 9 | Eski sürümü aç | Rakamları değişmemiş; revizyon zinciri üstte |

### v1.8.0 — Otomasyon ve iletişim (Faz 8)

| # | Adım | Beklenen |
|---|---|---|
| 1 | Bir görevi **başka** kullanıcıya ata | O kullanıcının üst çubuğundaki zilde rozet |
| 2 | `/bildirimler` | Bildirim listelenir; tıklayınca okundu olur |
| 3 | `/bildirimler/tercihler` | Olay bazlı kanal seçimi; SMTP tanımsızsa e-posta sütunu pasif ve uyarı görünür |
| 4 | `/otomasyon` | Seed'den gelen üç örnek kural |
| 5 | Bir kuralda **şimşek** düğmesi | Kural çalışır, bildirim üretir |
| 6 | Aynı düğmeye tekrar bas | Aynı kayda **ikinci bildirim gitmez** |
| 7 | `/otomasyon/eposta` → SMTP gir, **Test Et** | Deneme iletisi gider (ayar doğruysa) |
| 8 | Ayarı yeniden aç | Parola alanı **boş**; "Kayıtlı — değiştirmek için yazın" yazar |
| 9 | Üye hesabıyla `/otomasyon` | `/yetkisiz` |
| 10 | `/takvim` | Görev, fırsat, teklif, eğitim ve hizmet tarihleri tek ızgarada |
| 11 | **.ics indir** | Takvim uygulamasına eklenebilen dosya |
| 12 | Tarayıcıda `/api/gorevler` aç | **401** — anahtarsız çalıştırılamaz |

### v1.9.0 — Veri giriş/çıkış (Faz 9)

| # | Adım | Beklenen |
|---|---|---|
| 1 | `/firmalar` → durum "aktif" filtrele → **Dışa Aktar → Excel** | İnen dosyada yalnızca aktif firmalar; "Bilgi" sayfasında kuruluş adı ve satır sayısı |
| 2 | Aynı filtreyle **CSV** indir, Excel'de aç | Türkçe karakterler doğru, sütunlar ayrı (BOM + noktalı virgül) |
| 3 | `/denetim` | "Firmalar dışa aktarıldı (N satır, XLSX)" kaydı |
| 4 | `/ice-aktar` → Firmalar seç → indirdiğin dosyayı yükle → **Analiz Et** | Sütunlar otomatik eşleşir |
| 5 | Ön izlemeye bak | Zaten kayıtlı firmalar için satırlar geçerli görünür ama aktarımda atlanır (kopya açılmaz) |
| 6 | Bir sütunu "— aktarma —" yap, yeniden analiz et | O alan boş gelir; zorunluysa satır **hata** işaretlenir |
| 7 | Zorunlu sütunu boş bir satır içeren dosya dene | Ön izlemede kırmızı satır + sebep; diğerleri aktarılır |
| 8 | Bir teklifte **Yazdır / PDF** | Kuruluş logosu ve ana rengiyle A4 belge; kenar çubuğu ve düğmeler baskıda yok |
| 9 | `okuyucu@gezegen.com` ile `/ice-aktar` | Açılır ama listede yalnızca **Firmalar** ve **Eğitimler** (grup izinleri) |
| 10 | Çıkış yapıp `/api/disa-aktar?tur=firmalar&bicim=csv` aç | Girişe yönlendirir |

### v1.10.0 — Kişiselleştirme ve süreklilik (Faz 10)

| # | Adım | Beklenen |
|---|---|---|
| 1 | Panoda **Panoyu Düzenle** → "Beklenen Ciro" ve "Bugünkü Görevlerim" kartlarını aç, bir KPI'yı kapat, sırala | Pano yalnızca seçtiklerini, senin sıranla gösterir; tercih kullanıcıya özeldir (başka kullanıcının panosu değişmez) |
| 2 | **Varsayılana dön** | Faz 10 öncesi düzen geri gelir |
| 3 | `okuyucu@gezegen.com` ile gir | İzni olmayan modülün kartı, tercih edilmiş olsa bile görünmez |
| 4 | `/firmalar` → il+durum filtrele → **Görünümler → Görünümü Kaydet**, "Varsayılan yap" işaretle | Görünüm listeye eklenir |
| 5 | Menüden `/firmalar`ı parametresiz aç | Varsayılan görünümün filtresi kendiliğinden uygulanır; **Tümü** bağlantısı süzgeçsiz listeye döndürür |
| 6 | Görünümü "Paylaş" ile kaydet, başka kullanıcıyla gir | Görünüm "Paylaşılanlar" altında, sahibinin adıyla görünür |
| 7 | `/yedekler` → **Şimdi Yedek Al** | Listede "Elle" türünde yedek; kayıt sayısı ve boyut yazar |
| 8 | Bir hizmet kaydını sil → yedekte **Geri Yükle** (onay kutusuyla) | Silinen kayıt döner; mevcut kayıtlar İKİ KEZ oluşmaz; sonuç özeti kaç kaydın eklendiğini söyler |
| 9 | Aynı yedeği tekrar geri yükle | "Eklenecek yeni kayıt yoktu" — idempotent |
| 10 | Yedeği indir (`.json.gz`) → `/yedekler`de dosyadan yükle | Dosya doğrulanır, "Dosyadan" türünde kayıt olur; geri yükleme ayrı onayla |
| 11 | `kullanici@gezegen.com` ile `/yedekler` | `/yetkisiz` — yedek bütün veriyi içerir, yalnızca kuruluş yöneticisi |
| 12 | `/denetim` | "Yedek alındı / geri yüklendi / indirildi" kayıtları |

---

## Çapraz Kiracı Kontrolü (her sürümde tekrarlanır)

Bu, ürünün **en kritik sözüdür** ve her sürüm sonrası yeniden bakılmalıdır.

| # | Adım | Beklenen |
|---|---|---|
| 1 | `admin@anadolu.com` ile gir | Yalnızca Anadolu verisi |
| 2 | Sırayla aç: Firmalar, Kişiler, Fırsatlar, Adaylar, Teklifler, Aktiviteler, Takvim, Raporlar | Hiçbirinde "Gezegen Danışmanlık" geçmiyor |
| 3 | Her listede **Dışa Aktar** | İnen dosyalarda da yalnızca kendi verisi |
| 4 | Gezegen'e ait herhangi bir kayıt ID'sini URL'ye yaz | 404 |

Otomatik karşılığı: `npm test` içindeki izolasyon, RLS ve regresyon testleri
(bkz. `tests/izolasyon.test.ts`, `tests/rls.test.ts`, `tests/regresyon.test.ts`).

---

## Sürüm Geri Alma

Bir sürümde sorun görürseniz:

```bash
git checkout v1.8.0                 # önceki sürüme dön
npm install && npm run build
```

Sunucuda:

```bash
cd /root/gezegen-crm
git checkout v1.8.0
docker compose --env-file deploy.env -f docker-compose.server.yml up -d --build
docker exec root-nginx-1 nginx -s reload
```

> **Dikkat:** kod geri döner ama **veritabanı geri dönmez**. Yeni sürümde
> eklenen tablolar yerinde kalır (eski kod onlara bakmaz, zararsızdır).
> Migration'ları geri almak gerekiyorsa önce yedek alın.
