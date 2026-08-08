import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Encabezado de autorización ausente' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Configuración de servidor Supabase incompleta (variables de entorno missing)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Validar el token del cliente llamante
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Token de sesión no válido o expirado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Obtener perfil de public.users
    const { data: callerProfile } = await callerClient
      .from('users')
      .select('*')
      .or(`auth_user_id.eq.${callerUser.id},id.eq.${callerUser.id}`)
      .maybeSingle();

    const callerRole = (callerProfile?.role || '').toUpperCase();

    // Parsear payload de entrada
    const body = await req.json();
    const { email, password, username, name, organization_id, role } = body;

    const requestedRole = (role || 'VENDEDOR').toUpperCase();

    // 3. Validar Permisos Jerárquicos
    // SUPER_ADMIN puede crear ADMIN o VENDEDOR
    // ADMIN solo puede crear VENDEDOR
    if (callerRole === 'ADMIN' && requestedRole !== 'VENDEDOR') {
      return new Response(
        JSON.stringify({ error: 'Un Administrador solo puede crear usuarios con rol VENDEDOR.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callerRole !== 'SUPER_ADMIN' && callerRole !== 'ADMIN') {
      return new Response(
        JSON.stringify({ error: 'No tienes permisos suficientes para crear usuarios.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Si es ADMIN, la organización obligatoriamente debe ser la organización del ADMIN
    const targetOrgId = callerRole === 'ADMIN' ? callerProfile?.organization_id : (organization_id || callerProfile?.organization_id);

    if (!targetOrgId && requestedRole !== 'SUPER_ADMIN') {
      return new Response(
        JSON.stringify({ error: 'Se requiere una organización válida para crear este usuario.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanEmail = email?.trim().toLowerCase();
    if (!cleanEmail) {
      return new Response(
        JSON.stringify({ error: 'El correo electrónico es requerido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanUsername = username ? username.trim().toLowerCase() : cleanEmail.split('@')[0];
    const cleanName = name ? name.trim() : cleanUsername;
    const cleanPassword = password ? password.trim() : 'Arbitrax.2006';

    // 4. Crear usuario usando Admin API con SERVICE_ROLE_KEY (sin alterar sesión activa)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: createdAuth, error: createAuthErr } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: cleanPassword,
      email_confirm: true,
      user_metadata: {
        name: cleanName,
        username: cleanUsername,
        role: requestedRole,
        organization_id: targetOrgId,
      },
    });

    if (createAuthErr || !createdAuth?.user) {
      return new Response(
        JSON.stringify({ error: createAuthErr?.message || 'Error al crear usuario en Supabase Auth.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authUserId = createdAuth.user.id;

    // 5. Insertar en public.users mediante RPC o Insert directo
    let rpcError = null;

    if (requestedRole === 'VENDEDOR') {
      const { error } = await adminClient.rpc('rpc_create_seller', {
        p_auth_user_id: authUserId,
        p_organization_id: targetOrgId,
        p_username: cleanUsername,
        p_name: cleanName,
        p_email: cleanEmail,
      });
      rpcError = error;
    } else if (requestedRole === 'ADMIN') {
      const { error } = await adminClient.rpc('rpc_create_admin', {
        p_email: cleanEmail,
        p_password: cleanPassword,
        p_name: cleanName,
        p_username: cleanUsername,
        p_organization_id: targetOrgId,
      });

      // Si la rpc_create_admin no seteó auth_user_id, asegurarlo
      if (!error) {
        await adminClient.from('users').update({ auth_user_id: authUserId }).eq('email', cleanEmail);
      }
      rpcError = error;
    } else {
      const { error } = await adminClient.from('users').upsert({
        id: authUserId,
        auth_user_id: authUserId,
        username: cleanUsername,
        name: cleanName,
        email: cleanEmail,
        role: requestedRole,
        organization_id: targetOrgId,
        active: true,
        status: 'active',
        created_at: new Date().toISOString(),
      });
      rpcError = error;
    }

    // 6. Si la inserción en public.users falla, eliminar usuario inmediatamente de auth.users (sin huérfanos)
    if (rpcError) {
      console.error('Error al insertar en public.users, revirtiendo auth user:', rpcError.message);
      await adminClient.auth.admin.deleteUser(authUserId);

      return new Response(
        JSON.stringify({ error: `Error en base de datos: ${rpcError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        auth_user_id: authUserId,
        organization_id: targetOrgId,
        role: requestedRole,
        user: {
          id: authUserId,
          auth_user_id: authUserId,
          username: cleanUsername,
          name: cleanName,
          email: cleanEmail,
          role: requestedRole,
          organization_id: targetOrgId,
          active: true,
          status: 'active',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Error interno en la Edge Function create-user' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
