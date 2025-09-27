const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const FRASES_PATH = path.join(__dirname, 'frases.json');

app.use(express.json());

function readData() {
  try {
    return JSON.parse(fs.readFileSync(FRASES_PATH, 'utf8'));
  } catch (e) {
    console.error('Error leyendo frases.json:', e.message);
    return {};
  }
}
function writeData(data) {
  fs.writeFileSync(FRASES_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Obtiene el día en español, usando zona horaria de Chile
function getDiaChile(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    timeZone: 'America/Santiago'
  });
  // normaliza a minusculas sin tildes (miércoles -> miercoles)
  const dia = fmt.format(date).toLowerCase();
  return dia.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// GET /frase -> una frase del día actual (Chile), con fallback a _default
app.get('/frase', (req, res) => {
  const data = readData();
  const dia = getDiaChile();
  const pool = (data[dia] && data[dia].length) ? data[dia] : (data._default || []);
  if (!pool.length) return res.status(404).json({ error: 'No hay frases para hoy' });
  res.json({ dia, mensaje: pickRandom(pool) });
});

// GET /frases?day=viernes -> lista las frases de un día (o de hoy si no se pasa)
app.get('/frases', (req, res) => {
  const data = readData();
  const dia = req.query.day
    ? req.query.day.toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    : getDiaChile();
  const frases = data[dia] || [];
  res.json({ dia, total: frases.length, frases });
});

// POST /frases { "texto":"...", "day":"viernes" }  (day opcional: si omites, usa el día de hoy)
app.post('/frases', (req, res) => {
  const data = readData();
  const texto = (req.body.texto || '').toString().trim();
  if (!texto) return res.status(400).json({ error: 'Debes enviar "texto" no vacío' });

  const dia = req.body.day
    ? req.body.day.toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    : getDiaChile();

  data[dia] = Array.isArray(data[dia]) ? data[dia] : [];
  // evita duplicados exactos
  if (data[dia].some(f => f === texto)) {
    return res.status(409).json({ error: 'La frase ya existe para ese día' });
  }
  data[dia].push(texto);
  writeData(data);
  res.status(201).json({ ok: true, dia, total: data[dia].length });
});

// DELETE /frases/:day/:idx  -> borra por índice en un día específico
app.delete('/frases/:day/:idx', (req, res) => {
  const data = readData();
  const dia = req.params.day.toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const idx = Number(req.params.idx);
  if (!Array.isArray(data[dia])) return res.status(404).json({ error: 'Día sin frases' });
  if (Number.isNaN(idx) || idx < 0 || idx >= data[dia].length) {
    return res.status(400).json({ error: 'Índice inválido' });
  }
  const [eliminada] = data[dia].splice(idx, 1);
  writeData(data);
  res.json({ ok: true, dia, eliminada, total: data[dia].length });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
