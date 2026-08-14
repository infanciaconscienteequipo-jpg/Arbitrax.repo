-- ============================================================
-- ARBITRAX PRO - STORAGE COMPROBANTES
-- ============================================================
-- Hace público el bucket que usa el frontend para poder visualizar
-- comprobantes después de recargar.
--
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes', 'comprobantes', true)
ON CONFLICT (id)
DO UPDATE SET public = true;

DROP POLICY IF EXISTS "arbitrax_comprobantes_upload" ON storage.objects;
DROP POLICY IF EXISTS "arbitrax_comprobantes_read" ON storage.objects;
DROP POLICY IF EXISTS "arbitrax_comprobantes_update" ON storage.objects;
DROP POLICY IF EXISTS "arbitrax_comprobantes_delete" ON storage.objects;

CREATE POLICY "arbitrax_comprobantes_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'comprobantes');

CREATE POLICY "arbitrax_comprobantes_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'comprobantes');

CREATE POLICY "arbitrax_comprobantes_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'comprobantes')
WITH CHECK (bucket_id = 'comprobantes');

CREATE POLICY "arbitrax_comprobantes_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'comprobantes');

NOTIFY pgrst, 'reload schema';
