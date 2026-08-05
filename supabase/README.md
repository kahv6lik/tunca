# Supabase / Postgres güvenlik notları

Bu klasör, Gezegen CRM'i **Supabase (Postgres)** üzerinde çalıştırdığınızda
gerekli olan güvenlik script'lerini içerir. (Varsayılan kurulum SQLite'tır ve
bu dosyalara ihtiyaç duymaz.)

## "Table publicly accessible / rls_disabled_in_public" uyarısı

Supabase'den şu içerikte bir e‑posta gelebilir:

> **Table publicly accessible** — Anyone with your project URL can read, edit,
> and delete all data in this table because Row-Level Security is not enabled.
> (`rls_disabled_in_public`)

### Neden oluyor?

Supabase, `public` şemasındaki her tabloyu otomatik olarak bir **REST API**
(PostgREST) üzerinden internete açar. Bir tabloda **RLS (Row-Level Security)**
kapalıysa, proje URL'ini ve public `anon` anahtarını bilen herkes o tablodaki
tüm veriye erişebilir. Bu yüzden `public` şemasındaki tüm tablolarda RLS **açık**
olmalıdır.

### Bu uygulama için çözüm güvenli mi?

Evet. Gezegen CRM, veritabanına **Prisma ile doğrudan bağlantı** (veritabanı
sahibi rolü) üzerinden erişir. RLS yalnızca `anon` / `authenticated` API
rollerini kısıtlar; **veritabanı sahibi RLS'i her zaman bypass eder.** Dolayısıyla
tüm tablolarda RLS'i açmak:

- ✅ Herkese açık public API'yi kapatır (güvenlik uyarısı çözülür),
- ✅ Prisma ile çalışan uygulamayı **hiç etkilemez**.

`anon` rolü için bilinçli olarak **hiçbir policy eklenmez** — amaç public erişimi
tamamen kapatmaktır.

> ⚠️ Eğer ileride uygulamanın bir kısmı doğrudan Supabase client (`anon` anahtarı)
> ile veri çekerse, o tablolar için ihtiyaca uygun `CREATE POLICY` ifadeleri
> eklemeniz gerekir. Mevcut mimaride (sadece Prisma) buna gerek yoktur.

## Nasıl uygulanır?

1. Supabase Dashboard → **SQL Editor**'ı açın.
2. [`enable-rls.sql`](./enable-rls.sql) dosyasının içeriğini yapıştırın ve **Run** deyin.
3. Dashboard → **Advisors → Security** bölümünde uyarının kaybolduğunu doğrulayın.

Alternatif olarak komut satırından:

```bash
psql "postgresql://postgres:[PAROLA]@db.wlefxkpuamcjmgazwtun.supabase.co:5432/postgres" \
  -f supabase/enable-rls.sql
```

Script sonundaki `SELECT`, RLS'i hâlâ kapalı olan `public` tablolarını listeler —
**boş sonuç dönmelidir.**
