// server.mjs
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.use(helmet());
app.use(express.json({ limit: '100kb' })); // limita el tamaño del body por seguridad

// CONFIG
const PORT = process.env.PORT || 4000;
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim());

// CORS: restringe a tus dominios en producción
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow tools like curl / mobile apps without origin
    if (FRONTEND_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('CORS blocked'));
  }
}));

// Rate limiting básico
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 requests por IP por minuto (ajusta según tus necesidades)
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Inicializar cliente Gemini (server-side): usa la key solo en el servidor
function createGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY not set in environment');
  }
  return new GoogleGenAI({ apiKey: key });
}

// Endpoint: generar contenido (proxy)
app.post('/api/gemini/generate', async (req, res) => {
  try {
    const { prompt, model = 'gemini-2.5-flash', config = {} } = req.body;

    if (!prompt || (typeof prompt !== 'string' && !Array.isArray(prompt))) {
      return res.status(400).json({ error: 'prompt (string or array) required' });
    }

    // Normalizamos a array si viene string
    const contents = Array.isArray(prompt) ? prompt : [prompt];

    const ai = createGeminiClient();

    // Llamada al SDK server-side
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        // ejemplo seguro: no loguear interacción del cliente
        logging_config: { log_client_interaction: false },
        ...config
      }
    });

    // Devuelve la respuesta cruda o un subset (más seguro)
    // Aquí devuelvo la respuesta completa tal cual; si prefieres,
    // filtra propiedades sensibles antes de enviar al cliente.
    res.json(response);
  } catch (err) {
    // No devuelvas la key ni detalles sensibles.
    console.error('Gemini proxy error:', err?.message || err);
    // Si el upstream devolvió body, intenta pasarlo (útil para debugging controlado)
    const status = err?.response?.status || 500;
    const details = err?.response?.data ? err.response.data : { message: err?.message || 'Upstream error' };
    res.status(status).json({ error: 'Upstream error', details });
  }
});

// (Opcional) Endpoint para validar health
app.get('/api/health', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'development' }));

app.listen(PORT, () => console.log(`Gemini proxy listening on port ${PORT}`));
