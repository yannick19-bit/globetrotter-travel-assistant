const { Queue } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
};

const itineraryEventsQueue = new Queue('itinerary-events', { connection });

// Pousse un événement dans la file au lieu de traiter la notification
// tout de suite. Le client reçoit sa réponse immédiatement ; le travail
// (envoi d'un email de confirmation, simulé ici) se fait de façon
// asynchrone, même si le worker qui le traite est temporairement coupé —
// le message reste en attente dans Redis jusqu'à ce qu'un worker le prenne.
async function enqueueItineraryCreated(payload) {
  try {
    await itineraryEventsQueue.add('itinerary-created', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  } catch (err) {
    // On ne bloque jamais la création de l'itinéraire si la file est
    // indisponible — c'est une amélioration, pas une dépendance critique.
    console.error('⚠️ Impossible de publier l\'événement dans la file:', err.message);
  }
}

module.exports = { itineraryEventsQueue, enqueueItineraryCreated };
