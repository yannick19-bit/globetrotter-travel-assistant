require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { pool } = require('./config/db');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const itinerariesRoutes = require('./routes/itineraries.routes');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'itinerary-service' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.use('/api/itineraries', itinerariesRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Itinerary service running on port ${PORT}`);
});