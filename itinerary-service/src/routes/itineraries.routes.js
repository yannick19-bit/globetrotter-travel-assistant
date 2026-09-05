const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  createItinerary,
  listItineraries,
  getItinerary,
  updateItinerary,
  deleteItinerary,
  shareItinerary
} = require('../controllers/itineraries.controller');

router.use(authenticate); // toutes les routes itinéraires nécessitent une authentification

router.post('/', createItinerary);
router.get('/', listItineraries);
router.get('/:id', getItinerary);
router.put('/:id', updateItinerary);
router.delete('/:id', deleteItinerary);
router.post('/:id/share', shareItinerary);

module.exports = router;
