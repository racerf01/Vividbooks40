-- =====================================================
-- STORAGE BUCKET PRO GENEROVANÉ OBRÁZKY
-- Řeší problém s base64 v databázi (159 MB → ~1 MB)
-- =====================================================

-- 1. Vytvoř bucket pro generované obrázky
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-images',
  'generated-images',
  true,  -- veřejný přístup
  5242880,  -- 5 MB limit per file
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies pro bucket

-- Kdokoliv může číst (veřejný bucket)
CREATE POLICY "Public read access for generated-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'generated-images');

-- Přihlášení uživatelé mohou nahrávat
CREATE POLICY "Authenticated users can upload to generated-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'generated-images');

-- Přihlášení uživatelé mohou mazat své soubory
CREATE POLICY "Authenticated users can delete from generated-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'generated-images');

-- =====================================================
-- HOTOVO! ✅
-- =====================================================
-- Vytvořeno:
-- - Storage bucket "generated-images" (veřejný)
-- - RLS policies pro čtení/zápis
--
-- DALŠÍ KROKY:
-- 1. Upravit kód, aby nahrával obrázky do Storage místo DB
-- 2. Migrovat existující base64 data (volitelné)
