import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 80;
const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:5000';

// Endpoint to get backend URL config
app.get('/api/config', (req, res) => {
  res.json({ backendUrl: BACKEND_URL });
});

// Serve static files
app.use(express.static(join(__dirname, 'dist')));

// Inject backend URL into index.html for SPA routing
app.get('*', (req, res) => {
  try {
    const indexPath = join(__dirname, 'dist', 'index.html');
    let html = readFileSync(indexPath, 'utf-8');
    
    // Inject backend URL as a script tag
    const configScript = `
      <script>
        window.__BACKEND_URL__ = "${BACKEND_URL}";
      </script>
    `;
    
    html = html.replace('</head>', `${configScript}</head>`);
    res.send(html);
  } catch (error) {
    res.status(500).send('Error loading application');
  }
});

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
  console.log(`Backend URL: ${BACKEND_URL}`);
});

