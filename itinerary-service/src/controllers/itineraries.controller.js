const { pool } = require('../config/db');
const { fetchDestinationSafe } = require('../utils/circuitBreaker');
const { enqueueItineraryCreated } = require('../queue');

// POST /api/itineraries
async function createItinerary(req, res, next) {
  try {
    const userId = req.user.id;
    const { title, start_date, end_date, destination_ids } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title est requis' });
    }

    const [result] = await pool.query(
      'INSERT INTO itineraries (user_id, title, start_date, end_date) VALUES (?, ?, ?, ?)',
      [userId, title, start_date || null, end_date || null]
    );

    const itineraryId = result.insertId;

    if (Array.isArray(destination_ids)) {
      for (let i = 0; i < destination_ids.length; i++) {
        await pool.query(
          'INSERT INTO itinerary_items (itinerary_id, destination_id, visit_order) VALUES (?, ?, ?)',
          [itineraryId, destination_ids[i], i]
        );
      }
    }

    // Publie un événement asynchrone (ex: notification) sans bloquer la
    // réponse au client — c'est le worker séparé qui s'en occupera.
    await enqueueItineraryCreated({ itineraryId, userId, title });

    res.status(201).json({ message: 'Itinéraire créé', itinerary_id: itineraryId });
  } catch (err) {
    next(err);
  }
}

// GET /api/itineraries
async function listItineraries(req, res, next) {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT i.*, 'owner' AS access_type FROM itineraries i WHERE i.user_id = ?
       UNION
       SELECT i.*, s.permission AS access_type FROM itineraries i
       JOIN itinerary_shares s ON s.itinerary_id = i.id
       WHERE s.shared_with_user_id = ?
       ORDER BY created_at DESC`,
      [userId, userId]
    );
    res.json({ count: rows.length, itineraries: rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/itineraries/:id — enrichit via circuit breaker (jamais bloquant)
async function getItinerary(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [access] = await pool.query(
      `SELECT 1 FROM itineraries WHERE id = ? AND user_id = ?
       UNION
       SELECT 1 FROM itinerary_shares WHERE itinerary_id = ? AND shared_with_user_id = ?`,
      [id, userId, id, userId]
    );
    if (access.length === 0) {
      return res.status(403).json({ error: 'Accès refusé à cet itinéraire' });
    }

    const [itinRows] = await pool.query('SELECT * FROM itineraries WHERE id = ?', [id]);
    if (itinRows.length === 0) {
      return res.status(404).json({ error: 'Itinéraire non trouvé' });
    }

    const [items] = await pool.query(
      'SELECT id, destination_id, visit_order, notes FROM itinerary_items WHERE itinerary_id = ? ORDER BY visit_order',
      [id]
    );

    // Chaque appel passe par le circuit breaker : si destination-service
    // est en panne, on ne reste jamais bloqué à attendre un timeout HTTP
    // classique une fois le circuit ouvert — la réponse dégrade
    // gracieusement (destination: null) au lieu de faire planter la requête.
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const destination = await fetchDestinationSafe(item.destination_id);
        return { ...item, destination };
      })
    );

    res.json({ ...itinRows[0], items: enrichedItems });
  } catch (err) {
    next(err);
  }
}

// PUT /api/itineraries/:id
async function updateItinerary(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, start_date, end_date, status } = req.body;

    const [owned] = await pool.query('SELECT id FROM itineraries WHERE id = ? AND user_id = ?', [id, userId]);
    if (owned.length === 0) {
      return res.status(403).json({ error: 'Seul le propriétaire peut modifier cet itinéraire' });
    }

    await pool.query(
      `UPDATE itineraries SET
        title = COALESCE(?, title),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        status = COALESCE(?, status)
       WHERE id = ?`,
      [title, start_date, end_date, status, id]
    );

    res.json({ message: 'Itinéraire mis à jour' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/itineraries/:id
async function deleteItinerary(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [result] = await pool.query('DELETE FROM itineraries WHERE id = ? AND user_id = ?', [id, userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Itinéraire non trouvé ou non autorisé' });
    }

    res.json({ message: 'Itinéraire supprimé' });
  } catch (err) {
    next(err);
  }
}

// POST /api/itineraries/:id/share
async function shareItinerary(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { shared_with_user_id, permission } = req.body;

    if (!shared_with_user_id) {
      return res.status(400).json({ error: 'shared_with_user_id est requis' });
    }

    const [owned] = await pool.query('SELECT id FROM itineraries WHERE id = ? AND user_id = ?', [id, userId]);
    if (owned.length === 0) {
      return res.status(403).json({ error: 'Seul le propriétaire peut partager cet itinéraire' });
    }

    await pool.query(
      `INSERT INTO itinerary_shares (itinerary_id, shared_with_user_id, permission)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE permission = VALUES(permission)`,
      [id, shared_with_user_id, permission || 'view']
    );

    res.json({ message: `Itinéraire partagé avec l'utilisateur ${shared_with_user_id}` });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createItinerary,
  listItineraries,
  getItinerary,
  updateItinerary,
  deleteItinerary,
  shareItinerary
};
