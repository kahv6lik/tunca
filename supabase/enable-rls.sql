-- =============================================================================
-- Supabase güvenlik düzeltmesi: Row-Level Security (RLS) etkinleştirme
-- =============================================================================
--
-- NEDEN?
--   Supabase, `public` şemasındaki her tabloyu otomatik olarak internete açık
--   bir REST API (PostgREST) üzerinden yayınlar. Bir tabloda RLS kapalıysa,
--   proje URL'ini bilen HERKES `anon` anahtarıyla o tablodaki tüm veriyi
--   okuyabilir, değiştirebilir ve silebilir. Supabase Security Advisor bunu
--   "rls_disabled_in_public / Table publicly accessible" olarak raporlar.
--
-- BU UYGULAMA İÇİN GÜVENLİ Mİ?
--   Evet. Gezegen CRM veritabanına Prisma ile DOĞRUDAN bağlantı (veritabanı
--   sahibi rolü) üzerinden erişir. RLS yalnızca `anon` / `authenticated` API
--   rollerini kısıtlar; veritabanı sahibi RLS'i her zaman bypass eder. Bu yüzden
--   RLS'i açmak public API'yi kapatır ama Prisma ile çalışan uygulamayı
--   etkilemez. `anon` için bilerek HİÇBİR policy eklemiyoruz — amaç public
--   erişimi tamamen kapatmak.
--
-- NASIL ÇALIŞTIRILIR?
--   Supabase Dashboard → SQL Editor → bu dosyanın içeriğini yapıştır → Run.
--   (Veya `psql "<DB_CONNECTION_STRING>" -f supabase/enable-rls.sql`)
--
--   Çalıştırdıktan sonra: Dashboard → Advisors → Security bölümünün temizlendiğini
--   doğrulayın.
-- =============================================================================

-- Uygulamanın bilinen tabloları -----------------------------------------------
ALTER TABLE IF EXISTS public."User"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Firma"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."YatirimDestegi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Egitim"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Hizmet"         ENABLE ROW LEVEL SECURITY;

-- İsteğe bağlı ama önerilir: `public` şemasındaki RLS'i açık OLMAYAN diğer tüm
-- tabloları da otomatik kapat. (Prisma migration tablosu, ileride eklenen
-- tablolar vb. dahil.) Bu blok tabloları listelemenize gerek kalmadan her şeyi
-- güvenli tarafa çeker.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'          -- yalnızca normal tablolar
      AND c.relrowsecurity = false -- RLS'i henüz açık olmayanlar
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.relname);
    RAISE NOTICE 'RLS etkinleştirildi: public.%', r.relname;
  END LOOP;
END $$;

-- =============================================================================
-- Doğrulama: RLS durumu hâlâ kapalı olan public tabloları listeler (boş dönmeli)
-- =============================================================================
SELECT n.nspname AS schema, c.relname AS table, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = false;
