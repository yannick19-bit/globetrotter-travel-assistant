const { pool } = require('../config/db');
const { getOrSetCache } = require('../config/redis');

// GET /api/destinations?category=beach&budget_level=moderate&search=bali
async function searchDestinations(req, res, next) {
  try {
    const { category, budget_level, search } = req.query;

    // Clé de cache basée sur les filtres exacts de la requête, pour que
    // deux recherches différentes ne se marchent jamais dessus.
    const cacheKey = `destinations:search:${category || 'all'}:${budget_level || 'all'}:${search || ''}`;

    const { data, cache } = await getOrSetCache(cacheKey, async () => {
      let query = 'SELECT * FROM destinations WHERE 1=1';
      const params = [];

      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }
      if (budget_level) {
        query += ' AND budget_level = ?';
        params.push(budget_level);
      }
      if (search) {
        query += ' AND (name LIKE ? OR country LIKE ? OR description LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term);
      }
      query += ' ORDER BY popularity_score DESC';

      const [rows] = await pool.query(query, params);
      return { count: rows.length, destinations: rows };
    });

    res.set('X-Cache', cache);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getDestinationById(req, res, next) {
  try {
    const cacheKey = `destinations:byId:${req.params.id}`;

    const { data, cache } = await getOrSetCache(cacheKey, async () => {
      const [rows] = await pool.query('SELECT * FROM destinations WHERE id = ?', [req.params.id]);
      if (rows.length === 0) {
        const err = new Error('Destination non trouvée');
        err.statusCode = 404;
        err.isNotFound = true;
        throw err;
      }
      return rows[0];
    });

    res.set('X-Cache', cache);
    res.json(data);
  } catch (err) {
    if (err.isNotFound) return res.status(404).json({ error: err.message });
    next(err);
  }
}

module.exports = { searchDestinations, getDestinationById };
