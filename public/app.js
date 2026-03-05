// ══════════════════════════════════════════════════════════════
//  app.js — Cotizador MA&VE
//  HTML → app.js → server.js → Railway MySQL
// ══════════════════════════════════════════════════════════════

const API = 'https://myv-backend-production.up.railway.app/api';

const DB = { tipos:[], tiendas:[], insumos:[], telas:[], maderas:[], espumas:[], clientes:[] };
let rowsMat=[], rowsTela=[], rowsMad=[], rowsEsp=[];

const fmt    = v => (v!=null&&!isNaN(v)) ? `$${Number(v).toFixed(2)}` : '—';
const fmtNum = v => (v!=null&&!isNaN(v)) ? Number(v).toFixed(2) : '';
const $      = id => document.getElementById(id);

function toast(msg, tipo='ok') {
  const t=$('toast'); t.textContent=msg; t.className=`show ${tipo}`;
  setTimeout(()=>t.className='', 3500);
}

function showLoader(v) {
  const l=$('loader');
  if(!v){ l.style.opacity='0'; setTimeout(()=>l.style.display='none',400); }
  else  { l.style.display='flex'; l.style.opacity='1'; }
}

// ── TABS ──────────────────────────────────────────────────────
function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el=>el.classList.remove('active'));
  $(`tab-${name}`).classList.add('active');
  document.querySelectorAll('.tab')[name==='nueva'?0:1].classList.add('active');
  if(name==='historial') cargarHistorial();
}

// ── CARGA INICIAL ─────────────────────────────────────────────
async function cargarDatos() {
  try {
    const [tipos,tiendas,insumos,telas,maderas,espumas,clientes] = await Promise.all([
      fetch(`${API}/tipos-mueble`).then(r=>r.json()),
      fetch(`${API}/tiendas`).then(r=>r.json()),
      fetch(`${API}/insumos`).then(r=>r.json()),
      fetch(`${API}/telas`).then(r=>r.json()),
      fetch(`${API}/maderas`).then(r=>r.json()),
      fetch(`${API}/espumas`).then(r=>r.json()),
      fetch(`${API}/clientes`).then(r=>r.json()),
    ]);
    Object.assign(DB,{tipos,tiendas,insumos,telas,maderas,espumas,clientes});

    $('tipoMueble').innerHTML = tipos.map(t=>`<option value="${t.id}">${t.nombre}</option>`).join('');
    $('clienteSelect').innerHTML = '<option value="">— Sin cliente —</option>' +
      clientes.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('');

    rowsMat  = [{insumo_id:'',cant:1},{insumo_id:'',cant:1}];
    rowsTela = [{tienda_id:'',tela_id:'',cant:1}];
    rowsMad  = [{madera_id:'',cant:1}];
    rowsEsp  = [{espuma_id:'',cant:1}];

    renderAll(); recalc(); showLoader(false);

  } catch(e) {
    $('loader').innerHTML = `
      <div style="text-align:center;padding:40px;">
        <div style="font-size:3rem;margin-bottom:16px;">⚠️</div>
        <h2 style="font-family:'Playfair Display',serif;color:#E8C580;margin-bottom:10px;">No se pudo conectar</h2>
        <p style="color:#D4A96A;margin-bottom:6px;">Asegúrate de que el servidor esté corriendo:</p>
        <code style="color:#E8C580;background:rgba(255,255,255,0.1);padding:6px 14px;border-radius:6px;display:inline-block;margin-bottom:20px;">
          node server.js
        </code><br>
        <button onclick="location.reload()"
          style="padding:10px 22px;background:#C9973A;border:none;border-radius:8px;font-weight:700;cursor:pointer;color:#2C1A0E;">
          🔄 Reintentar
        </button>
      </div>`;
  }
}

// ── LOOKUPS ───────────────────────────────────────────────────
const getPrecioInsumo = id => DB.insumos.find(i=>i.id==id)?.precio ?? null;
const getPrecioTela   = id => DB.telas.find(t=>t.id==id)?.precio ?? null;
const getPrecioMadera = id => DB.maderas.find(m=>m.id==id)?.precio ?? null;
const getPrecioEspuma = id => DB.espumas.find(e=>e.id==id)?.precio ?? null;
const getTelasPorTienda = tid => DB.telas.filter(t=>t.tienda_id==tid);

// ── AGREGAR FILAS ─────────────────────────────────────────────
function addRow(type) {
  if(type==='mat')  { rowsMat.push({insumo_id:'',cant:1});          renderMat(); }
  if(type==='tela') { rowsTela.push({tienda_id:'',tela_id:'',cant:1}); renderTela(); }
  if(type==='mad')  { rowsMad.push({madera_id:'',cant:1});          renderMad(); }
  if(type==='esp')  { rowsEsp.push({espuma_id:'',cant:1});          renderEsp(); }
  recalc();
}

function renderAll() { renderMat(); renderTela(); renderMad(); renderEsp(); }

// ── RENDER MATERIALES ─────────────────────────────────────────
function renderMat() {
  $('rowsMat').innerHTML = rowsMat.map((r,i) => {
    const c=getPrecioInsumo(r.insumo_id), tot=(c!=null&&r.cant)?c*r.cant:null;
    const opts=DB.insumos.map(ins=>`<option value="${ins.id}" ${ins.id==r.insumo_id?'selected':''}>${ins.nombre}${ins.precio?' ($'+ins.precio+')':''}</option>`).join('');
    return `<div class="row-item">
      <select onchange="rowsMat[${i}].insumo_id=this.value;renderMat();recalc()"><option value="">Seleccionar...</option>${opts}</select>
      <input type="number" value="${r.cant||''}" min="0" step="0.01" onchange="rowsMat[${i}].cant=parseFloat(this.value)||0;renderMat();recalc()">
      <input type="text" value="${fmtNum(c)}" readonly placeholder="—">
      <input type="text" value="${fmtNum(tot)}" readonly placeholder="—">
      <button class="btn-del" onclick="rowsMat.splice(${i},1);renderMat();recalc()">✕</button>
    </div>`;
  }).join('');
  const tot=rowsMat.reduce((s,r)=>{const c=getPrecioInsumo(r.insumo_id);return(c!=null&&r.cant)?s+c*r.cant:s;},0);
  $('totalMat').textContent=$('sumMat').textContent=fmt(tot);
}

// ── RENDER TELAS ──────────────────────────────────────────────
function renderTela() {
  $('rowsTela').innerHTML = rowsTela.map((r,i) => {
    const tFil=getTelasPorTienda(r.tienda_id);
    const c=getPrecioTela(r.tela_id), tot=(c!=null&&r.cant)?c*r.cant:null;
    const optsT=DB.tiendas.map(t=>`<option value="${t.id}" ${t.id==r.tienda_id?'selected':''}>${t.nombre}</option>`).join('');
    const optsF=tFil.map(t=>`<option value="${t.id}" ${t.id==r.tela_id?'selected':''}>${t.nombre}${t.precio?' ($'+t.precio+')':''}</option>`).join('');
    return `<div class="row-item row-tela">
      <select onchange="rowsTela[${i}].tienda_id=this.value;rowsTela[${i}].tela_id='';renderTela();recalc()"><option value="">—</option>${optsT}</select>
      <select onchange="rowsTela[${i}].tela_id=this.value;renderTela();recalc()"><option value="">Seleccionar...</option>${optsF}</select>
      <input type="number" value="${r.cant||''}" min="0" step="0.01" onchange="rowsTela[${i}].cant=parseFloat(this.value)||0;renderTela();recalc()">
      <input type="text" value="${fmtNum(c)}" readonly placeholder="—">
      <input type="text" value="${fmtNum(tot)}" readonly placeholder="—">
      <button class="btn-del" onclick="rowsTela.splice(${i},1);renderTela();recalc()">✕</button>
    </div>`;
  }).join('');
  const tot=rowsTela.reduce((s,r)=>{const c=getPrecioTela(r.tela_id);return(c!=null&&r.cant)?s+c*r.cant:s;},0);
  $('totalTela').textContent=$('sumTela').textContent=fmt(tot);
}

// ── RENDER MADERA ─────────────────────────────────────────────
function renderMad() {
  $('rowsMad').innerHTML = rowsMad.map((r,i) => {
    const c=getPrecioMadera(r.madera_id), tot=(c!=null&&r.cant)?c*r.cant:null;
    const opts=DB.maderas.map(m=>`<option value="${m.id}" ${m.id==r.madera_id?'selected':''}>${m.nombre}${m.precio?' ($'+m.precio+')':''}</option>`).join('');
    return `<div class="row-item">
      <select onchange="rowsMad[${i}].madera_id=this.value;renderMad();recalc()"><option value="">Seleccionar...</option>${opts}</select>
      <input type="number" value="${r.cant||''}" min="0" step="0.01" onchange="rowsMad[${i}].cant=parseFloat(this.value)||0;renderMad();recalc()">
      <input type="text" value="${fmtNum(c)}" readonly placeholder="—">
      <input type="text" value="${fmtNum(tot)}" readonly placeholder="—">
      <button class="btn-del" onclick="rowsMad.splice(${i},1);renderMad();recalc()">✕</button>
    </div>`;
  }).join('');
  const tot=rowsMad.reduce((s,r)=>{const c=getPrecioMadera(r.madera_id);return(c!=null&&r.cant)?s+c*r.cant:s;},0);
  $('totalMad').textContent=$('sumMad').textContent=fmt(tot);
}

// ── RENDER ESPUMA ─────────────────────────────────────────────
function renderEsp() {
  $('rowsEsp').innerHTML = rowsEsp.map((r,i) => {
    const c=getPrecioEspuma(r.espuma_id), tot=(c!=null&&r.cant)?c*r.cant:null;
    const opts=DB.espumas.map(e=>`<option value="${e.id}" ${e.id==r.espuma_id?'selected':''}>${e.nombre}${e.precio?' ($'+e.precio+')':''}</option>`).join('');
    return `<div class="row-item">
      <select onchange="rowsEsp[${i}].espuma_id=this.value;renderEsp();recalc()"><option value="">Seleccionar...</option>${opts}</select>
      <input type="number" value="${r.cant||''}" min="0" step="0.01" onchange="rowsEsp[${i}].cant=parseFloat(this.value)||0;renderEsp();recalc()">
      <input type="text" value="${fmtNum(c)}" readonly placeholder="—">
      <input type="text" value="${fmtNum(tot)}" readonly placeholder="—">
      <button class="btn-del" onclick="rowsEsp.splice(${i},1);renderEsp();recalc()">✕</button>
    </div>`;
  }).join('');
  const tot=rowsEsp.reduce((s,r)=>{const c=getPrecioEspuma(r.espuma_id);return(c!=null&&r.cant)?s+c*r.cant:s;},0);
  $('totalEsp').textContent=$('sumEsp').textContent=fmt(tot);
}

// ── RECÁLCULO ─────────────────────────────────────────────────
function recalc() {
  const tMat  = rowsMat.reduce((s,r)=>{const c=getPrecioInsumo(r.insumo_id);return(c!=null&&r.cant)?s+c*r.cant:s;},0);
  const tTela = rowsTela.reduce((s,r)=>{const c=getPrecioTela(r.tela_id);return(c!=null&&r.cant)?s+c*r.cant:s;},0);
  const tMad  = rowsMad.reduce((s,r)=>{const c=getPrecioMadera(r.madera_id);return(c!=null&&r.cant)?s+c*r.cant:s;},0);
  const tEsp  = rowsEsp.reduce((s,r)=>{const c=getPrecioEspuma(r.espuma_id);return(c!=null&&r.cant)?s+c*r.cant:s;},0);
  const flete=parseFloat($('flete').value)||0;
  const va=parseFloat($('valorAgregado').value)||0;
  const mo=parseFloat($('manoObra').value)||0;
  const pct=parseFloat($('pctGanancia').value)||30;
  const sub1=tMat+tTela+tMad+tEsp;
  const sub2=sub1+flete+va+mo;
  const gan=sub2*(pct/100);
  $('subtotal1').textContent=fmt(sub1);
  $('subtotal2').textContent=fmt(sub2);
  $('ganancia').textContent=fmt(gan);
  $('totalGeneral').textContent=fmt(sub2+gan);
  $('pctLabel').textContent=pct;
  $('sumMat').textContent=$('totalMat').textContent=fmt(tMat);
  $('sumTela').textContent=$('totalTela').textContent=fmt(tTela);
  $('sumMad').textContent=$('totalMad').textContent=fmt(tMad);
  $('sumEsp').textContent=$('totalEsp').textContent=fmt(tEsp);
}

// ── GUARDAR COTIZACIÓN ────────────────────────────────────────
async function guardar() {
  try {
    let cliente_id=$('clienteSelect').value||null;
    const nombreNuevo=$('nuevoCliente').value.trim();
    if(nombreNuevo) {
      const r=await fetch(`${API}/clientes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:nombreNuevo})});
      cliente_id=(await r.json()).id;
    }
    const tMat  = rowsMat.reduce((s,r)=>{const c=getPrecioInsumo(r.insumo_id);return(c!=null&&r.cant)?s+c*r.cant:s;},0);
    const tTela = rowsTela.reduce((s,r)=>{const c=getPrecioTela(r.tela_id);return(c!=null&&r.cant)?s+c*r.cant:s;},0);
    const tMad  = rowsMad.reduce((s,r)=>{const c=getPrecioMadera(r.madera_id);return(c!=null&&r.cant)?s+c*r.cant:s;},0);
    const tEsp  = rowsEsp.reduce((s,r)=>{const c=getPrecioEspuma(r.espuma_id);return(c!=null&&r.cant)?s+c*r.cant:s;},0);

    const payload = {
      cliente_id, tipo_mueble_id:$('tipoMueble').value,
      flete:parseFloat($('flete').value)||0,
      valor_agregado:parseFloat($('valorAgregado').value)||0,
      mano_obra:parseFloat($('manoObra').value)||0,
      pct_ganancia:parseFloat($('pctGanancia').value)||30,
      total_materiales:tMat, total_telas:tTela, total_madera:tMad, total_espuma:tEsp,
      estatus:'borrador',
      insumos: rowsMat.filter(r=>r.insumo_id).map(r=>({insumo_id:r.insumo_id,cantidad:r.cant,costo_unitario:getPrecioInsumo(r.insumo_id)||0})),
      telas:   rowsTela.filter(r=>r.tela_id).map(r=>({tela_id:r.tela_id,cantidad:r.cant,costo_unitario:getPrecioTela(r.tela_id)||0})),
      maderas: rowsMad.filter(r=>r.madera_id).map(r=>({madera_id:r.madera_id,cantidad:r.cant,costo_unitario:getPrecioMadera(r.madera_id)||0})),
      espumas: rowsEsp.filter(r=>r.espuma_id).map(r=>({espuma_id:r.espuma_id,cantidad:r.cant,costo_unitario:getPrecioEspuma(r.espuma_id)||0})),
    };

    const res=await fetch(`${API}/cotizaciones`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await res.json();
    if(data.id) { toast(`✅ Cotización #${data.id} guardada`,'ok'); $('nuevoCliente').value=''; }
    else toast('❌ Error: '+(data.error||'desconocido'),'err');
  } catch(e) { toast('❌ Error de conexión con el servidor','err'); }
}

// ── HISTORIAL ─────────────────────────────────────────────────
async function cargarHistorial() {
  const cont=$('historialContainer');
  cont.innerHTML='<p style="color:var(--brown-light);text-align:center;padding:40px;">Cargando...</p>';
  try {
    const data=await fetch(`${API}/cotizaciones`).then(r=>r.json());
    if(!data.length){ cont.innerHTML='<p style="color:var(--brown-light);text-align:center;padding:40px;">No hay cotizaciones aún.</p>'; return; }
    cont.innerHTML=`<div class="hist-wrap"><table class="hist-table">
      <thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Mueble</th><th>Materiales</th><th>Telas</th><th>Madera</th><th>Espuma</th><th>Total</th><th>Estatus</th><th>Acciones</th></tr></thead>
      <tbody>${data.map(c=>`<tr>
        <td><strong>#${c.id}</strong></td>
        <td>${new Date(c.fecha).toLocaleDateString('es-MX')}</td>
        <td>${c.cliente||'—'}</td><td>${c.tipo_mueble}</td>
        <td>${fmt(c.total_materiales)}</td><td>${fmt(c.total_telas)}</td>
        <td>${fmt(c.total_madera)}</td><td>${fmt(c.total_espuma)}</td>
        <td><strong>${fmt(c.total_general)}</strong></td>
        <td><span class="badge ${c.estatus}">${c.estatus}</span></td>
        <td style="display:flex;gap:5px;">
          <button class="btn btn-dark btn-sm" onclick="verDetalle(${c.id})">👁️ Ver</button>
          <button class="btn btn-red btn-sm"  onclick="eliminar(${c.id})">🗑️</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch(e){ cont.innerHTML='<p style="color:#C0785A;text-align:center;padding:40px;">❌ Error al cargar.</p>'; }
}

// ── VER DETALLE ───────────────────────────────────────────────
async function verDetalle(id) {
  try {
    const c=await fetch(`${API}/cotizaciones/${id}`).then(r=>r.json());
    const win=window.open('','_blank','width=820,height=720');
    win.document.write(`<html><head><title>Cotización #${c.id}</title>
    <style>body{font-family:sans-serif;padding:28px;color:#2C1A0E;}h1{color:#5C3D1E;border-bottom:3px solid #C9973A;padding-bottom:8px;margin-bottom:18px;}h3{color:#5C3D1E;margin:16px 0 7px;}table{width:100%;border-collapse:collapse;margin-bottom:14px;}th{background:#2C1A0E;color:#E8C580;padding:8px 11px;text-align:left;font-size:0.8rem;}td{padding:8px 11px;border-bottom:1px solid #ddd;font-size:0.86rem;}.tot{background:#2C1A0E;color:#E8C580;padding:13px 17px;border-radius:10px;display:flex;justify-content:space-between;font-size:1.25rem;font-weight:700;margin-top:14px;}</style></head><body>
    <h1>Cotización #${c.id} — ${c.tipo_mueble}</h1>
    <p><strong>Cliente:</strong> ${c.cliente||'—'} &nbsp;|&nbsp; <strong>Fecha:</strong> ${new Date(c.fecha).toLocaleDateString('es-MX')} &nbsp;|&nbsp; <strong>Estatus:</strong> ${c.estatus}</p>
    <h3>🔩 Materiales</h3><table><tr><th>Insumo</th><th>Cant.</th><th>Costo</th><th>Total</th></tr>${c.insumos.map(r=>`<tr><td>${r.nombre}</td><td>${r.cantidad}</td><td>$${r.costo_unitario}</td><td>$${r.total}</td></tr>`).join('')}</table>
    <h3>🧵 Telas</h3><table><tr><th>Tienda</th><th>Tela</th><th>Cant.</th><th>Costo</th><th>Total</th></tr>${c.telas.map(r=>`<tr><td>${r.tienda}</td><td>${r.nombre}</td><td>${r.cantidad}</td><td>$${r.costo_unitario}</td><td>$${r.total}</td></tr>`).join('')}</table>
    <h3>🪵 Madera</h3><table><tr><th>Madera</th><th>Cant.</th><th>Costo</th><th>Total</th></tr>${c.maderas.map(r=>`<tr><td>${r.nombre}</td><td>${r.cantidad}</td><td>$${r.costo_unitario}</td><td>$${r.total}</td></tr>`).join('')}</table>
    <h3>🟫 Espuma</h3><table><tr><th>Espuma</th><th>Cant.</th><th>Costo</th><th>Total</th></tr>${c.espumas.map(r=>`<tr><td>${r.nombre}</td><td>${r.cantidad}</td><td>$${r.costo_unitario}</td><td>$${r.total}</td></tr>`).join('')}</table>
    <table><tr><td>Flete</td><td>$${c.flete}</td></tr><tr><td>Valor Agregado</td><td>$${c.valor_agregado}</td></tr><tr><td>Mano de Obra</td><td>$${c.mano_obra}</td></tr><tr><td>Ganancia (${c.pct_ganancia}%)</td><td>$${c.ganancia}</td></tr></table>
    <div class="tot"><span>Total General</span><span>$${c.total_general}</span></div>
    </body></html>`);
  } catch(e){ toast('❌ Error al cargar detalle','err'); }
}

// ── ELIMINAR ──────────────────────────────────────────────────
async function eliminar(id) {
  if(!confirm(`¿Eliminar cotización #${id}?`)) return;
  try {
    await fetch(`${API}/cotizaciones/${id}`,{method:'DELETE'});
    toast(`🗑️ Cotización #${id} eliminada`,'ok');
    cargarHistorial();
  } catch(e){ toast('❌ Error al eliminar','err'); }
}

// ── OBJETO PÚBLICO ────────────────────────────────────────────
const App = { showTab, addRow, guardar, recalc, cargarHistorial };

// ── INICIO ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', cargarDatos);
