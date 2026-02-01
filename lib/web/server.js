/**
 * HTTP server for sysdyn web dashboard
 *
 * Uses Node's built-in http module for zero dependencies.
 * Serves a single-page dashboard with live simulation updates.
 *
 * Routes:
 *   GET  /      - Dashboard HTML page
 *   GET  /model - Current model definition as JSON
 *   POST /run   - Run simulation with parameters, returns results JSON
 */

import { createServer } from 'http';
import { exec } from 'child_process';
import { simulate } from '../engine.js';
import { loadModel } from '../loader.js';
import { generateHTML } from './template.js';
import { getForecast } from '../forecast.js';

/**
 * Start the web dashboard server
 * @param {string} modelName - Name of model to load
 * @param {object} options - { port, steps, dt }
 */
export async function startServer(modelName, options = {}) {
  const { port = 3000, steps = 100, dt = 1 } = options;

  // Load model
  console.log(`\n📊 Loading model: ${modelName}...`);
  const model = await loadModel(modelName);

  // Run initial simulation
  console.log(`⚙️  Running initial simulation...`);
  const initialResults = simulate(model, { steps, dt });

  // Create server
  const server = createServer(async (req, res) => {
    // Parse URL
    const url = new URL(req.url, `http://localhost:${port}`);
    const path = url.pathname;

    try {
      if (req.method === 'GET' && path === '/') {
        // Serve dashboard
        const html = generateHTML(model, initialResults, { steps, dt });
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(html);

      } else if (req.method === 'GET' && path === '/model') {
        // Return model definition
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify(model));

      } else if (req.method === 'POST' && path === '/run') {
        // Run simulation with provided params
        const body = await readBody(req);
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch (parseErr) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
          return;
        }
        const { params, steps: reqSteps, dt: reqDt } = parsed;

        // Create modified model with new params
        const modifiedModel = {
          ...model,
          params: { ...model.params, ...params }
        };

        // Run simulation
        const results = simulate(modifiedModel, {
          steps: reqSteps || steps,
          dt: reqDt || dt
        });

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify(results));

      } else if (req.method === 'GET' && path === '/weather') {
        // Return 14-day weather forecast
        const forecast = await getForecast(14);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify(forecast));

      } else {
        // 404
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    } catch (err) {
      console.error('Server error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  // Start listening
  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n🌐 Dashboard running at: ${url}\n`);
    console.log('   Press Ctrl+C to stop\n');

    // Auto-open browser
    openBrowser(url);
  });

  // Handle clean shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down server...\n');
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    server.close(() => {
      process.exit(0);
    });
  });

  return server;
}

/**
 * Read request body as string
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/**
 * Open URL in default browser
 */
function openBrowser(url) {
  const platform = process.platform;
  let command;

  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, (err) => {
    if (err) {
      console.log(`   Open manually: ${url}`);
    }
  });
}
