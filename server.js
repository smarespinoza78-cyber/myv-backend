const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static('public'));

// ── CONEXIÓN ──────────────────────────────────────────────────
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// ── CATÁLOGOS ─────────────────────────────────────────────────

app.get('/api/tipos-mueble', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM tipos_mueble WHERE activo=1 ORDER BY nombre');
  res.json(rows);
});

app.get('/api/tiendas', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM tiendas WHERE activo=1 ORDER BY nombre');
  res.json(rows);
});

app.get('/api/insumos', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM insumos WHERE activo=1 ORDER BY nombre');
  res.json(rows);
});

app.get('/api/telas', async (req, res) => {
  const { tienda_id } = req.query;
  let sql = 'SELECT t.*, ti.nombre AS tienda FROM telas t JOIN tiendas ti ON ti.id=t.tienda_id WHERE t.activo=1';
  const params = [];
  if (tienda_id) { sql += ' AND t.tienda_id=?'; params.push(tienda_id); }
  sql += ' ORDER BY t.nombre';
  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

app.get('/api/maderas', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM maderas WHERE activo=1 ORDER BY nombre');
  res.json(rows);
});

app.get('/api/espumas', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM espumas WHERE activo=1 ORDER BY densidad, medida');
  res.json(rows);
});

// ── CLIENTES ──────────────────────────────────────────────────

app.get('/api/clientes', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM clientes WHERE activo=1 ORDER BY nombre');
  res.json(rows);
});

app.post('/api/clientes', async (req, res) => {
  const { nombre, telefono, correo, direccion } = req.body;
  const [result] = await pool.query(
    'INSERT INTO clientes (nombre, telefono, correo, direccion) VALUES (?,?,?,?)',
    [nombre, telefono, correo, direccion]
  );
  res.json({ id: result.insertId, mensaje: 'Cliente creado' });
});

// ── COTIZACIONES ──────────────────────────────────────────────

app.get('/api/cotizaciones', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM v_cotizaciones_resumen ORDER BY fecha DESC');
  res.json(rows);
});

app.get('/api/cotizaciones/:id', async (req, res) => {
  const id = req.params.id;
  const [[cot]]   = await pool.query('SELECT * FROM v_cotizaciones_resumen WHERE id=?', [id]);
  if (!cot) return res.status(404).json({ error: 'No encontrada' });

  const [insumos] = await pool.query(
    `SELECT ci.*, i.nombre FROM cotizacion_insumos ci JOIN insumos i ON i.id=ci.insumo_id WHERE ci.cotizacion_id=?`, [id]);
  const [telas]   = await pool.query(
    `SELECT ct.*, t.nombre, ti.nombre AS tienda FROM cotizacion_telas ct
     JOIN telas t ON t.id=ct.tela_id JOIN tiendas ti ON ti.id=t.tienda_id WHERE ct.cotizacion_id=?`, [id]);
  const [maderas] = await pool.query(
    `SELECT cm.*, m.nombre FROM cotizacion_maderas cm JOIN maderas m ON m.id=cm.madera_id WHERE cm.cotizacion_id=?`, [id]);
  const [espumas] = await pool.query(
    `SELECT ce.*, e.nombre FROM cotizacion_espumas ce JOIN espumas e ON e.id=ce.espuma_id WHERE ce.cotizacion_id=?`, [id]);

  res.json({ ...cot, insumos, telas, maderas, espumas });
});

app.post('/api/cotizaciones', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const {
      cliente_id, tipo_mueble_id,
      flete, valor_agregado, mano_obra, pct_ganancia,
      total_materiales, total_telas, total_madera, total_espuma,
      notas, estatus, insumos, telas, maderas, espumas
    } = req.body;

    const [res1] = await conn.query(
      `INSERT INTO cotizaciones
       (cliente_id, tipo_mueble_id, flete, valor_agregado, mano_obra, pct_ganancia,
        total_materiales, total_telas, total_madera, total_espuma, notas, estatus)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [cliente_id||null, tipo_mueble_id, flete, valor_agregado, mano_obra, pct_ganancia,
       total_materiales, total_telas, total_madera, total_espuma, notas||null, estatus||'borrador']
    );
    const cotId = res1.insertId;

    for (const r of (insumos||[]))
      await conn.query('INSERT INTO cotizacion_insumos (cotizacion_id,insumo_id,cantidad,costo_unitario) VALUES (?,?,?,?)',
        [cotId, r.insumo_id, r.cantidad, r.costo_unitario]);

    for (const r of (telas||[]))
      await conn.query('INSERT INTO cotizacion_telas (cotizacion_id,tela_id,cantidad,costo_unitario) VALUES (?,?,?,?)',
        [cotId, r.tela_id, r.cantidad, r.costo_unitario]);

    for (const r of (maderas||[]))
      await conn.query('INSERT INTO cotizacion_maderas (cotizacion_id,madera_id,cantidad,costo_unitario) VALUES (?,?,?,?)',
        [cotId, r.madera_id, r.cantidad, r.costo_unitario]);

    for (const r of (espumas||[]))
      await conn.query('INSERT INTO cotizacion_espumas (cotizacion_id,espuma_id,cantidad,costo_unitario) VALUES (?,?,?,?)',
        [cotId, r.espuma_id, r.cantidad, r.costo_unitario]);

    await conn.commit();
    res.json({ id: cotId, mensaje: 'Cotización guardada correctamente' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

app.delete('/api/cotizaciones/:id', async (req, res) => {
  await pool.query('DELETE FROM cotizaciones WHERE id=?', [req.params.id]);
  res.json({ mensaje: 'Cotización eliminada' });
});

// ══════════════════════════════════════════════════════════════
//  GESTIÓN DE CATÁLOGOS (Agregar / Editar / Eliminar productos)
// ══════════════════════════════════════════════════════════════

// ── INSUMOS ──────────────────────────────────────────────────
app.post('/api/insumos', async (req, res) => {
  const { nombre, precio } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  const [r] = await pool.query('INSERT INTO insumos (nombre, precio) VALUES (?,?)', [nombre, precio||null]);
  res.json({ id: r.insertId, mensaje: 'Insumo agregado' });
});

app.put('/api/insumos/:id', async (req, res) => {
  const { nombre, precio } = req.body;
  await pool.query('UPDATE insumos SET nombre=?, precio=? WHERE id=?', [nombre, precio||null, req.params.id]);
  res.json({ mensaje: 'Insumo actualizado' });
});

app.delete('/api/insumos/:id', async (req, res) => {
  await pool.query('UPDATE insumos SET activo=0 WHERE id=?', [req.params.id]);
  res.json({ mensaje: 'Insumo eliminado' });
});

// ── TELAS ─────────────────────────────────────────────────────
app.post('/api/telas', async (req, res) => {
  const { tienda_id, nombre, precio } = req.body;
  if (!tienda_id || !nombre) return res.status(400).json({ error: 'Tienda y nombre requeridos' });
  const [r] = await pool.query('INSERT INTO telas (tienda_id, nombre, precio) VALUES (?,?,?)', [tienda_id, nombre, precio||null]);
  res.json({ id: r.insertId, mensaje: 'Tela agregada' });
});

app.put('/api/telas/:id', async (req, res) => {
  const { nombre, precio, tienda_id } = req.body;
  await pool.query('UPDATE telas SET nombre=?, precio=?, tienda_id=? WHERE id=?', [nombre, precio||null, tienda_id, req.params.id]);
  res.json({ mensaje: 'Tela actualizada' });
});

app.delete('/api/telas/:id', async (req, res) => {
  await pool.query('UPDATE telas SET activo=0 WHERE id=?', [req.params.id]);
  res.json({ mensaje: 'Tela eliminada' });
});

// ── MADERAS ───────────────────────────────────────────────────
app.post('/api/maderas', async (req, res) => {
  const { nombre, precio } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  const [r] = await pool.query('INSERT INTO maderas (nombre, precio) VALUES (?,?)', [nombre, precio||null]);
  res.json({ id: r.insertId, mensaje: 'Madera agregada' });
});

app.put('/api/maderas/:id', async (req, res) => {
  const { nombre, precio } = req.body;
  await pool.query('UPDATE maderas SET nombre=?, precio=? WHERE id=?', [nombre, precio||null, req.params.id]);
  res.json({ mensaje: 'Madera actualizada' });
});

app.delete('/api/maderas/:id', async (req, res) => {
  await pool.query('UPDATE maderas SET activo=0 WHERE id=?', [req.params.id]);
  res.json({ mensaje: 'Madera eliminada' });
});

// ── ESPUMAS ───────────────────────────────────────────────────
app.post('/api/espumas', async (req, res) => {
  const { nombre, densidad, medida, precio } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  const [r] = await pool.query('INSERT INTO espumas (nombre, densidad, medida, precio) VALUES (?,?,?,?)', [nombre, densidad||null, medida||null, precio||null]);
  res.json({ id: r.insertId, mensaje: 'Espuma agregada' });
});

app.put('/api/espumas/:id', async (req, res) => {
  const { nombre, densidad, medida, precio } = req.body;
  await pool.query('UPDATE espumas SET nombre=?, densidad=?, medida=?, precio=? WHERE id=?', [nombre, densidad||null, medida||null, precio||null, req.params.id]);
  res.json({ mensaje: 'Espuma actualizada' });
});

app.delete('/api/espumas/:id', async (req, res) => {
  await pool.query('UPDATE espumas SET activo=0 WHERE id=?', [req.params.id]);
  res.json({ mensaje: 'Espuma eliminada' });
});

// ── TIENDAS ───────────────────────────────────────────────────
app.post('/api/tiendas', async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  const [r] = await pool.query('INSERT INTO tiendas (nombre) VALUES (?)', [nombre]);
  res.json({ id: r.insertId, mensaje: 'Tienda agregada' });
});

// ── INICIO ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor MYV corriendo en http://localhost:${PORT}`));
