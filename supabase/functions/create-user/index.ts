import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const configuredOrigin = (Deno.env.get("ALLOWED_ORIGIN") || "").trim();

  const allowedOrigins = [
  "https://arbitrax-flow.vercel.app",
  "https://arbitrax-repo.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
];

  if (configuredOrigin) {
    allowedOrigins.push(configuredOrigin);
  }

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  let isAllowed = false;

  if (origin) {
    if (allowedOrigins.includes(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
      isAllowed = true;
    } else {
      isAllowed = false;
    }
  } else {
    // Non-browser or server-side requests without Origin header
    isAllowed = true;
  }

  return { headers, isAllowed, hasOrigin: Boolean(origin) };
}

function getSecretKey(): string {
  // 1. Prioridad: Sistema moderno SUPABASE_SECRET_KEYS
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeysRaw && secretKeysRaw.trim() !== "") {
    try {
      const parsed = JSON.parse(secretKeysRaw);
      if (typeof parsed === "string" && parsed.trim() !== "") {
        return parsed.trim();
      }
      if (typeof parsed === "object" && parsed !== null && parsed["default"]) {
        return String(parsed["default"]).trim();
      }
    } catch {
      return secretKeysRaw.trim();
    }
  }

  // 2. Fallback legacy: SUPABASE_SERVICE_ROLE_KEY
  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyKey && legacyKey.trim() !== "") {
    return legacyKey.trim();
  }

  return "";
}

serve(async (req) => {
  const { headers: corsHeaders, isAllowed, hasOrigin } = getCorsHeaders(req);

  if (hasOrigin && !isAllowed) {
    return new Response(
      JSON.stringify({ error: "Origen no autorizado." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const secretKey = getSecretKey();

    if (!supabaseUrl || !secretKey) {
      return new Response(
        JSON.stringify({ error: "Configuración del servidor de autenticación incompleta." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Client with admin rights for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false },
    });

    // 1. Authenticate caller from Auth Header (JWT)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Usuario no autenticado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerAuthUser }, error: tokenError } = await supabaseAdmin.auth.getUser(token);

    if (tokenError || !callerAuthUser) {
      return new Response(
        JSON.stringify({ error: "Usuario no autenticado o token inválido." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch caller profile from public.users by auth_user_id
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id, username, role, organization_id, status, active")
      .eq("auth_user_id", callerAuthUser.id)
      .maybeSingle();

    if (profileError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: "Usuario autenticado no vinculado a ArbitraX." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!callerProfile.active || callerProfile.status === "disabled" || callerProfile.status === "suspended") {
      return new Response(
        JSON.stringify({ error: "Tu cuenta de usuario está desactivada o suspendida." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerRole = (callerProfile.role || "").toUpperCase();

    // 3. Authorization Check by Role
    if (callerRole !== "SUPER_ADMIN" && callerRole !== "ADMIN") {
      return new Response(
        JSON.stringify({ error: "No tienes permisos para crear usuarios." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse input body
    const body = await req.json();
    const { name, username, email, password, role: requestedRole, organization_id: reqOrgId } = body;

    // Basic Input Validations
    if (!name || typeof name !== "string" || !name.trim()) {
      return new Response(
        JSON.stringify({ error: "El nombre es obligatorio." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanUsername = (username || "").trim();
    if (!cleanUsername) {
      return new Response(
        JSON.stringify({ error: "El nombre de usuario es obligatorio." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Proporciona un correo electrónico válido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "La contraseña es obligatoria y debe tener al menos 6 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine target role and target organization_id based on caller rules
    let targetRole = "VENDEDOR";
    let targetOrgId: string | null = null;

    if (callerRole === "ADMIN") {
      const normRequestedRole = (requestedRole || "VENDEDOR").toUpperCase();

      if (
        normRequestedRole === "ADMIN" ||
        normRequestedRole === "ADMINISTRADOR" ||
        normRequestedRole === "SUPER_ADMIN" ||
        normRequestedRole === "SUPERADMIN"
      ) {
        return new Response(
          JSON.stringify({ error: "Un Administrador no puede crear usuarios Administradores ni Super Administradores." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (normRequestedRole === "CONTADORA" || normRequestedRole === "CONTADOR") {
        targetRole = "CONTADORA";
      } else {
        targetRole = "VENDEDOR";
      }

      if (!callerProfile.organization_id) {
        return new Response(
          JSON.stringify({ error: "Tu usuario administrador no tiene una organización asignada." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      targetOrgId = callerProfile.organization_id;
    } else if (callerRole === "SUPER_ADMIN") {
      const normRequestedRole = (requestedRole || "VENDEDOR").toUpperCase();

      if (normRequestedRole === "SUPER_ADMIN" || normRequestedRole === "SUPERADMIN") {
        return new Response(
          JSON.stringify({ error: "No está permitido crear otro SUPER_ADMIN." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (normRequestedRole === "ADMIN" || normRequestedRole === "ADMINISTRADOR") {
        targetRole = "ADMIN";
      } else if (normRequestedRole === "CONTADORA" || normRequestedRole === "CONTADOR") {
        targetRole = "CONTADORA";
      } else {
        targetRole = "VENDEDOR";
      }

      // Verify organization provided for target
      if (!reqOrgId) {
        return new Response(
          JSON.stringify({ error: "Debes seleccionar una organización válida." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check organization exists and is active
      const { data: orgData, error: orgError } = await supabaseAdmin
        .from("organizations")
        .select("id, status, active")
        .eq("id", reqOrgId)
        .maybeSingle();

      if (orgError || !orgData || !orgData.active || orgData.status !== "active") {
        return new Response(
          JSON.stringify({ error: "La organización seleccionada no existe o está inactiva." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      targetOrgId = orgData.id;
    }

    // Constraint: CONTADORA must always belong to an organization and maximum 1 active CONTADORA per organization
    if (targetRole === "CONTADORA") {
      if (!targetOrgId) {
        return new Response(
          JSON.stringify({ error: "La CONTADORA debe pertenecer siempre a una organización." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: existingContadora } = await supabaseAdmin
        .from("users")
        .select("id, name, username, role, active, status")
        .eq("organization_id", targetOrgId)
        .or("role.ilike.CONTADORA,role.ilike.CONTADOR")
        .in("status", ["active", "enabled"])
        .maybeSingle();

      if (existingContadora && existingContadora.active !== false) {
        return new Response(
          JSON.stringify({ error: "Esta organización ya tiene una CONTADORA." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 4. Check for duplicate Username in public.users
    const { data: existingUsername } = await supabaseAdmin
      .from("users")
      .select("id")
      .ilike("username", cleanUsername)
      .maybeSingle();

    if (existingUsername) {
      return new Response(
        JSON.stringify({ error: "El nombre de usuario ya está registrado." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate Email in public.users
    const { data: existingPublicEmail } = await supabaseAdmin
      .from("users")
      .select("id")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (existingPublicEmail) {
      return new Response(
        JSON.stringify({ error: "El correo electrónico ya está registrado." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Create Auth User via Supabase Auth Admin API (password used as entered without trim)
    const { data: authResult, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
        username: cleanUsername,
      },
    });

    if (authCreateError || !authResult?.user) {
      const msg = authCreateError?.message || "";
      if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("exists")) {
        return new Response(
          JSON.stringify({ error: "El correo electrónico ya está registrado en la autenticación." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: `No se pudo crear la cuenta de autenticación: ${msg}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const createdAuthUser = authResult.user;

    // 6. Create record in public.users linked via auth_user_id (omitting password/password_hash)
    const newPublicUserRecord = {
      username: cleanUsername,
      name: name.trim(),
      email: cleanEmail,
      role: targetRole,
      organization_id: targetOrgId,
      status: "active",
      active: true,
      auth_user_id: createdAuthUser.id,
    };

    const { data: insertedUser, error: publicInsertError } = await supabaseAdmin
      .from("users")
      .insert([newPublicUserRecord])
      .select("id, username, name, email, role, organization_id, status, active")
      .single();

    if (publicInsertError || !insertedUser) {
      // Rollback auth user creation to prevent orphaned accounts
      await supabaseAdmin.auth.admin.deleteUser(createdAuthUser.id);
      return new Response(
        JSON.stringify({ error: "No se pudo completar el registro del perfil de usuario." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: insertedUser.id,
          username: insertedUser.username,
          name: insertedUser.name,
          email: insertedUser.email,
          role: insertedUser.role,
          organization_id: insertedUser.organization_id,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Error interno del servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
