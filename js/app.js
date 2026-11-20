import { api } from "./api.js";

const app = document.getElementById("app");
const CLAVE_SESION = "cc_usuario";

// ---------- utilidades ----------

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const dinero = (v) => Number(v).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function aviso(mensaje, tipo = "error") {
  const caja = document.getElementById("aviso");
  caja.textContent = mensaje;
  caja.className = `aviso aviso-${tipo}`;
  caja.hidden = false;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => (caja.hidden = true), 4000);
}

// Ejecuta una acción del usuario, muestra el error de la API si falla y vuelve a pintar la vista.
async function accion(fn, exito) {
  try {
    await fn();
    if (exito) aviso(exito, "ok");
    await render();
  } catch (e) {
    aviso(e.message);
  }
}

// Para secciones cuyo endpoint puede no existir todavía en el backend.
const opcional = (promesa) => promesa.catch(() => null);

const datosForm = (form) => Object.fromEntries(new FormData(form));

// ---------- sesión ----------

function leerSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_SESION));
  } catch {
    return null;
  }
}

function guardarSesion(u) {
  try {
    if (u) localStorage.setItem(CLAVE_SESION, JSON.stringify(u));
    else localStorage.removeItem(CLAVE_SESION);
  } catch {
    /* sin almacenamiento: la sesión dura lo que la pestaña */
  }
  usuario = u;
}

let usuario = leerSesion();

function pintarEncabezado() {
  const amb = window.APP_CONFIG?.AMBIENTE || "local";
  const etiqueta = document.getElementById("ambiente");
  etiqueta.textContent = amb.toUpperCase();
  etiqueta.className = `ambiente ambiente-${amb}`;

  const nav = document.getElementById("sesion");
  nav.innerHTML = usuario
    ? `<a href="#/cuenta">${esc(usuario.nombre)}</a> <button id="salir" class="enlace">Salir</button>`
    : "";
  document.getElementById("salir")?.addEventListener("click", () => {
    guardarSesion(null);
    location.hash = "#/";
  });
}

// ---------- vistas ----------

function vistaInicio() {
  app.innerHTML = `
    <section class="bienvenida">
      <h1>Divide gastos sin pleitos</h1>
      <p>Registra quién pagó qué en tus grupos y Cuentas Claras te dice quién le debe a quién.</p>
    </section>
    <div class="columnas">
      <form id="f-login" class="tarjeta">
        <h2>Iniciar sesión</h2>
        <label>Email <input name="email" type="email" required></label>
        <label>Contraseña <input name="password" type="password" required></label>
        <button>Entrar</button>
      </form>
      <form id="f-registro" class="tarjeta">
        <h2>Crear cuenta</h2>
        <label>Nombre <input name="nombre" required></label>
        <label>Email <input name="email" type="email" required></label>
        <label>Contraseña <input name="password" type="password" minlength="6" required></label>
        <button>Registrarme</button>
      </form>
    </div>`;

  const entrar = async (email, password) => {
    guardarSesion(await api.post("/api/auth/login", { email, password }));
    location.hash = "#/grupos";
  };

  document.getElementById("f-login").addEventListener("submit", (e) => {
    e.preventDefault();
    const d = datosForm(e.target);
    entrar(d.email, d.password).catch((err) => aviso(err.message));
  });

  document.getElementById("f-registro").addEventListener("submit", (e) => {
    e.preventDefault();
    const d = datosForm(e.target);
    api.post("/api/usuarios", d)
      .then(() => entrar(d.email, d.password))
      .then(() => aviso("Cuenta creada", "ok"))
      .catch((err) => aviso(err.message));
  });
}

async function vistaGrupos() {
  const grupos = (await api.get("/api/grupos")).filter((g) => g.miembros.some((m) => m.id === usuario.id));

  app.innerHTML = `
    <h1>Mis grupos</h1>
    <div class="lista-grupos">
      ${grupos.length
        ? grupos.map((g) => `
          <a class="tarjeta grupo" href="#/grupos/${g.id}">
            <strong>${esc(g.nombre)}</strong>
            <span>${esc(g.descripcion)}</span>
            <small>${g.miembros.length} miembro(s)</small>
          </a>`).join("")
        : `<p class="vacio">Aún no perteneces a ningún grupo. Crea uno abajo.</p>`}
    </div>
    <form id="f-grupo" class="tarjeta">
      <h2>Nuevo grupo</h2>
      <label>Nombre <input name="nombre" required></label>
      <label>Descripción <input name="descripcion"></label>
      <button>Crear grupo</button>
    </form>`;

  document.getElementById("f-grupo").addEventListener("submit", (e) => {
    e.preventDefault();
    const d = datosForm(e.target);
    accion(() => api.post("/api/grupos", { ...d, creado_por: usuario.id }), "Grupo creado");
  });
}

async function vistaGrupo(id) {
  const [grupo, usuarios, gastos, pagos, saldos, deudas] = await Promise.all([
    api.get(`/api/grupos/${id}`),
    api.get("/api/usuarios"),
    opcional(api.get(`/api/grupos/${id}/gastos`)),
    opcional(api.get(`/api/grupos/${id}/pagos`)),
    opcional(api.get(`/api/grupos/${id}/saldos`)),
    opcional(api.get(`/api/grupos/${id}/deudas-simplificadas`)),
  ]);

  const nombre = Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]));
  const miembros = grupo.miembros;
  const noMiembros = usuarios.filter((u) => !miembros.some((m) => m.id === u.id));
  const opcionesMiembros = (sel) =>
    miembros.map((m) => `<option value="${m.id}" ${m.id === sel ? "selected" : ""}>${esc(m.nombre)}</option>`).join("");
  const noDisponible = `<p class="vacio">Aún no disponible.</p>`;

  app.innerHTML = `
    <a href="#/grupos" class="volver">← Mis grupos</a>
    <form id="f-editar-grupo" class="titulo-grupo">
      <input name="nombre" value="${esc(grupo.nombre)}" aria-label="Nombre del grupo" required>
      <input name="descripcion" value="${esc(grupo.descripcion)}" aria-label="Descripción" placeholder="Descripción">
      <button>Guardar</button>
      <button type="button" id="eliminar-grupo" class="peligro">Eliminar grupo</button>
    </form>

    <div class="columnas">
      <section class="tarjeta">
        <h2>Saldos</h2>
        ${saldos ? `<ul class="saldos">${saldos.map((s) => {
          const n = Number(s.saldo);
          const clase = n > 0 ? "positivo" : n < 0 ? "negativo" : "";
          const texto = n > 0 ? "le deben" : n < 0 ? "debe" : "está a mano";
          return `<li><span>${esc(s.nombre ?? nombre[s.usuario_id])}</span>
                  <span class="${clase}">${texto} ${n ? dinero(Math.abs(n)) : ""}</span></li>`;
        }).join("")}</ul>` : noDisponible}

        <h3>Forma más simple de saldar</h3>
        ${deudas ? (deudas.length
          ? `<ul>${deudas.map((d) => `<li>${esc(nombre[d.de_usuario])} paga ${dinero(d.monto)} a ${esc(nombre[d.a_usuario])}</li>`).join("")}</ul>`
          : `<p class="vacio">Nadie le debe nada a nadie.</p>`) : noDisponible}
      </section>

      <section class="tarjeta">
        <h2>Miembros</h2>
        <ul class="miembros">
          ${miembros.map((m) => `
            <li>${esc(m.nombre)} <small>${esc(m.email)}</small>
              ${m.id !== grupo.creado_por ? `<button class="enlace quitar" data-id="${m.id}">Quitar</button>` : "<small>(creador)</small>"}
            </li>`).join("")}
        </ul>
        ${noMiembros.length ? `
          <form id="f-miembro" class="en-linea">
            <select name="usuario_id">${noMiembros.map((u) => `<option value="${u.id}">${esc(u.nombre)} (${esc(u.email)})</option>`).join("")}</select>
            <button>Agregar</button>
          </form>` : ""}
      </section>
    </div>

    <section class="tarjeta">
      <h2>Gastos</h2>
      ${gastos ? (gastos.length ? `
        <table>
          <thead><tr><th>Fecha</th><th>Descripción</th><th>Pagó</th><th>Monto</th><th>División</th><th></th></tr></thead>
          <tbody>${gastos.map((g) => `
            <tr><td>${esc(g.fecha)}</td><td>${esc(g.descripcion)}</td><td>${esc(nombre[g.pagado_por])}</td>
              <td>${dinero(g.monto)}</td><td>${esc(g.tipo_division)}</td>
              <td><button class="enlace borrar-gasto" data-id="${g.id}">Eliminar</button></td></tr>`).join("")}
          </tbody>
        </table>` : `<p class="vacio">Sin gastos todavía.</p>`) : noDisponible}

      <form id="f-gasto">
        <h3>Registrar gasto</h3>
        <div class="en-linea">
          <input name="descripcion" placeholder="Descripción" required>
          <input name="monto" type="number" step="0.01" min="0.01" placeholder="Monto" required>
          <label>Pagó <select name="pagado_por">${opcionesMiembros(usuario.id)}</select></label>
          <label>División
            <select name="tipo_division" id="tipo-division">
              <option value="iguales">Partes iguales</option>
              <option value="porcentaje">Por porcentaje</option>
              <option value="montos">Por montos</option>
            </select>
          </label>
        </div>
        <fieldset class="participantes">
          <legend>Entre quiénes</legend>
          ${miembros.map((m) => `
            <label><input type="checkbox" name="p-${m.id}" checked> ${esc(m.nombre)}
              <input name="v-${m.id}" type="number" step="0.01" min="0" class="valor" placeholder="% o $" hidden></label>`).join("")}
        </fieldset>
        <button>Registrar gasto</button>
      </form>
    </section>

    <section class="tarjeta">
      <h2>Pagos</h2>
      ${pagos ? (pagos.length ? `
        <table>
          <thead><tr><th>Fecha</th><th>De</th><th>A</th><th>Monto</th><th></th></tr></thead>
          <tbody>${pagos.map((p) => `
            <tr><td>${esc(p.fecha)}</td><td>${esc(nombre[p.de_usuario])}</td><td>${esc(nombre[p.a_usuario])}</td>
              <td>${dinero(p.monto)}</td><td><button class="enlace borrar-pago" data-id="${p.id}">Eliminar</button></td></tr>`).join("")}
          </tbody>
        </table>` : `<p class="vacio">Sin pagos todavía.</p>`) : noDisponible}

      <form id="f-pago" class="en-linea">
        <label>De <select name="de_usuario">${opcionesMiembros(usuario.id)}</select></label>
        <label>A <select name="a_usuario">${opcionesMiembros()}</select></label>
        <input name="monto" type="number" step="0.01" min="0.01" placeholder="Monto" required>
        <button>Registrar pago</button>
      </form>
    </section>`;

  // --- grupo ---
  document.getElementById("f-editar-grupo").addEventListener("submit", (e) => {
    e.preventDefault();
    accion(() => api.put(`/api/grupos/${id}`, datosForm(e.target)), "Grupo actualizado");
  });
  document.getElementById("eliminar-grupo").addEventListener("click", () => {
    if (!confirm(`¿Eliminar el grupo "${grupo.nombre}" con todos sus gastos y pagos?`)) return;
    api.del(`/api/grupos/${id}`)
      .then(() => { aviso("Grupo eliminado", "ok"); location.hash = "#/grupos"; })
      .catch((err) => aviso(err.message));
  });

  // --- miembros ---
  document.getElementById("f-miembro")?.addEventListener("submit", (e) => {
    e.preventDefault();
    accion(() => api.post(`/api/grupos/${id}/miembros/${datosForm(e.target).usuario_id}`), "Miembro agregado");
  });
  app.querySelectorAll(".quitar").forEach((b) =>
    b.addEventListener("click", () => accion(() => api.del(`/api/grupos/${id}/miembros/${b.dataset.id}`), "Miembro quitado")));

  // --- gastos ---
  const tipo = document.getElementById("tipo-division");
  tipo.addEventListener("change", () =>
    app.querySelectorAll(".valor").forEach((i) => (i.hidden = tipo.value === "iguales")));

  document.getElementById("f-gasto").addEventListener("submit", (e) => {
    e.preventDefault();
    const d = datosForm(e.target);
    const participantes = miembros
      .filter((m) => d[`p-${m.id}`])
      .map((m) => ({ usuario_id: m.id, valor: d[`v-${m.id}`] || null }));
    if (!participantes.length) return aviso("Elige al menos un participante");
    accion(() => api.post(`/api/grupos/${id}/gastos`, {
      descripcion: d.descripcion,
      monto: d.monto,
      pagado_por: Number(d.pagado_por),
      tipo_division: d.tipo_division,
      participantes,
    }), "Gasto registrado");
  });
  app.querySelectorAll(".borrar-gasto").forEach((b) =>
    b.addEventListener("click", () => accion(() => api.del(`/api/gastos/${b.dataset.id}`), "Gasto eliminado")));

  // --- pagos ---
  document.getElementById("f-pago").addEventListener("submit", (e) => {
    e.preventDefault();
    const d = datosForm(e.target);
    accion(() => api.post(`/api/grupos/${id}/pagos`, {
      de_usuario: Number(d.de_usuario),
      a_usuario: Number(d.a_usuario),
      monto: d.monto,
    }), "Pago registrado");
  });
  app.querySelectorAll(".borrar-pago").forEach((b) =>
    b.addEventListener("click", () => accion(() => api.del(`/api/pagos/${b.dataset.id}`), "Pago eliminado")));
}

function vistaCuenta() {
  app.innerHTML = `
    <h1>Mi cuenta</h1>
    <form id="f-cuenta" class="tarjeta">
      <label>Nombre <input name="nombre" value="${esc(usuario.nombre)}" required></label>
      <label>Email <input name="email" type="email" value="${esc(usuario.email)}" required></label>
      <label>Nueva contraseña <input name="password" type="password" minlength="6" placeholder="Dejar vacío para no cambiarla"></label>
      <button>Guardar cambios</button>
    </form>
    <button id="eliminar-cuenta" class="peligro">Eliminar mi cuenta</button>`;

  document.getElementById("f-cuenta").addEventListener("submit", (e) => {
    e.preventDefault();
    const d = datosForm(e.target);
    if (!d.password) delete d.password;
    accion(async () => guardarSesion(await api.put(`/api/usuarios/${usuario.id}`, d)), "Cuenta actualizada");
  });
  document.getElementById("eliminar-cuenta").addEventListener("click", () => {
    if (!confirm("¿Eliminar tu cuenta? No se puede deshacer.")) return;
    api.del(`/api/usuarios/${usuario.id}`)
      .then(() => { guardarSesion(null); aviso("Cuenta eliminada", "ok"); location.hash = "#/"; })
      .catch((err) => aviso(err.message));
  });
}

// ---------- navegación ----------

async function render() {
  pintarEncabezado();
  const ruta = location.hash.replace(/^#/, "") || "/";

  if (!usuario) return vistaInicio();
  try {
    const grupo = ruta.match(/^\/grupos\/(\d+)$/);
    if (grupo) return await vistaGrupo(grupo[1]);
    if (ruta === "/cuenta") return vistaCuenta();
    if (ruta !== "/grupos") return void (location.hash = "#/grupos");
    await vistaGrupos();
  } catch (e) {
    app.innerHTML = `<p class="vacio">No se pudo cargar: ${esc(e.message)}</p>`;
  }
}

window.addEventListener("hashchange", render);
render();
