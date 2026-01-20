// server.js
import express from 'express';
import fetch from 'node-fetch'; // npm install node-fetch

const app = express();
const PORT = 3000;

// Activer CORS pour tous les clients
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // autorise toutes les origines
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

// Route pour récupérer un ICS via URL passée en query param
app.get('/api/ical', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).send('Missing url parameter');
    }

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(500).send('Failed to fetch ICS');
    }

    const text = await response.text();
    res.setHeader('Content-Type', 'text/calendar');
    res.send(text);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.listen(PORT, () => {
  console.log(`CORS proxy server running on http://localhost:${PORT}`);
});
