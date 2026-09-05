require('dotenv').config();
const { Worker } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
};

console.log('👷 Worker itinerary-events démarré, en attente de messages...');

const worker = new Worker(
  'itinerary-events',
  async (job) => {
    if (job.name === 'itinerary-created') {
      const { itineraryId, userId, title } = job.data;
      // Simule un traitement asynchrone (ex: envoi d'un email de
      // confirmation, génération d'un PDF, notification push...).
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log(`📧 [worker] Notification envoyée pour l'itinéraire #${itineraryId} ("${title}") de l'utilisateur #${userId}`);
    }
  },
  { connection }
);

worker.on('completed', (job) => {
  console.log(`✅ [worker] Job ${job.id} terminé`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ [worker] Job ${job.id} a échoué:`, err.message);
});

process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});
