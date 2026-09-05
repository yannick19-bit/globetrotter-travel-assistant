const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 2,
  connectTimeout: 3000,
  retryStrategy: (times) => Math.min(times * 200, 2000),
});

redis.on('connect', () => console.log('✅ [destination-service] Connexion Redis établie'));
redis.on('error', (err) => console.error('⚠️ [destination-service] Erreur Redis:', err.message));

const CACHE_TTL_SECONDS = 30;

// Pattern "cache-aside" : on cherche en cache d'abord, sinon on calcule
// et on remplit le cache pour la prochaine fois.
async function getOrSetCache(key, fetchFn) {
  try {
    const cached = await redis.get(key);
    if (cached) {
      console.log(`🟢 [cache HIT] ${key}`);
      return { data: JSON.parse(cached), cache: 'HIT' };
    }
  } catch (err) {
    console.error('⚠️ Lecture cache échouée, on continue sans cache:', err.message);
  }

  console.log(`🔴 [cache MISS] ${key}`);
  const data = await fetchFn();

  try {
    await redis.set(key, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
  } catch (err) {
    console.error('⚠️ Écriture cache échouée (non bloquant):', err.message);
  }

  return { data, cache: 'MISS' };
}

module.exports = { redis, getOrSetCache, CACHE_TTL_SECONDS };
