// supabase-client.js
// Configuración de Supabase para el PROYECTO SISTEMA

const SUPABASE_URL = "https://igortawzsqlyyktnhybv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1U2HHp6TWWaFReCrV1CYgg_0dV4BbCQ";

// Cargamos la librería desde CDN si no está presente
if (typeof supabase === 'undefined') {
  console.error("La librería de Supabase no se cargó correctamente. Asegúrate de incluir <script src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'></script> en el HTML.");
}

const _supabase = typeof supabase !== 'undefined' ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

window.supabaseClient = _supabase;

async function checkSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session && !window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
    }
    return session;
}

window.checkSession = checkSession;
