(function () {
  // Verificación de sesión de Supabase
  async function checkSupabaseSession() {
    if (typeof supabase === 'undefined') return null;

    const { data: { session }, error } = await window.supabaseClient.auth.getSession();

    if (error || !session) {
      if (!window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
      }
      return null;
    }

    return session.user;
  }

  function resolveUser(provided) {
    if (provided) return provided;
    try {
      const raw = localStorage.getItem("currentUser");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function renderUser(user) {
    const nombre = (user && (user.nombre || user.user || user.username || user.email)) || "(sin usuario)";
    const rol = user && user.rol ? ` | Rol: ${user.rol}` : "";
    const label = `Usuario: ${nombre}${rol}`;

    const headerTarget = document.getElementById("infoUsuario");
    if (headerTarget) headerTarget.textContent = label;

    const sidebarTarget = document.getElementById("infoUsuarioSidebar");
    if (sidebarTarget) {
      sidebarTarget.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="font-size: 0.85em; opacity: 0.8;">${label}</div>
          <button id="btnLogout" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">Cerrar sesión</button>
        </div>
      `;

      const btnLogout = document.getElementById("btnLogout");
      if (btnLogout) {
        btnLogout.addEventListener("click", async () => {
          if (window.supabaseClient) {
            await window.supabaseClient.auth.signOut();
            localStorage.removeItem("currentUser");
            window.location.href = 'login.html';
          }
        });
      }
    }
  }

  function markActiveNav(activePage) {
    if (!activePage) return;
    const links = document.querySelectorAll('#sidebar .nav a[data-page]');
    links.forEach(link => {
      if (link.dataset.page === activePage) link.classList.add('active');
      else link.classList.remove('active');
    });
  }

  function initToggle() {
    const sidebar = document.getElementById("sidebar");
    const content = document.getElementById("content");
    const toggleBtn = document.getElementById("menuToggle");
    if (!sidebar || !toggleBtn) return;

    function toggleSidebar() {
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        sidebar.classList.toggle("open");
      } else {
        sidebar.classList.toggle("collapsed");
        if (content) content.classList.toggle("collapsed");
      }
    }

    toggleBtn.addEventListener("click", toggleSidebar);

    window.addEventListener("resize", () => {
      if (window.innerWidth <= 768) {
        sidebar.classList.remove("collapsed");
        if (content) content.classList.remove("collapsed");
      } else {
        sidebar.classList.remove("open");
      }
    });
  }

  async function initCommonLayout(options = {}) {
    const { activePage } = options;

    // Si no estamos en login, cargamos Supabase y verificamos sesión
    if (!window.location.pathname.includes('login.html')) {
      if (typeof supabase === 'undefined') {
        // Cargar scripts dinámicamente si no están
        const s1 = document.createElement('script');
        s1.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        document.head.appendChild(s1);

        await new Promise(r => s1.onload = r);

        const s2 = document.createElement('script');
        s2.src = 'supabase-client.js';
        document.head.appendChild(s2);

        await new Promise(r => s2.onload = r);

        const s3 = document.createElement('script');
        s3.src = 'supabase-adapter.js';
        document.head.appendChild(s3);

        await new Promise(r => s3.onload = r);
      }

      const user = await checkSupabaseSession();
      if (user) {
        const storedUser = resolveUser();
        renderUser(storedUser || user);
      }
    }

    markActiveNav(activePage);
    initToggle();
  }

  window.initCommonLayout = initCommonLayout;
})();
