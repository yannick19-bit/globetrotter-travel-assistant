const express = require('express');
const router = express.Router();
const { searchDestinations, getDestinationById } = require('../controllers/destinations.controller');

router.get('/', searchDestinations);
router.get('/:id', getDestinationById);

module.exports = router;
