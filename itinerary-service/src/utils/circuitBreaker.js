const CircuitBreaker = require('opossum');
const axios = require('axios');

const DESTINATION_SERVICE_URL = process.env.DESTINATION_SERVICE_URL || 'http://localhost:3002';

// Fonction "brute" qui fait l'appel HTTP réel — c'est elle que le
// circuit breaker surveille.
async function fetchDestinationRaw(id) {
  const { data } = await axios.get(`${DESTINATION_SERVICE_URL}/api/destinations/${id}`, {
    timeout: 2000,
  });
  return data;
}

// Un seul breaker partagé pour tous les appels vers destination-service :
// - timeout: 2000ms -> si destination-service met plus de 2s à répondre,
//   c'est compté comme un échec.
// - errorThresholdPercentage: 50 -> si 50% des appels échouent sur la
//   fenêtre glissante, le circuit s'ouvre.
// - resetTimeout: 8000ms -> après 8s en position "ouvert", le breaker
//   laisse passer UNE requête test ("half-open") pour voir si le service
//   est revenu. Si oui, le circuit se referme automatiquement.
const breaker = new CircuitBreaker(fetchDestinationRaw, {
  timeout: 2000,
  errorThresholdPercentage: 50,
  resetTimeout: 8000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  name: 'destination-service-breaker',
});

breaker.fallback(() => null);

breaker.on('open', () => console.warn('🔶 [circuit-breaker] OUVERT — destination-service semble en panne, on arrête d\'essayer temporairement'));
breaker.on('halfOpen', () => console.info('🟡 [circuit-breaker] SEMI-OUVERT — test de reconnexion à destination-service'));
breaker.on('close', () => console.info('🟢 [circuit-breaker] FERMÉ — destination-service répond de nouveau normalement'));
breaker.on('reject', () => console.warn('⛔ [circuit-breaker] Appel rejeté immédiatement (circuit ouvert), pas d\'attente de timeout'));

// Fonction publique utilisée par le contrôleur — toujours sûre, ne
// lance jamais d'exception (retourne null en cas d'échec ou de circuit ouvert).
async function fetchDestinationSafe(id) {
  try {
    return await breaker.fire(id);
  } catch (err) {
    return null;
  }
}

module.exports = { fetchDestinationSafe, breaker };
