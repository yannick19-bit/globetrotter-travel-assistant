require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { pool } = require('./config/db');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const destinationsRoutes = require('./routes/destinations.routes');

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    next(error);
  }
});

app.use('/api/destinations', destinationsRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Destination service listening on port ${port}`);
});

module.exports = app;