const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'frontend' });
});

app.get('/api/images/:folder', (req, res) => {
  const folder = decodeURIComponent(req.params.folder || '');
  const publicImagesRoot = path.resolve(__dirname, 'public', 'images');
  const folderPath = path.resolve(publicImagesRoot, folder);
  if (!folderPath.startsWith(publicImagesRoot)) {
    return res.status(400).json({ error: 'invalid folder' });
  }

  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    return res.status(404).json({ images: [] });
  }

  const files = fs.readdirSync(folderPath)
    .filter(name => fs.statSync(path.join(folderPath, name)).isFile())
    .filter(name => /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name))
    .sort();

  return res.json({ images: files });
});

// Toute route inconnue renvoie index.html (SPA côté client)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Frontend démarré sur http://localhost:${PORT}`);
});
