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
| **v1.19.0** | **Faz 19** — Anket tanımı, kişiye özel token'lı gönderim, OTURUMSUZ yanıt sayfası, anonimlik ve NPS raporu | Bir anket yayınla → kontaklara **Gönder** → gelen bağlantıyı GİRİŞ YAPMADAN aç ve doldur → **Sonuçlar** | Bağlantı giriş istemez ve bir kez çalışır; anonim ankette yanıt kişiye/firmaya bağlanmaz (veritabanında da bağ yoktur); rapor NPS ve yanıtlama oranını gösterir | 662 |
| **v1.18.0** | **Faz 18** — Rapor merkezi, mali/satış/aktivite/ürün raporları, tek belgede firma dosyası (PDF) | `/raporlar`da **Bu çeyrek**'i seç → **Mali Rapor**'a gir → firma detayında **Dosya (PDF)** | Seçilen dönem raporlara taşınır; ciro yalnızca onaylı siparişten gelir ve beklenen tahsilat açıkça "tahmin" diye etiketlenir; firma dosyası izni olan modülleri tek belgede toplar | 626 |
| **v1.17.0** | **Faz 17** — Dosya/fotoğraf eki (içerik doğrulamalı, kotalı), firma konumu, saha ziyareti ve konum doğrulama | Firma detayında **Fotoğraf** ile bir görsel yükle → `/ziyaretler`de **Konumumu al** + **Ziyareti Başlat** → sonra **Ziyareti Bitir** | Ek listede önizlemeyle çıkar; uzantısı değiştirilmiş dosya reddedilir; ziyaret yeşil/kırmızı/sarı işaretlenir, süre kendiliğinden hesaplanır ve firma zaman akışına aktivite düşer | 587 |
| **v1.16.0** | **Faz 16** — Proje, destek kaydı (kanal/öncelik/atama/işlem geçmişi), destek raporu, SSS bilgi bankası | `/destek` → yeni kayıt aç → işlem ekle → durumu **Çözüldü** yap → `/destek/rapor` | Kayıt `DST-YIL-0001` numarasını alır; işlem hem destek geçmişinde hem firma zaman akışında görünür; çözüm tarihi ELLE girilmeden damgalanır ve raporda ortalama çözüm süresine yansır | 539 |
| **v1.15.0** | **Faz 15** — Sipariş, yönetici onay akışı, sevkiyat kuyruğu ve raporu | Üye ile sipariş gir → yönetici ile onayla → sevkiyat aç → durumu ilerlet | Sipariş onaya düşer; onayda stok ve kampanya kotası düşer; sevkiyat düğmesi ancak ONAYDAN SONRA çıkar; stok yetersizse onay verilmez ve hiçbir şey düşmez | 498 |
| **v1.14.0** | **Faz 14** — Ürün kataloğu, müşteriye özel paketler, kampanya (kota + kullanım raporu), fiyat motoru, gerçek stok takibi | `/urunler`de ürün ekle → `/paketler`de iki ürünü paketle → `/kampanyalar`da kotalı kampanya aç → `/stok`ta giriş/çıkış gir | Paket önizlemesi müşteri avantajını gösterir; kampanya kotası her kullanımda düşer ve tükenince reddeder; stok çıkışı eldekinden fazlaysa hata verir ve hareket yazılmaz | 465 |
| **v1.13.0** | **Faz 13** — Firma numarası (`A0001`), Türkçe duyarsız arama, Kontaklar adı + menü düzeni, Adaylar fırsatlar sekmesi, fırsattan firma/teklif, takvim kategori süzgeci, raporlarda tarih aralığı | Firmalar listesinde bir numarayı arama kutusuna yaz; `/firsatlar`da **+ Yeni firma ekle** ile fırsat aç | Numara tam eşleşmeyle o firmayı getirir; fırsat ve firma tek işlemde açılır, firma sıradaki numarayı ve denetim kaydını alır | 400 |
| **v1.12.1** | Kişi kaydına departman alanı: 40 seçenekli sabit listeden aramalı seçim; kişiler listesinde ve firma detayında sütun | Firma detayı → **Kişi Ekle** → Departman kutusuna bas, "insan" yaz | Küçük arama penceresi süzer ("İnsan Kaynakları"); elle metin yazılamaz; seçim listede ve dışa aktarımda görünür | 373 |
| **v1.12.0** | **Faz 12** — Hesap güvenliği ve KVKK: şifre politikası, şifremi unuttum, 2FA (TOTP + yedek kodlar), oturum yönetimi, hız sınırlama, KVKK aydınlatma/rıza/veri kopyası | Girişte **Şifremi unuttum**; profil menüsünden **Hesap Güvenliği** → 2FA kur; 5 kez yanlış şifre dene | Sıfırlama yanıtı hesap olsa da olmasa da aynı; 2FA açılınca girişte kod istenir; 5. denemeden sonra hesap 15 dk kilitlenir | 369 |
| **v1.11.2** | Arayüz: sıkı ve kaydırılabilir sol menü; kanban dar sütunlarla tam genişliğe yayılır | Menüde en alttaki "Yedekler"i gör; `/firsatlar`da 5 sütunun tamamına bak | Menünün tamamı görünür (taşarsa içinde kaydırılır); kanban sağdan kesilmez | 328 |
| **v1.11.1** | Geri bildirim düzeltmeleri: kronolojik zaman akışı, portal modallar, tam genişlik kanban, menüde "Yönetim" bölümü + `/kullanicilar` (davet, rol, durum, şifre) | Firma detayında akışın yönüne bak; **Yeni Fırsat**'a bas; `/kullanicilar`dan davet oluştur | Akış en eskiden bugüne akar; fırsat formu ekranın ortasında pencere olarak açılır; davet bağlantısı bir kez gösterilir, üye `/kullanicilar`a giremez | 328 |
| **v1.11.0** | **Faz 11** — Kiracıya özel alanlar: firma/kişi/fırsat formlarına beş tipli alan tanımlama, liste filtresi, dışa aktarım ve yedek bütünleşmesi | `/ozel-alanlar`da alan tanımla → firma formunda doldur → listede filtrele → dışa aktar | Alan formda kendiliğinden görünür; seçim tipli alan filtre olur; dosyada sütun olarak çıkar; komşu kiracı alanı hiç görmez | 324 |
| **v1.10.1** | Güvenlik yükseltmesi: Next.js 15.5 + React 19 (14 hattında yamasız kalan açıklar), `npm audit` 0 açık | `npm audit` çalıştır; uygulamayı normal kullan | Hiç açık raporlanmaz; tüm ekranlar önceki gibi çalışır (296 kontrol aynı) | 296 |
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

### v1.11.0 — Kiracıya özel alanlar (Faz 11)

| # | Adım | Beklenen |
|---|---|---|
| 1 | `admin@gezegen.com` ile `/ozel-alanlar` | Seed'den gelen alanlar: Müşteri No, Segment (firma), LinkedIn (kişi), İhale No (fırsat) |
| 2 | **Yeni Alan** → Firma, "Sözleşme Bitişi", tip Tarih, zorunlu işaretle | Alan listeye eklenir |
| 3 | `/firmalar/yeni` aç | Formun altında "Özel Alanlar" bölümü; Sözleşme Bitişi boş bırakılamaz |
| 4 | Sözleşme Bitişi'ni boş bırakıp kaydetmeyi dene | Sunucu hata döndürür: "alanı zorunludur" — arayüz kontrolü aşılsa bile kayıt yazılmaz |
| 5 | Doldurup kaydet → firma detayına bak | Özel alanlar bilgi kartında değerleriyle görünür |
| 6 | `/firmalar` listesinde **Segment** filtresinden "Altın" seç | Yalnızca o segmentteki firmalar listelenir; **Görünümler → Kaydet** dersen filtre görünümde saklanır |
| 7 | Aynı filtreyle **Dışa Aktar** | Dosyada özel alanlar sütun olarak var ve filtre uygulanmış |
| 8 | `kullanici@gezegen.com` ile `/ozel-alanlar` | `/yetkisiz` — ama firma formunda alanları görür ve doldurabilir |
| 9 | `admin@anadolu.com` ile `/firmalar/yeni` | Gezegen'in alanları YOK — alanlar kiracıya özeldir |
| 10 | Bir alanı sil (değerli olanı) | Onay metni kaç kayıtta değer olduğunu söyler; silince değerler de gider |
| 11 | `/yedekler` → yedek al → alanı sil → geri yükle | Alan tanımı ve değerleri yedekten geri gelir |

---

### v1.12.0 — Hesap güvenliği ve KVKK (Faz 12)

| # | Adım | Beklenen |
|---|---|---|
| 1 | Giriş ekranında **Şifremi unuttum** → kayıtlı e-postanı gir | "Kayıtlı bir hesap varsa bağlantı gönderildi" |
| 2 | Aynı formu OLMAYAN bir e-postayla dene | **Aynı mesaj** — hesabın var olup olmadığı sızmaz |
| 3 | `/sifre-sifirla/uydurma-token` aç | "Bağlantı geçersiz"; hiçbir hesap adı görünmez |
| 4 | Gerçek bağlantıyla "12345678" gibi zayıf bir şifre dene | Politika reddeder (en az 10 karakter, büyük/küçük harf, rakam) |
| 5 | Geçerli şifre belirle | Şifre değişir ve **tüm oturumların kapandığı** söylenir |
| 6 | Bir hesapla 5 kez yanlış şifre gir, sonra DOĞRU şifreyle dene | Hesap 15 dakika kilitli; doğru şifre bile girmiyor |
| 7 | Profil menüsü → **Hesap Güvenliği** → İki Faktörü Kur | Kurulum anahtarı çıkar; doğrulama uygulamasına elle eklenir |
| 8 | Uygulamadaki 6 haneli kodu gir | 2FA açılır ve **yedek kodlar bir kez** gösterilir |
| 9 | Çıkış yapıp yeniden giriş yap | Şifreden sonra doğrulama kodu istenir |
| 10 | Kod yerine bir yedek kodu kullan | Giriş olur; o kod bir daha çalışmaz (kalan sayısı düşer) |
| 11 | Hesap Güvenliği → Açık Oturumlar | Cihaz, IP ve son etkinlik listelenir; "bu cihaz" işaretli |
| 12 | Başka bir tarayıcıdan gir, ilk tarayıcıdan o oturumu **Sonlandır** | İkinci tarayıcı bir sonraki istekte girişe düşer |
| 13 | `/kvkk` aç | Sürümlü aydınlatma metni; onay kutusu ile rıza |
| 14 | Onayla → `/denetim` | "KVKK aydınlatma metni onaylandı (sürüm …)" kaydı |
| 15 | `/kvkk` → **Verilerimi İndir** | JSON iner; şifre özeti ve 2FA sırrı **içinde yoktur** |
| 16 | `/kullanicilar` → Güvenlik Politikası → 2FA'yı zorunlu kıl | Ayar kaydolur; kurulumu olmayan kullanıcı sayısı gösterilir |
| 17 | Üye hesabıyla `/guvenlik` | Açılır — kişisel güvenlik herkesin hakkıdır |

---

### v1.13.0 — Arayüz ve veri düzeltmeleri (Faz 13)

| # | Adım | Beklenen |
|---|---|---|
| 1 | `/firmalar` listesini aç | Solda **No** sütunu; numaralar `A0001`'den artıyor |
| 2 | Bir numarayı (ör. `A0007`) arama kutusuna yaz | Yalnızca o firma listelenir (tam eşleşme) |
| 3 | Bir firmanın adını TAMAMEN BÜYÜK harfle ara ("ISPARTA", "TEKSTİL") | Kayıt bulunur — Türkçe İ/ı farkı aramayı bozmaz |
| 4 | Firma detayını aç → **Düzenle** | Detayda "Firma No" var; düzenleme formunda YOK (değiştirilemez) |
| 5 | **Yeni Firma** ile firma aç | Sıradaki numarayı alır; `/denetim` kaydında numara görünür |
| 6 | Firmaları **Dışa Aktar** → `/ice-aktar`da firma dosyası yükle | Dosyada "Firma No" sütunu var; içe aktarım eşleştirme ekranında o sütun YOK |
| 7 | Sol menüye bak | "Kişiler" yerine **Kontaklar**, Raporlar'ın altında; ayrı "Adaylar" başlığı yok |
| 8 | `/firsatlar` → üstteki sekmeler | Kanban · Liste · **Adaylar**; Adaylar'a geçince menüde Fırsatlar işaretli kalır |
| 9 | `/firsatlar` → **Yeni Fırsat** → Firma kutusunda **+ Yeni firma ekle** | Ad alanı açılır; kaydedince firma + fırsat birlikte oluşur |
| 10 | Aynı formu paket firma limiti dolu bir kiracıda dene | Limit hatası döner — kısa yol limitin arka kapısı değildir |
| 11 | Fırsat listesinde **Teklif hazırla** bağlantısı | Teklif formu firma, fırsat ve başlıkla dolu gelir |
| 12 | Teklifi kaydet → fırsat listesine dön | Satırda "1 teklif" yazar |
| 13 | `/takvim` → renk rozetlerinden **Görev**'e bas | Yalnızca görevler kalır; adres çubuğunda `tur=gorev` |
| 14 | Aynı süzgeçle **.ics indir** | Dosyada yalnızca görevler var |
| 15 | Ay değiştir | Süzgeç korunur |
| 16 | `/raporlar` → **Bu ay** / **Geçen ay** | Kartlar ve grafikler o döneme daralır; başlıkta aralık yazar |
| 17 | Başlangıcı bitişten SONRAYA ayarla | Rapor boşalmaz — süzgeç uygulanmaz (yazım hatası veriyi gizlemez) |

---

### v1.14.0 — Ticari çekirdek (Faz 14)

| # | Adım | Beklenen |
|---|---|---|
| 1 | `/urunler` aç | Seed'den gelen 8 kalem; liste fiyatı ve KDV dahil sütunları |
| 2 | **Yeni Ürün** → aynı kodu ikinci kez ver | "Bu kod zaten kullanılıyor" |
| 3 | Bir ürünü **pasif** yap | Listede pasif rozeti; katalogda kalır (silinmez) |
| 4 | Pakette kullanılan bir ürünü sil | Engellenir; kaç pakette kullanıldığı söylenir |
| 5 | `/paketler` → **Başlangıç Paketi** | Liste toplamı üstü çizili, paket fiyatı ve müşteri avantajı görünür |
| 6 | Yeni paket kur, sabit fiyat gir | Önizleme, fiyatı kalemlere liste değerine orantılı dağıtır |
| 7 | Pakete firma seç | Paket yalnızca o firmaya sunulur (filtreyle doğrula) |
| 8 | `/kampanyalar` → **BAHAR20** | Kota çubuğu 12/50; kullanım, firma ve indirim özeti |
| 9 | Kampanya detayına gir → **Kullanım Kaydet** (5 adet) | Kota 17/50 olur; defterde satır belirir |
| 10 | Kalan kotadan fazlasını kaydetmeyi dene | "Kampanya kotası yetersiz: N adet kaldı" |
| 11 | Bir kullanımı **İptal** et | Satır üstü çizilir, kota iade edilir |
| 12 | Kullanılmış kampanyayı silmeyi dene | Engellenir; "Sona erdi" yapması önerilir |
| 13 | `/stok` aç | Kritik stok bandında **El Terminali** (3 / 5) |
| 14 | **Stok Hareketi** → Çıkış, eldekinden fazla | "Yetersiz stok: elde N var" — hareket yazılmaz |
| 15 | Geçerli bir çıkış gir | Bakiye düşer; defterde miktar ve sonraki bakiye görünür |
| 16 | **Sayım Gir** → sistemdekinden farklı bir sayı | Fark kadar "sayım" hareketi yazılır; açıklamada eski/yeni değer |
| 17 | Sayımda mevcut bakiyeyi gir | "Fark yok" — hareket yazılmaz |
| 18 | `kullanici@gezegen.com` ile `/urunler` | Açılır ama **Yeni Ürün** düğmesi yok (tanım yöneticide) |
| 19 | `admin@anadolu.com` ile `/urunler` | Gezegen'in ürünlerinden hiçbiri görünmez |
| 20 | Ürünleri **Dışa Aktar** → `/ice-aktar` ile geri yükle | Dosyada stok miktarı sütunu var ama içe aktarım eşleştirmesinde YOK |

---

### v1.27.3 — Ziyaret ekranında paket stoğu ve kampanyalar

| # | Adım | Beklenen |
|---|---|---|
| 1 | Ziyaret başlat | "Bu firmaya açık paketler" listesi çıkar |
| 2 | Paket satırını oku | Fiyatın yanında "· stoktan N paket" yazar |
| 3 | Parantez içini oku | Sınırlayan kalem ve stoğu yazar (dar boğaz) |
| 4 | Pakette 2 adet geçen üründen 5 adet stok bırak | "2 paket" yazar (5 değil) |
| 5 | Dar boğaz ürünün stoğunu 0 yap | Kırmızı "stokta yok (X tükendi)" |
| 6 | Yalnızca hizmet içeren paket | "stok takibi yok" yazar |
| 7 | Aynı ekranda kampanya bölümüne bak | "Bu firmada geçerli kampanyalar" |
| 8 | Kotalı kampanya | "N hak kaldı" yazar |
| 9 | Kotasız kampanya | "sınırsız" yazar |
| 10 | Belirli ürünlere tanımlı kampanya | "belirli ürün/paketlerde" notu çıkar |
| 11 | Başka firmaya özel kampanya | Listede YOK |
| 12 | Süresi geçmiş / kotası dolmuş kampanya | Listede YOK |
| 13 | `urun.goruntule` izni olmayan kullanıcı | Paket bölümü YOK |
| 14 | `kampanya.goruntule` izni olmayan kullanıcı | Kampanya bölümü YOK |
| 15 | Ziyareti bitir | İki bölüm de kaybolur |

---

### v1.27.2 — Paketten sipariş ₺0 kaydediliyordu

| # | Adım | Beklenen |
|---|---|---|
| 1 | Sipariş formunda paketi ekle | Satırların birim fiyatı DOLU (₺0 değil) |
| 2 | Kaydet, sipariş belgesine bak | Birim fiyat, ara toplam ve genel toplam DOLU |
| 3 | Paket fiyatı 7.000 olan paket | Ara toplam ₺7.000 (satırlara dağılmış) |
| 4 | Kampanya seçip kaydet | Belgede indirim ve kampanya kodu görünür |
| 5 | Paket adedini 4 yapıp kaydet | Tutar 4 katına çıkar |
| 6 | Bir satırın birim fiyatını değiştirip kaydet | Girilen rakam kaydedilir |
| 7 | Teklifte aynısını yap | Teklif de dolu kaydedilir |

---

### v1.27.1 — Onay bekleyen kampanya hakkı

| # | Adım | Beklenen |
|---|---|---|
| 1 | Kotalı bir kampanya seçip sipariş oluştur (onaylama) | Kampanya kartında "Kota: 0 / 10 **(+1 onay bekliyor)**" |
| 2 | "kullanım" kutusuna bak | "0 kullanım (+1 bekliyor)" |
| 3 | Sipariş formundaki toplam kartını oku | "Kampanya hakkı sipariş onaylandığında düşer." |
| 4 | Siparişi ONAYLA | Kota 1'e çıkar, "onay bekliyor" kaybolur |
| 5 | Siparişi reddet/sil | Bekleyen düşer, kota hiç değişmemiş olur |
| 6 | Kotasız (0) kampanyada sipariş oluştur | "N hak onay bekliyor — kota onay anında düşer." |
| 7 | Aynı paketten 1 sipariş (2 ürünlü) | Bekleyen **1** görünür, 2 değil |
| 8 | İki ayrı siparişte aynı paket | Bekleyen **2** görünür |
| 9 | Siparişi onayla, sonra iptal et | Kota geri iade edilir |
| 10 | Kampanya tarih süzgecini değiştir | "kullanım" süzgeçten etkilenir, "Kota" etkilenmez |

---

### v1.27.0 — Paket bir bütündür

Ortağın senaryosu: paket = 4000 TL'lik telefon + 5000 TL'lik kılıf,
kampanya tipi "Paket Fiyatı", değer 1000 TL.

| # | Adım | Beklenen |
|---|---|---|
| 1 | Sipariş formunda paketi ekle | TEK KUTU çıkar: paket adı, "Paket adedi", içindeki ürünler |
| 2 | Kutudaki ürünlere bak | İki ürün de listelenir; miktar `1 × 1 = 1 adet` yazar |
| 3 | Kampanyayı seç (paketin tamamına) | İndirim ₺8.000, net **₺1.000** (eskiden 2.000 idi) |
| 4 | Paket adedini 4 yap | Ürün miktarları 4'e çıkar, net **₺4.000** |
| 5 | Pakette 2 adet olan bir ürün varsa | 4 pakette 8 adet gösterir |
| 6 | Aynı paketi tekrar "Paketten kalem ekle" | Yeni kutu AÇILMAZ, adet 1 artar |
| 7 | Bir ürünün birim fiyatını değiştir | Paket bedeli ve indirim yeniden hesaplanır |
| 8 | Paket kutusundaki çöp kutusu | Paketin BÜTÜN satırları birden kalkar |
| 9 | Siparişi kaydet → detayına bak | Her ürün ayrı satır, paket rozetiyle |
| 10 | Siparişi onayla | Her ürün için AYRI stok düşer |
| 11 | Kampanya ekranına bak | Kota **1** düşer (2 değil — paket sayar) |
| 12 | Siparişi iptal et | Kota 1 iade edilir (düşümle simetrik) |
| 13 | Paket adedi 4 iken onayla | Kota 4 düşer |
| 14 | Yüzde tipli kampanya seç | İndirim paketin tamamına uygulanır |
| 15 | "3 al 2 öde" kampanyası, 3 paket | Bir PAKET bedava |
| 16 | Ayrı bir ürün kalemi ekle (paketsiz) | Eskisi gibi: kendi miktarı, iskontosu, kampanyası |
| 17 | Teklifte aynı paketi ekle | Aynı davranış; rakam siparişle aynı |
| 18 | Teklifi siparişe dönüştür | Paket adedi ve kampanya taşınır, rakam değişmez |
| 19 | Paket kutusunda kampanya yokken | "Bu firma ve paket için geçerli kampanya yok" yazar |
| 20 | Çok büyük tutarlı bir "tutar" kampanyası | Net 0'ın altına inmez |

---

### v1.26.1 — Kampanya paket kapsamı, ziyaret konumu, paket görünürlüğü

**Kampanya paket kapsamı (asıl hata)**

| # | Adım | Beklenen |
|---|---|---|
| 1 | Bir paket tanımla (2 ürün), sonra kapsamı YALNIZCA o paket olan bir kampanya aç | Kaydedilir |
| 2 | Sipariş formunda o paketi "Paketten kalem ekle" ile ekle | Satırlarda kampanya listede ÇIKAR |
| 3 | Aynı formda kapsam dışı bir ürün satırı ekle | O satırda kampanya ÇIKMAZ (eskiden çıkıyordu) |
| 4 | Kampanyayı seçip siparişi kaydet, sonra ONAYLA | Kampanya ekranında "kullanım" sayısı ARTAR |
| 5 | Kotalı bir kampanyada aynısını yap | "Kota: n / m" artar, kalan azalır |
| 6 | Siparişi iptal et | Kota İADE edilir |
| 7 | Kapsamı ürün + paket birlikte olan kampanya | Hem o ürün satırında hem paket satırlarında çıkar |
| 8 | Kapsamı tamamen boş kampanya | Her satırda çıkar ("Boş = hepsi") |
| 9 | Teklifte aynı paketi ekle | Kampanya teklifte de görünür |
| 10 | Teklifi siparişe dönüştür | Ürün, paket ve kampanya taşınır |

**Ziyaret konumu**

| # | Adım | Beklenen |
|---|---|---|
| 11 | `/ziyaretler` → firma seç → **Ziyareti Başlat** | Tarayıcı konum izni sorar; ayrı "konum al" düğmesi YOK |
| 12 | İzin ver | "Konum alınıyor…" → ziyaret açılır, doğrulama sonucu yazar |
| 13 | İzni reddet | Ziyaret YİNE açılır, "doğrulanamadı" olur |
| 14 | Firma seçmeden başlat | Konum istenmez, form uyarır |
| 15 | Ziyareti bitir | Konum SORULMAZ |
| 16 | Ziyaret açıkken sekmeyi arka planda bırak | Konum yeniden alınmaz (takip yok) |

**Paket görünürlüğü**

| # | Adım | Beklenen |
|---|---|---|
| 17 | Firma kartı → **Satış** sekmesi | "Firmaya Açık Paketler" bölümü, tekliflerin üstünde |
| 18 | Firmaya özel bir paket bak | "firmaya özel" rozeti; genel paketlerde "genel" |
| 19 | Paket kartındaki kalemler | Miktar, birim, ürün kodu ve adı yazar |
| 20 | Ziyaret başlat, ziyaret ekranına bak | "Bu firmaya açık paketler" listesi çıkar |
| 21 | Ziyareti bitir | Liste kaybolur (açık ziyaret yok) |
| 22 | `urun.goruntule` izni olmayan kullanıcı | İki ekranda da paket bölümü YOK |
| 23 | Başka kiracının firmasında | Kendi paketlerinden hiçbiri görünmez |

---

### v1.26.0 — Modal davranışı ve Ayarlar bölümü

**Açılır pencereler** (herhangi bir modal: kampanya, ürün, aktivite, aday…)

| # | Adım | Beklenen |
|---|---|---|
| 1 | `/kampanyalar` → Düzenle | Pencere ekranın ORTASINDA açılır |
| 2 | Kapsam listesinde bir onay kutusuna tıkla | Pencere ZIPLAMAZ, olduğu yerde kalır |
| 3 | Uzun bir formu aç, aşağı kaydır | Sayfa değil, PENCERENİN İÇİ kaydırılır |
| 4 | Pencerenin sonuna gelip kaydırmayı sürdür | Arkadaki sayfa kaymaz |
| 5 | Bir metin alanında tıklayıp imleci pencere dışına sürükleyip bırak | Pencere KAPANMAZ, veri durur |
| 6 | Kapsam listesinde tıklayıp dışarı sürükleyip bırak | Pencere KAPANMAZ |
| 7 | Pencerenin dışına KASITLI tıkla | Pencere kapanır |
| 8 | Esc'e bas | Kapanan modallarda eskisi gibi kapanır |
| 9 | Kart içinden açılan bir modal (ör. kalem düzenle) | Ekranın ortasında, kartta sıkışmıyor |
| 10 | Yan paneli aç (`?panel=`) | Hâlâ sağa yaslı ve tam yükseklik |
| 11 | Ctrl+K komut paleti | Hâlâ üstten (12vh) açılıyor |
| 12 | Dar ekranda uzun bir modal aç | Kaydırılabiliyor, düğmelere erişilebiliyor |

**Ayarlar bölümü**

| # | Adım | Beklenen |
|---|---|---|
| 13 | Sol menüye bak | Yönetim altında **Ayarlar**, Denetim Günlüğü, KVKK var |
| 14 | Eski satırları ara (Gruplar, Yedekler, AI…) | Sol menüde YOK — Ayarlar'ın sekmesi oldular |
| 15 | **Ayarlar**'a tıkla | Görebildiğin ilk ayar ekranı açılır |
| 16 | Üstteki sekme çubuğuna bak | Kullanıcılar, Gruplar, Özel Alanlar, Satış Aşamaları, Otomasyon, E-posta, AI Özellikleri, Yedekler, İçe Aktar |
| 17 | **E-posta** sekmesine geç | `/otomasyon/eposta` açılır, sekme işaretli |
| 18 | **Otomasyon** sekmesine geç | Otomasyon işaretli, E-posta değil |
| 19 | Otomasyon ekranında "E-posta Ayarları" düğmesini ara | YOK (artık kardeş sekme) |
| 20 | **Satış Aşamaları** sekmesi | `/firsatlar/asamalar` açılır, çubuk AYARLAR'ın |
| 21 | `/firsatlar`'a git | Çubuk CRM'in, "Fırsatlar" işaretli |
| 22 | Eski yer imleriyle gir: `/yedekler`, `/ai`, `/gruplar` | Hepsi çalışıyor (rota değişmedi) |
| 23 | `kullanici@gezegen.com` ile gir | Ayarlar ya hiç görünmez ya da yalnızca izinli sekmeleri |
| 24 | Salt okunur kullanıcıyla gir | Ayarlar bölümü görünmez |

---

### v1.25.1 — Kampanya kapsamında çoklu seçim

| # | Adım | Beklenen |
|---|---|---|
| 1 | `/kampanyalar` → bir kampanyada **Düzenle** | Modal açılır |
| 2 | Ürünler / Paketler / Firmalar alanlarına bak | Her satırın SOLUNDA onay kutusu var |
| 3 | Hiçbiri seçili değilken üst yazıyı oku | "Hiçbiri seçili değil" |
| 4 | Üç ürün işaretle | Üstte "3 / N seçili" yazar |
| 5 | Ctrl BASMADAN başka bir satıra tıkla | Önceki seçimler DURUYOR (eski hata) |
| 6 | **Tümünü seç**'e bas | Hepsi işaretlenir, sayaç N / N olur |
| 7 | Aynı düğmeye tekrar bas (artık "Temizle") | Hepsi kalkar |
| 8 | Firmalar alanında arama kutusuna "anadolu" yaz | Yalnızca eşleşenler kalır |
| 9 | "ANADOLU" (büyük harfle) yaz | Aynı sonuçlar (Türkçe duyarsız) |
| 10 | Arama açıkken **Tümünü seç** | Yalnızca görünenler seçilir |
| 11 | Aramayı temizle | Arama dışındaki eski seçimler DURUYOR |
| 12 | Ürünler alanı (8'den az kayıt) | Arama kutusu YOK (yer kaplamaz) |
| 13 | Seçimleri yapıp **Kaydet** | Kapsam doğru kaydedilir |
| 14 | Aynı kampanyayı tekrar aç | Kaydedilen seçimler işaretli gelir |
| 15 | Kapsamı tamamen boşalt ve kaydet | "Boş = hepsi" davranışı korunur |
| 16 | Koyu temada aç | Onay kutuları ve sayaç okunur |

---

### v1.25.0 — Paket satışa bağlandı

| # | Adım | Beklenen |
|---|---|---|
| 1 | Ürünler → Paketler → yeni paket (genel, iki ürün, iskontolu) | Paket kaydedilir |
| 2 | `/siparisler/yeni` → firma seç | Kalemler başlığında **Paketten kalem ekle** görünür |
| 3 | Paketi seç | Paketin her ürünü AYRI satır olur; açıklamada paket adı geçer |
| 4 | Satır fiyatlarına bak | Birim fiyat liste fiyatı değil, PAKET fiyatıdır |
| 5 | Satırdaki mavi rozeti oku | "… paketinden — fiyat paketten geldi" yazar |
| 6 | Siparişi kaydet → detayına bak | Kalem satırında "PKT-… paketi" rozeti var |
| 7 | Siparişi onayla | Stok her ürün için AYRI AYRI düşer (paket tek satır değil) |
| 8 | Firmaya özel bir paket tanımla (A firması) | Kaydedilir |
| 9 | Sipariş formunda B firmasını seç | O paket listede YOK |
| 10 | A firmasını seç | Paket listeye gelir |
| 11 | Paketi ekle, sonra firmayı B'ye çevir | Fiyat kalır ama paket rozeti DÜŞER |
| 12 | Paketten gelen satırda ürünü değiştir | Rozet düşer (damga artık doğru değil) |
| 13 | Firma seçmeden forma bak | "Paket için önce firma seçin" yazar (alan gizlenmez) |
| 14 | Hiç aktif paket yokken forma bak | "Bu firmaya açık aktif paket yok" yazar |
| 15 | `/teklifler/yeni` → paketten kalem ekle | Teklifte de aynı şekilde çalışır |
| 16 | Teklifi kaydet, detayına bak | Kalemde paket rozeti görünür |
| 17 | Teklifi kabul et → "Siparişe dönüştür" | Ürün, paket ve kampanya siparişe TAŞINIR |
| 18 | Teklifi revize et | Revizyonda ürün/paket/kampanya bağları korunur |
| 19 | `admin@anadolu.com` ile sipariş formu | Gezegen'in paketlerinden hiçbiri görünmez |
| 20 | Yedek al → temiz kiracıya geri yükle | Teklif kalemleri FK hatası vermeden yüklenir |

---

### v1.24.0 — Liquid glass tema

Ön sürüm olarak çıktı (`-pre.1`, `-pre.2`), ortak onayladı ve `v1.24.0`
olarak kapandı. Senaryolar görünümü değil, **hiçbir şeyin bozulmadığını**
sınar.

| # | Adım | Beklenen |
|---|---|---|
| 1 | Açık temada giriş yap | Üst çubuk, sol menü ve sekme çubuğu buzlu cam; kenarlarında ince ışık |
| 2 | Tema düğmesiyle koyuya geç | Cam koyu tona geçer, kenar ışığı zayıflar; geçiş yumuşak |
| 3 | Koyuda sayfayı yenile | Tema koyu kalır (next-themes bozulmadı) |
| 4 | Sol menüde bir bölüme tıkla | Etkin öğenin kapsülü kayarak gelir; doğru sayfa açılır |
| 5 | Sekme çubuğunda sekme değiştir | Kapsül kayar; rota değişir |
| 6 | **Açık temada** imleci cam yüzeyde gezdir | Parlama imleci izler |
| 6b | **Koyu temada** imleci cam yüzeyde gezdir | Parlama YOK — beyaz hale hiç çizilmez (pre.2) |
| 7 | Sol menüdeki her bağlantıyı tek tek dene | Hepsi eskisi gibi açılıyor |
| 8 | Üst çubukta kullanıcı menüsünü aç | Açılır menü görünüyor ve tıklanabiliyor (cam onu hapsetmiyor) |
| 9 | Bildirim ziline tıkla | `/bildirimler` açılır |
| 10 | Ctrl+K → palet | Cam palet açılır, arama çalışır, ↑↓ ↵ Esc çalışır |
| 11 | Listede özet düğmesi → yan panel | Cam panel açılır, "Tam sayfada aç" çalışır |
| 12 | Dar ekranda mobil menüyü aç | Cam çekmece açılır, öğeler tıklanabilir, seçili öğe kapsüllü |
| 13 | Bir formu doldur ve kaydet (ör. yeni firma) | Kayıt oluşur — cam hiçbir alanı engellemiyor |
| 14 | Bir modal aç (ör. kalem düzenle) | Modal ekranın ortasında; kart içinde sıkışmıyor |
| 15 | Kanban'da kart sürükle | Sürükle-bırak çalışıyor |
| 16 | `/raporlar/mali` → Yazdır | Önizlemede cam, ışık ve ızgara YOK; künye ve tablolar temiz |
| 17 | Teklif çıktısını yazdır | Belge eskisi gibi; cam iz bırakmıyor |
| 18 | İşletim sisteminde "hareketi azalt"ı aç | Parlama imleci izlemez; diğer her şey çalışır |
| 19 | Safari / Firefox ile gir | Kırılma yok ama sade buzlu cam var; hiçbir işlev kaybı yok |
| 20 | Sayfayı uzun süre kaydır | Takılma yok |

---

### v1.23.0 — Kampanya kapsamı ve rapor PDF'i

| # | Adım | Beklenen |
|---|---|---|
| 1 | Kampanyalar → kapsamsız bir kampanya oluştur (aktif, tarih geçerli) | Kaydedilir |
| 2 | Yeni sipariş aç, firma seç | Kampanya alanı görünür, kampanya listede |
| 3 | Yeni kampanya oluştur, kapsamına **bir ürün** ekle | Kaydedilir |
| 4 | Yeni siparişte ürün seçmeden bak | "Ürün seçin — kampanyaların bir kısmı belirli ürünlere tanımlıdır" |
| 5 | Aynı satırda o ürünü seç | Kampanya listede belirir |
| 6 | Başka bir ürün seç | Kampanya listeden düşer, seçiliyse temizlenir |
| 7 | Kapsamına **bir firma** eklenmiş kampanya | Yalnızca o firma seçiliyken görünür |
| 8 | Firmayı değiştir | Geçersiz kalan kampanya seçimi otomatik temizlenir |
| 9 | Kotası dolmuş kampanya | Listede hiç görünmez |
| 10 | Tarihi geçmiş kampanya | Listede hiç görünmez |
| 11 | Hiç kampanya tanımlı değilken | "Tanımlı aktif kampanya yok" (alan yine görünür) |
| 12 | Yeni teklif aç | **Ürün (katalogdan)** seçici ve kampanya alanı var |
| 13 | Teklifte ürün + kampanya seç | Satırda "Kampanya indirimi: …" görünür |
| 14 | Teklifi kaydet, detayına bak | Kalem tablosunda kampanya kodu ve indirim; toplamlarda **Kampanya indirimi** ve **İskonto** ayrı satır |
| 15 | Teklif çıktısını al (Yazdır) | Kalemin altında kampanya adı, toplamlarda iki ayrı indirim satırı |
| 16 | Teklifi kabul et → **Siparişe Dönüştür** | Ürün ve kampanya sipariş formuna taşınmış gelir |
| 17 | Siparişi kaydet, detayına bak | Kampanya kodu kalemde görünür, indirim uygulanmış |
| 18 | Tarayıcı konsolundan geçersiz bir kampanya id'si göndermeyi dene | Sunucu indirimi UYGULAMAZ (kapsam doğrulanır) |
| 19 | Serbest metin kalem yaz (ürün seçmeden) | Kaydedilir — katalog bağı opsiyoneldir |
| 20 | Eski (v1.22 öncesi) bir teklifi aç | Rakamları değişmemiş, düzenlenebilir |
| 21 | `/raporlar/mali` → **Yazdır / PDF Kaydet** | Yazdırma önizlemesi açılır |
| 22 | Önizlemeye bak | Sol menü, üst çubuk, sekme çubuğu ve süzgeç formu YOK |
| 23 | Önizlemenin başına bak | Kuruluş adı, rapor adı, dönem ve çıktı tarihi yazıyor |
| 24 | PDF olarak kaydet, Türkçe karakterlere bak | Ş, İ, Ğ, Ü kusursuz |
| 25 | Tarih aralığı seçip tekrar yazdır | Künyedeki dönem seçilen aralığı gösterir |
| 26 | Satış, Ürün, Aktivite, Genel ve Destek raporlarında tekrarla | Hepsinde PDF düğmesi ve künye var |

---

### v1.22.0 — Menü konsolidasyonu

| # | Adım | Beklenen |
|---|---|---|
| 1 | Sol menüye bak | Genel Bakış · CRM · Satış Yönetimi · Takvim · Raporlar · SSS (Bilgi Bankası) + Yönetim |
| 2 | **CRM**'e tıkla | Firmalar açılır; üstte sekme çubuğu: Firmalar · Fırsatlar · Kontaklar · Aktiviteler · Projeler · Destek · Ziyaretler · Anketler · Kampanyalar · Yatırım · Eğitimler · Hizmetler |
| 3 | Çubuktan **Kontaklar**'a geç | `/kisiler` açılır; sol menüde CRM işaretli kalır |
| 4 | **Satış Yönetimi**'ne tıkla | Teklifler açılır; çubuk: Teklifler · Siparişler · Sevkiyat · Stok · Ürünler |
| 5 | Ürünler sekmesinden **Paketler**'e geç | Ürünler sekmesi işaretli kalır (paketler alt görünümdür) |
| 6 | Fırsatlar → **Adaylar** sekmesi | Fırsatlar sekmesi işaretli kalır |
| 7 | **Takvim**'i aç | Bölüm sekme çubuğu YOK (tek ekranlı) |
| 8 | **Raporlar**'ı aç | Çubuk yok; rapor merkezinin kendi kartları duruyor |
| 9 | Bir firma detayına gir | Çubuk yok; firmanın kendi sekmeleri (Genel/Satış/…) görünür |
| 10 | **Yönetim** başlığına bak | İçe Aktar artık burada |
| 11 | Eski yer imini aç (`/kisiler`, `/urunler`, `/kampanyalar`) | Hepsi açılır — rotalar değişmedi |
| 12 | Kayıtlı bir görünüm bağlantısını aç | Süzgeçleriyle birlikte açılır |
| 13 | Yalnızca teklif izni olan kullanıcıyla gir | Satış çubuğunda sadece Teklifler; CRM'de sadece izinli ekranlar |
| 14 | Hiçbir satış izni olmayan kullanıcı | Sol menüde **Satış Yönetimi** başlığı hiç görünmez |
| 15 | Salt okunur kullanıcı | Bölümler görünür, çubuklar izinli sekmelerle dolu |
| 16 | Mobil menüyü aç (dar ekran) | Aynı bölümler; bölüme tıklayınca izinli ilk ekran açılır |
| 17 | Ctrl+K → bir firma ara | Palet çalışmaya devam ediyor |

---

### v1.21.0 — AI özellikleri (Faz 21)

| # | Adım | Beklenen |
|---|---|---|
| 1 | `/ai` ekranını aç (yeni kiracı) | AI **kapalı**; düğme "Aç" yazar |
| 2 | "Modele gönderilenler" listesine bak | Alanlar tek tek yazılı (belirsiz cümle yok) |
| 3 | "Hiçbir zaman gönderilmeyenler" listesi | Kişi telefonu, dosyalar, konum, anket yanıtları sayılı |
| 4 | Anahtar tanımlı değilken duruma bak | "sağlayıcı anahtarı tanımlı değil" |
| 5 | Üye hesabıyla `/ai` | Ekran açılır, "yalnızca kuruluş yöneticisi" uyarısı; kullanım defteri YOK |
| 6 | Salt okunur hesapla `/ai` | `/yetkisiz` — AI bir eylemdir, okuma değil |
| 7 | Fırsat listesi (görünüm=liste) | **Skor** sütunu var; AI kapalı olsa da dolu |
| 8 | Skor rozetine tıkla | Gerekçe listesi: aşama, sektör, temas… her biri açıklamalı |
| 9 | Yeni kiracıda (az kapanmış iş) skora bak | "skor henüz güvenilir değil" uyarısı |
| 10 | Aynı fırsatı iki kez aç | Skor **aynı** (denetlenebilirlik) |
| 11 | Hiç aktivitesi olmayan fırsat | Skor düşük, gerekçede "hiç aktivite kaydı yok" |
| 12 | Kanban kartlarına bak | Skor rozeti kartta da var |
| 13 | Adaylar listesi | Skor sütunu var; dönüşmüş/elenmiş adaylarda "—" |
| 14 | Firma ekranı → Genel sekmesi | **Özet** paneli maddelerle dolu (model çağrılmadan) |
| 15 | Özette hiç fırsatı olmayan firma | "Teklifler"/"Siparişler" satırı hiç çıkmaz |
| 16 | AI kapalıyken özet panelindeki düğme | Düğme yok; yerine kapalı olduğu yazıyor |
| 17 | AI'ı aç, "Paragraf hâline getir" | Anahtar yoksa "anahtar tanımlı değil" hatası, panel düşmez |
| 18 | Anahtar tanımlıyken aynı düğme | Paragraf gelir; "Maddelere dön" ile geri dönülür |
| 19 | Yönetici → `/ai` kullanım defteri | Çağrı tarihi, kullanıcı, konu, token, sonuç görünür |
| 20 | Defterde istem/yanıt metni ara | YOK — yalnızca künye tutulur |
| 21 | Ctrl+K → "İzmir'deki onaylanmış hibeler" → doğal dil satırı | Yatırım destekleri, il=İzmir, durum=onaylandı |
| 22 | Ctrl+K → "onay bekleyen siparişler" | `/siparisler?durum=onaybekliyor` |
| 23 | Ctrl+K → "kaybedilen fırsatlar" | Liste görünümü açılır (kanban yalnızca açıkları gösterir) |
| 24 | Ctrl+K → "bugün hava nasıl" | "Bu cümleyi anlayamadım" — yanlış listeye GÖTÜRMEZ |
| 25 | AI kapalıyken 21-23'ü tekrarla | Kural tabanlı olanlar yine çalışır (anahtar gerekmez) |
| 26 | Sipariş izni olmayan hesapla "onay bekleyen siparişler" | Sorgu o listeye götürmez |
| 27 | `/kvkk` aydınlatma metni | "Yapay zekâ destekli özellikler" bölümü var; sürüm `2026-08-4` |
| 28 | AI'ı kapat → `/denetim` | "AI özellikleri kapatıldı" kaydı düşmüş |
| 29 | `admin@anadolu.com` ile `/ai` | Gezegen'in kullanım defteri görünmez |

---

### v1.20.0 — Birleşik çalışma ekranı (Faz 20)

| # | Adım | Beklenen |
|---|---|---|
| 1 | Herhangi bir ekranda **Ctrl/Cmd + K** | Komut paleti açılır, imleç arama kutusundadır |
| 2 | Tek harf yaz | "Aramak için en az 2 harf yazın" |
| 3 | Bir firma adının Türkçe küçük hâliyle ara ("ısparta") | Büyük harfli kayıt da bulunur (Türkçe duyarsız) |
| 4 | Firma numarasını yaz (`A0001`) | Tam eşleşen firma listenin başında |
| 5 | ↑ ↓ ile gez, ↵ ile aç | Seçili satır vurgulanır; ↵ kaydı açar |
| 6 | Palette "sipariş" yaz | Arama sonuçlarının yanında **Yeni sipariş** eylemi çıkar |
| 7 | Üye hesabıyla palette "yeni sipariş" ara | Yetkisi yoksa eylem GÖRÜNMEZ |
| 8 | Salt okunur hesapla bir teklif ara | Teklif izni yoksa teklif sonucu hiç gelmez |
| 9 | **Esc** | Palet kapanır, sayfa değişmez |
| 10 | Firma listesinde satırdaki panel simgesine tıkla | Yandan özet paneli açılır; liste, süzgeç ve kaydırma yerinde kalır |
| 11 | Panel açıkken sayfayı **yenile** | Panel açık gelir (adres `?panel=firma:...`) |
| 12 | Tarayıcının **geri** tuşu | Panel kapanır, listeye dönülür |
| 13 | Panelde **Tam sayfada aç** | Kaydın kendi sayfası açılır |
| 14 | Adres çubuğuna `?panel=uydurma:1` yaz | Panel açılmaz; sayfa normal çalışır |
| 15 | `admin@anadolu.com` ile Gezegen firmasının panel adresini aç | Panel "Kayıt bulunamadı" der; hiçbir bilgi sızmaz |
| 16 | Firma detayını aç | Sekme çubuğu görünür; **Genel** sekmesi künye + zaman akışı gösterir |
| 17 | **Satış** sekmesi | Teklifler, Fırsatlar ve **Siparişler** aynı ekranda |
| 18 | **Proje & Destek** sekmesi | Firmanın projeleri ve destek kayıtları listelenir |
| 19 | **Belge & Saha** sekmesi | Ekler ve ziyaret geçmişi (süre + konum kararı) |
| 20 | Sekme bağlantısını kopyalayıp yeni sekmede aç | Aynı sekme açılır (adres `?sekme=satis`) |
| 21 | `?sekme=uydurma` yaz | Sessizce **Genel** açılır, hata sayfası çıkmaz |
| 22 | Sipariş izni olmayan hesapla firma ekranı | Satış sekmesinde Siparişler bölümü hiç çizilmez |
| 23 | Tekliften açılmış bir siparişin detayını aç | Üstte **İlişkili Kayıtlar** şeridi: Fırsat → Teklif → Sipariş → Sevkiyat |
| 24 | Şeritte **Teklif** halkasına tıkla | Teklifin sayfası açılır; orada zincir aynı görünür |
| 25 | Sevkiyatı olmayan siparişte şeride bak | Sevkiyat halkası "—" olarak durur, gizlenmez |
| 26 | Hiçbir ilişkisi olmayan bir teklifin detayı | Şerit HİÇ çizilmez (tek halka bilgi vermez) |
| 27 | Sevkiyat izni olmayan hesapla aynı sipariş | Sevkiyat halkası boş gelir; "yetkiniz yok" yazmaz |

---

### v1.19.0 — Anket ve oturumsuz yanıt toplama (Faz 19)

| # | Adım | Beklenen |
|---|---|---|
| 1 | `/anketler` → **Yeni Anket** (anonim işaretli) | Anket taslak olarak açılır; anonim rozeti listede görünür |
| 2 | Soru ekle: ölçek 0-10, çoktan seçmeli, serbest metin | Seçenek alanı YALNIZCA çoktan seçmelide çıkar |
| 3 | Çoktan seçmeliye tek seçenek gir | "En az iki seçenek girin" |
| 4 | Anketi **Yayında** yap → **Gönder** | Kontak listesi açılır; e-postasız kontaklar listede yok |
| 5 | Aynı kişiye ikinci kez göndermeyi dene | Kişi "gönderildi" işaretli ve seçilemez |
| 6 | Taslak ankette **Gönder** | "Yalnızca yayındaki anketler gönderilebilir" |
| 7 | Sorusuz ankette **Gönder** | "Sorusuz anket gönderilemez" |
| 8 | E-postadaki bağlantıyı **gizli pencerede** (giriş yapmadan) aç | Anket açılır — giriş İSTEMEZ |
| 9 | Anonim ankette sayfanın başına bak | "Bu anket anonimdir: yanıtlarınız adınıza veya firmanıza bağlanmaz" |
| 10 | Zorunlu soruyu boş bırakıp gönder | Soru adıyla birlikte hata; hiçbir yanıt kaydedilmez |
| 11 | Yanıtları gönder | Teşekkür ekranı çıkar |
| 12 | AYNI bağlantıyı yeniden aç | "Bu anketi daha önce yanıtladınız" — tek kullanımlık |
| 13 | Anketin bitiş tarihini geçmişe çekip bağlantıyı aç | "Yanıtlama süresi dolmuştur" (ayrı mesaj) |
| 14 | Uydurma bir token ile `/anket/xyz` aç | "Bağlantı geçersiz" — kuruluş adı bile görünmez |
| 15 | Ankette **Sonuçlar** | Yanıtlama oranı, NPS, soru bazında dağılım |
| 16 | Anonim raporda firma kırılımına bak | "Kırılım teknik olarak üretilemez" — veri yoktur |
| 17 | Kimlikli ankette aynı yere bak | Firma kırılımı dolu gelir |
| 18 | Yayınlanmış ankette anonimliği değiştirmeyi dene | Alan kilitli; sunucu da reddeder |
| 19 | Yanıt gelmiş ankete soru eklemeyi dene | "Yanıt toplanmış ankete yeni soru eklenemez" |
| 20 | Üye hesabıyla `/anketler` | Liste açılır, **Yeni Anket** düğmesi YOK |
| 21 | `/kvkk` aydınlatma metni | "Anket yanıtları" bölümü var; sürüm `2026-08-3` |
| 22 | `admin@anadolu.com` ile `/anketler` | Gezegen'in anketleri görünmez |

---

### v1.18.0 — Rapor merkezi ve firma dosyası (Faz 18)

| # | Adım | Beklenen |
|---|---|---|
| 1 | `/raporlar` (menüde **Raporlar**) | Rapor kartları gruplu listelenir; merkez hiçbir rakam hesaplamaz |
| 2 | **Bu çeyrek** hazır aralığına bas | Dönem URL'e yazılır; başlıkta görünür |
| 3 | **Mali Rapor** kartına gir | Seçilen dönem taşınmış olarak açılır |
| 4 | Ciro kutusuna bak | Yalnızca ONAYLI siparişlerin toplamı; bekleyen sipariş dahil değil |
| 5 | "Beklenen tahsilat" kutusunun altını oku | "Tahmindir — ödeme kaydı tutulmaz" yazar; üç kalemi ayrı gösterilir |
| 6 | Kapalı bir aralık seçip ciroya bak | Önceki AYNI UZUNLUKTAKİ dönemle karşılaştırma yüzdesi çıkar |
| 7 | Yalnızca başlangıç tarihi ver | Karşılaştırma GÖSTERİLMEZ (açık uçlu aralıkta önceki dönem tanımsız) |
| 8 | **Satış Hattı** raporu | Dönüşüm oranı kapanmış işler üzerinden; açık fırsatlar paydada değil |
| 9 | **Aktivite Yükü** raporu | Kişi tablosunda geciken sayısı açık görevlerin içinde |
| 10 | **Ürün Satışı** raporu | Tutar ve adet kırılımı; kalemler onaylı siparişlerden gelir |
| 11 | **Destek Raporu** kartına bas | Modülün kendi ekranına (`/destek/rapor`) gider; kart bunu yazar |
| 12 | Merkezde bir dönem seçip **Görünüm kaydet** | Kayıtlı görünüm oluşur; varsayılan yapılırsa `/raporlar` doğrudan o döneme açılır |
| 13 | Firma detayı → **Dosya (PDF)** | Künye, kontaklar, fırsat, teklif, sipariş, proje, destek, ziyaret ve zaman akışı tek belgede |
| 14 | Belgede **Yazdır**'a bas | Arayüz kabuğu ve düğmeler baskıda görünmez; kuruluş logosu ve rengi çıkar |
| 15 | `?bas=&bit=` ile dosyayı dönemli aç | Kayıtlar süzülür; künye ve kontaklar SÜZÜLMEZ |
| 16 | Salt okunur kullanıcıyla aynı dosyayı aç | Belge açılır ama izni olmayan modüller belgeye GİRMEZ |
| 17 | `admin@anadolu.com` ile `/raporlar/mali` | Yalnızca kendi kiracısının rakamları |

---

### v1.17.0 — Dosya eki, ziyaret ve konum (Faz 17)

| # | Adım | Beklenen |
|---|---|---|
| 1 | Firma detayı → **Ekler** bölümünde **Dosya** ile bir PDF yükle | Ek listeye düşer, boyutu ve yükleyeni yazar |
| 2 | Bir `.exe` dosyasının adını `.jpg` yapıp yükle | Reddedilir: "Bu dosya türü kabul edilmiyor" (imza uyuşmuyor) |
| 3 | 10 MB'tan büyük bir dosya seç | Sunucuya gitmeden uyarı çıkar |
| 4 | Telefonla girip **Fotoğraf** düğmesine bas | Arka kamera açılır; çekilen görsel küçültülerek yüklenir |
| 5 | Eke tıkla | Görsel tarayıcıda açılır, belge iner (`nosniff` ile) |
| 6 | Üye hesabıyla aynı ekleri aç | Yükleyebilir ama **Sil** düğmesi YOK |
| 7 | Yönetici ile bir eki sil | Onay sorar; silinince listeden ve diskten gider |
| 8 | Aktivite listesinde ataç simgesine bas | Satır içinde ek bölümü açılır, sayı görünür |
| 9 | Firma düzenle → **Bulunduğum konumu kullan** | Enlem/boylam alanları dolar; kaydedince detayda harita bağlantısı çıkar |
| 10 | Anahtar tanımsızken koordinatı boş bırak | "Harita anahtarı tanımlı olmadığı için koordinat elle girilir" yazar; kayıt yine açılır |
| 11 | `/ziyaretler` → **Konumumu al** → **Ziyareti Başlat** | Ziyaret açılır; firmaya yakınsanız yeşil "Konum doğrulandı" |
| 12 | Konum iznini reddedip ziyaret başlat | Ziyaret YİNE açılır, sarı "Konum doğrulanamadı" olur |
| 13 | Firmadan uzakta ziyaret başlat | Kırmızı "Konum uyuşmuyor" + yöneticinin zilinde bildirim |
| 14 | Açıkken ikinci bir ziyaret açmayı dene | "Açık bir ziyaretiniz var; önce onu bitirin" |
| 15 | **Ziyareti Bitir** (not yazarak) | Süre kendiliğinden hesaplanır; süre alanı istenmez |
| 16 | Firma detayında zaman akışına bak | "Saha ziyareti" aktivitesi süre ve konum notuyla görünür |
| 17 | `/ziyaretler`de konum süzgecini **Uyuşmuyor** yap | Yalnızca kırmızı ziyaretler listelenir |
| 18 | Kuruluş yarıçapını değiştir, eski ziyaretlere bak | Geçmiş kararlar DEĞİŞMEZ (yarıçap kayıtta saklanır) |
| 19 | `admin@anadolu.com` ile `/ziyaretler` | Gezegen'in hiçbir ziyareti görünmez |
| 20 | Yedek al ve indir | Ziyaretler yedekte var; dosya ekleri YOK (volume ayrı yedeklenir — `docs/DEPLOY.md`) |

---

### v1.16.0 — Proje, destek ve bilgi bankası (Faz 16)

| # | Adım | Beklenen |
|---|---|---|
| 1 | `admin@gezegen.com` ile `/projeler` → **Yeni Proje** | Kod tekildir; aynı kodu ikinci kez vermek reddedilir |
| 2 | Başlangıcı bitişten SONRAYA yaz | "Başlangıç tarihi bitişten sonra olamaz" — kayıt açılmaz |
| 3 | Proje detayını aç | Teklif, sipariş ve destek bölümleri; bütçeye karşı onaylı sipariş toplamı çubuğu |
| 4 | `/siparisler/yeni?proje=<id>` ile sipariş aç | Proje seçili gelir; proje detayında listelenir |
| 5 | `/destek` → **Yeni Destek Kaydı** (kanal: telefon, öncelik: kritik) | Kayıt `DST-YIL-0001` numarasıyla **açık** durumunda açılır |
| 6 | Başka bir kullanıcıya ata | Atanan kişinin zilinde bildirim çıkar (kendine atayan kişiye gitmez) |
| 7 | Detayda **İşlem Ekle** | İşlem kronolojik listeye düşer; firmanın zaman akışında da görünür |
| 8 | Durumu **Çözüldü** yap | Çözüm tarihi kendiliğinden damgalanır; "Çözüm süresi" dolar |
| 9 | Kaydı yeniden **İşlemde**'ye çek | Kapanış damgası temizlenir, ÇÖZÜM anı korunur (geri alınmaz) |
| 10 | `/destek` listesine dön | Kapanmış kayıt görünmez — varsayılan görünüm AÇIK işlerdir |
| 11 | Durum süzgecini **Hepsi** yap | Kapanmış kayıt geri gelir |
| 12 | Listeyi öncelikle karşılaştır | Kritik kayıtlar üstte; tarih değil öncelik sıralar |
| 13 | `/destek/rapor` | Kanal kırılımı, öncelik dağılımı, kişi yükü, ortalama çözüm süresi, en uzun bekleyenler |
| 14 | Raporda bir firma seç | Rakamlar yalnızca o firmayı sayar; başlıkta firma adı yazar |
| 15 | Kişi yükü kutusuna bak | Yalnızca AÇIK kayıtlar sayılır; kapanmış işi olan kişi listede yok |
| 16 | `/sss` → **Yeni Soru** (etiket: "İADE, iade") | Tek etiket kaydedilir — Türkçe küçültme ile tekilleşir |
| 17 | Arama kutusuna büyük harfle "FATURA" yaz | Küçük harfli kayıt bulunur (Türkçe duyarsız arama) |
| 18 | Bir soruyu aç, sayfayı yenile | Görüntülenme sayacı artmış |
| 19 | `kullanici@gezegen.com` ile `/sss` | Yanıtları okur ama **Yeni Soru** düğmesi yok |
| 20 | Destek detayında **SSS'de ara** | SSS ekranı kaydın konusu aranmış hâlde açılır |
| 21 | Projeyi sil | Bağlı teklif/sipariş/destek SİLİNMEZ, yalnızca proje bağı kopar |
| 22 | `admin@anadolu.com` ile `/destek` | Gezegen'in hiçbir destek kaydı görünmez |

---

### v1.15.0 — Sipariş, onay ve sevkiyat (Faz 15)

| # | Adım | Beklenen |
|---|---|---|
| 1 | `kullanici@gezegen.com` ile `/siparisler` → **Yeni Sipariş** | Form açılır; ürün seçince fiyat, birim ve KDV katalogdan gelir |
| 2 | Stokta olandan fazla miktar gir | Sarı stok uyarısı çıkar ama kayıt ENGELLENMEZ (asıl kontrol onayda) |
| 3 | Kaydet | Sipariş `SIP-YIL-0001` numarasıyla **onay bekliyor** durumunda açılır |
| 4 | Aynı ekranda "Onayla" düğmesini ara | YOK — üye kendi siparişini onaylayamaz |
| 5 | `admin@gezegen.com` ile `/siparisler` | Üstte "Onayınızı bekleyen …" kuyruğu; zilde bildirim |
| 6 | Siparişi aç → sevkiyat bölümüne bak | "Sipariş onay bekliyor. Onaylanmadan sevkiyat açılamaz." — düğme yok |
| 7 | Stoğu yetmeyen siparişi **Onayla** | "Stok yetersiz" hatası kalem kalem listelenir; stok DEĞİŞMEZ |
| 8 | `/stok`tan giriş yapıp yeniden onayla | Onaylanır; stok düşer, harekette referans olarak sipariş no yazar |
| 9 | Kampanyalı bir siparişi onayla | Kampanya kotası düşer, kullanım defterine referanslı satır girer |
| 10 | Onaylı siparişi **Düzenle** | Engellenir: "Onaylanmış sipariş düzenlenemez" |
| 11 | Onaylı siparişte **Sevkiyat Aç** | Taşıyıcı/takip no formu; sevkiyat `SVK-YIL-0001` numarasıyla açılır |
| 12 | `/sevkiyat` | Durum kırılımı kutuları; "sevkiyat bekleyen onaylı siparişler" bandı |
| 13 | Sevkiyatı **Sevk Et** → **Teslim Edildi** | Tarihler kendiliğinden damgalanır; bekleme günü listede görünür |
| 14 | Sevk edilmiş siparişi **iptal** etmeyi dene | Engellenir: "Sevk edilmiş sipariş iptal edilemez" |
| 15 | Sevkiyatı iptal edip siparişi iptal et | Stok iade HAREKETİYLE geri gelir (`/stok` defterinde görünür) |
| 16 | Bir siparişi gerekçeyle **Reddet** | Gerekçe zorunlu; siparişi girene bildirim gider, detayda kırmızı bantta yazar |
| 17 | Reddedilen siparişi düzenleyip kaydet | Yeniden "onay bekliyor" olur, gerekçe temizlenir |
| 18 | Kabul edilmiş bir teklifte **Sipariş Oluştur** | Form firma ve kalemlerle dolu gelir |
| 19 | `admin@anadolu.com` ile `/siparisler` | Gezegen'in siparişlerinden hiçbiri görünmez |

---

## Çapraz Kiracı Kontrolü (her sürümde tekrarlanır)

Bu, ürünün **en kritik sözüdür** ve her sürüm sonrası yeniden bakılmalıdır.

| # | Adım | Beklenen |
|---|---|---|
| 1 | `admin@anadolu.com` ile gir | Yalnızca Anadolu verisi |
| 2 | Sırayla aç: Firmalar, Kontaklar, Fırsatlar, Adaylar, Teklifler, Aktiviteler, Takvim, Raporlar | Hiçbirinde "Gezegen Danışmanlık" geçmiyor |
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
