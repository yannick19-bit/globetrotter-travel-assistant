require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  destination: process.env.DESTINATION_SERVICE_URL || 'http://localhost:3002',
  itinerary: process.env.ITINERARY_SERVICE_URL || 'http://localhost:3003'
};

app.use(cors());
app.use(morgan('dev'));

// Healthcheck agrégé : interroge chaque microservice et résume l'état global.
// C'est la première brique d'observabilité au niveau de l'architecture distribuée
// (avant ça, il fallait tester chaque service un par un).
app.get('/health', async (req, res) => {
  const results = {};
  await Promise.all(
    Object.entries(SERVICES).map(async ([name, url]) => {
      try {
        const { data } = await axios.get(`${url}/health`, { timeout: 2000 });
        results[name] = data;
      } catch (err) {
        results[name] = { status: 'unreachable', error: err.message };
      }
    })
  );
  const allOk = Object.values(results).every(r => r.status === 'ok');
  res.status(allOk ? 200 : 503).json({
    gateway: 'ok',
    overall_status: allOk ? 'ok' : 'degraded',
    services: results
  });
});

// Routage : chaque service attend déjà son propre préfixe (/api/auth, etc.),
// donc pas besoin de réécrire le chemin — on transmet tel quel.
app.use('/api/auth', createProxyMiddleware({
  target: SERVICES.auth,
  changeOrigin: true,
  pathRewrite: (path) => `/api/auth${path}`
}));

app.use('/api/destinations', createProxyMiddleware({
  target: SERVICES.destination,
  changeOrigin: true,
  pathRewrite: (path) => `/api/destinations${path}`
}));

app.use('/api/itineraries', createProxyMiddleware({
  target: SERVICES.itinerary,
  changeOrigin: true,
  pathRewrite: (path) => `/api/itineraries${path}`
}));

app.use((req, res) => {
  res.status(404).json({ error: `Route non trouvée: ${req.method} ${req.originalUrl}` });
});

app.listen(PORT, () => {
  console.log(`🚀 API Gateway démarré sur http://localhost:${PORT}`);
  console.log(`   Healthcheck agrégé: http://localhost:${PORT}/health`);
  console.log(`   Routes: /api/auth -> ${SERVICES.auth}`);
  console.log(`           /api/destinations -> ${SERVICES.destination}`);
  console.log(`           /api/itineraries -> ${SERVICES.itinerary}`);
});