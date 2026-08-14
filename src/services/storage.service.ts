import { supabase } from '../lib/supabase';

export const storageService = {
  /**
   * Sube un archivo (comprobante PDF o imagen) a Supabase Storage y retorna la URL pública real.
   * Lanza un error claro si Supabase Storage no está disponible o falla la subida.
   */
  async uploadProof(file: File, folder: string = 'comprobantes'): Promise<{ url: string; path: string }> {
    if (!file) {
      throw new Error('No se seleccionó ningún archivo para subir.');
    }

    // Validar tipo de archivo permitido (PDF o imágenes)
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!validMimeTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|gif|pdf)$/i)) {
      throw new Error('Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG, WEBP) o documentos PDF.');
    }

    // Sanitizar nombre de archivo y generar path único
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${cleanFileName}`;
    const filePath = `${folder}/${uniqueFileName}`;

    // Intentar buckets comunes: 'receipts', 'comprobantes', 'attachments'
    const candidateBuckets = ['comprobantes', 'receipts', 'attachments'];
    let lastError: any = null;

    for (const bucket of candidateBuckets) {
      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
          });

        if (!error && data?.path) {
          // Obtener URL pública
          const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(data.path);
          return {
            url: pubData.publicUrl,
            path: data.path,
          };
        }

        if (error) {
          lastError = error;
          // Si es error de bucket no encontrado (404/NoSuchBucket/Bucket not found), probar con el siguiente
          const msg = error.message?.toLowerCase() || '';
          if (msg.includes('not found') || msg.includes('bucket') || (error as any).statusCode === '404') {
            continue;
          } else {
            // Error de permisos o RLS
            throw new Error(`Error en Supabase Storage (${bucket}): ${error.message}`);
          }
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    // Si fallaron todos los buckets
    const errDetail = lastError?.message || 'Bucket de almacenamiento no encontrado';
    throw new Error(
      `No se pudo subir el comprobante a Supabase Storage (${errDetail}). Verifique que el bucket 'receipts' o 'comprobantes' esté creado y con políticas públicas en el panel de Supabase.`
    );
  },

  /**
   * Determina si una URL corresponde a un archivo PDF
   */
  isPdf(url?: string): boolean {
    if (!url) return false;
    const clean = url.split('?')[0].toLowerCase();
    return clean.endsWith('.pdf') || clean.includes('/pdf') || clean.includes('application/pdf');
  },

  /**
   * Determina si una URL corresponde a una imagen
   */
  isImage(url?: string): boolean {
    if (!url) return false;
    const clean = url.split('?')[0].toLowerCase();
    return (
      clean.endsWith('.jpg') ||
      clean.endsWith('.jpeg') ||
      clean.endsWith('.png') ||
      clean.endsWith('.webp') ||
      clean.endsWith('.gif') ||
      clean.endsWith('.svg')
    );
  },
};
