// Gestion centralisée des erreurs (limitation connue du monolithe :
// une erreur non gérée ici peut faire planter TOUTE l'application,
// contrairement à une architecture microservices où l'impact serait isolé)

function errorHandler(err, req, res, next) {
  console.error('🔥 Erreur:', err.stack || err.message);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Erreur interne du serveur',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route non trouvée: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFoundHandler };
