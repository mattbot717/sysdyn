/**
 * HTML template for sysdyn web dashboard
 *
 * REDESIGNED for clarity, simplicity, and immediate value
 * Target audience: Ranchers who need answers NOW
 */

import {
  PADDOCK_KEYS,
  getPaddockNamesMap,
  PADDOCK_COLORS,
  FORAGE_THRESHOLDS,
  HERD_DEFAULTS,
  getForageStatus,
} from '../config.js';

export function generateHTML(model, results, options = {}) {
  const { steps = 100, dt = 1 } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ranch Dashboard - ${model.name}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #2d3748;
      padding: 20px;
      line-height: 1.6;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    /* HERO SECTION - Shows immediate status */
    .hero {
      background: white;
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }

    .hero h1 {
      font-size: 2.5rem;
      color: #2d3748;
      margin-bottom: 10px;
      font-weight: 700;
    }

    .hero .subtitle {
      font-size: 1.2rem;
      color: #718096;
      margin-bottom: 30px;
    }

    /* WEATHER SECTION */
    .weather-box {
      background: white;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .weather-box h2 {
      font-size: 1.6rem;
      color: #2d3748;
      margin-bottom: 15px;
      font-weight: 600;
    }

    .weather-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 15px;
    }

    .weather-stat {
      background: #f7fafc;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }

    .weather-stat .label {
      font-size: 0.85rem;
      color: #718096;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }

    .weather-stat .value {
      font-size: 1.8rem;
      font-weight: 700;
      color: #2d3748;
    }

    .weather-stat .unit {
      font-size: 0.9rem;
      color: #4a5568;
    }

    .forecast-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: 10px;
      margin-top: 15px;
    }

    .forecast-day {
      background: #f7fafc;
      padding: 10px;
      border-radius: 6px;
      text-align: center;
      font-size: 0.75rem;
    }

    .forecast-day .date {
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 5px;
    }

    .forecast-day .rain {
      color: #4299e1;
      font-weight: 600;
    }

    .forecast-day .temp {
      color: #718096;
      font-size: 0.7rem;
    }

    /* STATUS CARDS - Big, clear, obvious */
    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .status-card {
      background: white;
      border-radius: 12px;
      padding: 25px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      border-left: 6px solid #48bb78;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .status-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.15);
    }

    .status-card.warning {
      border-left-color: #ed8936;
    }

    .status-card.critical {
      border-left-color: #f56565;
    }

    .status-card .label {
      font-size: 0.9rem;
      color: #718096;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .status-card .value {
      font-size: 2.5rem;
      font-weight: 700;
      color: #2d3748;
      margin-bottom: 5px;
    }

    .status-card .subvalue {
      font-size: 1.1rem;
      color: #4a5568;
    }

    .status-badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-top: 10px;
    }

    .badge-good { background: #c6f6d5; color: #22543d; }
    .badge-warning { background: #feebc8; color: #7c2d12; }
    .badge-critical { background: #fed7d7; color: #742a2a; }

    /* CHART SECTION */
    .chart-section {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .chart-section h2 {
      font-size: 1.8rem;
      color: #2d3748;
      margin-bottom: 20px;
      font-weight: 600;
    }

    .chart-container {
      position: relative;
      height: 400px;
      margin-bottom: 20px;
    }

    /* CONTROLS */
    .controls {
      background: white;
      border-radius: 12px;
      padding: 25px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .controls h3 {
      font-size: 1.4rem;
      color: #2d3748;
      margin-bottom: 20px;
      font-weight: 600;
    }

    .control-group {
      margin-bottom: 25px;
    }

    .control-group label {
      display: block;
      font-size: 1rem;
      font-weight: 600;
      color: #4a5568;
      margin-bottom: 10px;
    }

    .control-group input[type="range"] {
      width: 100%;
      height: 8px;
      border-radius: 5px;
      background: #e2e8f0;
      outline: none;
      -webkit-appearance: none;
    }

    .control-group input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #667eea;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }

    .control-group input[type="range"]::-moz-range-thumb {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #667eea;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      border: none;
    }

    .control-value {
      display: inline-block;
      background: #edf2f7;
      padding: 6px 14px;
      border-radius: 6px;
      font-weight: 600;
      color: #2d3748;
      margin-left: 10px;
      min-width: 60px;
      text-align: center;
    }

    .button {
      background: #667eea;
      color: white;
      border: none;
      padding: 14px 28px;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .button:hover {
      background: #5a67d8;
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
    }

    .button:active {
      transform: translateY(0);
    }

    /* RECOMMENDATIONS BOX */
    .recommendations {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 12px;
      padding: 25px;
      margin-top: 20px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.2);
    }

    .recommendations h3 {
      font-size: 1.6rem;
      margin-bottom: 15px;
      font-weight: 700;
    }

    .recommendations ul {
      list-style: none;
      font-size: 1.1rem;
    }

    .recommendations li {
      padding: 10px 0;
      padding-left: 30px;
      position: relative;
    }

    .recommendations li:before {
      content: "→";
      position: absolute;
      left: 0;
      font-weight: bold;
      font-size: 1.3rem;
    }

    /* FOOTER */
    .footer {
      text-align: center;
      padding: 20px;
      color: white;
      font-size: 0.9rem;
      margin-top: 40px;
    }

    @media (max-width: 768px) {
      .hero h1 { font-size: 1.8rem; }
      .status-card .value { font-size: 2rem; }
      .chart-container { height: 300px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- HERO SECTION -->
    <div class="hero">
      <h1>🐄 Ranch Management Dashboard</h1>
      <p class="subtitle">${model.description || 'Real-time pasture monitoring and rotation planning'}</p>
    </div>

    <!-- WEATHER FORECAST -->
    <div class="weather-box">
      <h2>🌦️ 14-Day Weather Forecast</h2>
      <div class="weather-summary" id="weatherSummary">
        <div class="weather-stat">
          <div class="label">Total Rain</div>
          <div class="value" id="totalRain">--</div>
          <div class="unit">mm</div>
        </div>
        <div class="weather-stat">
          <div class="label">Total ET</div>
          <div class="value" id="totalET">--</div>
          <div class="unit">mm</div>
        </div>
        <div class="weather-stat">
          <div class="label">Balance</div>
          <div class="value" id="waterBalance">--</div>
          <div class="unit">mm</div>
        </div>
        <div class="weather-stat">
          <div class="label">Outlook</div>
          <div class="value" id="outlook" style="font-size: 1.3rem;">--</div>
        </div>
      </div>
      <div class="forecast-grid" id="forecastGrid">
        <!-- Will be populated by JavaScript -->
      </div>
    </div>

    <!-- STATUS CARDS - The money shot! -->
    <div class="status-grid" id="statusCards">
      <!-- Will be populated by JavaScript -->
    </div>

    <!-- MAIN CHART -->
    <div class="chart-section">
      <h2>📊 Paddock Forage Levels</h2>
      <div class="chart-container">
        <canvas id="forageChart"></canvas>
      </div>
    </div>

    <!-- RECOMMENDATIONS -->
    <div class="recommendations">
      <h3>🎯 What To Do Next:</h3>
      <ul id="recommendations">
        <li>Loading recommendations...</li>
      </ul>
    </div>

    <!-- CONTROLS -->
    <div class="controls">
      <h3>⚙️ Adjust Parameters</h3>

      <div class="control-group">
        <label>
          Herd Size: <span class="control-value" id="herdValue">${model.params.herd_count || 14}</span> head
        </label>
        <input type="range" id="herdSlider" min="4" max="24" step="2" value="${model.params.herd_count || 14}">
      </div>

      <div class="control-group">
        <label>
          Daily Rainfall: <span class="control-value" id="rainValue">${model.params.base_rain_input || 3}</span> mm/day
        </label>
        <input type="range" id="rainSlider" min="0" max="10" step="0.5" value="${model.params.base_rain_input || 3}">
      </div>

      <div class="control-group">
        <label>
          Rotation Days: <span class="control-value" id="rotationValue">${model.params.rotation_days || 14}</span> days
        </label>
        <input type="range" id="rotationSlider" min="7" max="30" step="1" value="${model.params.rotation_days || 14}">
      </div>

      <button class="button" onclick="runSimulation()">🔄 Run Simulation</button>
    </div>

    <div class="footer">
      Built with ❤️ for sustainable ranching | Powered by sysdyn
    </div>
  </div>

  <script>
    // Global state
    let chart = null;
    const modelData = ${JSON.stringify(model)};
    const initialResults = ${JSON.stringify(results)};

    // Config values from server (centralized in lib/config.js)
    const CONFIG = {
      paddocks: ${JSON.stringify(PADDOCK_KEYS)},
      paddockNames: ${JSON.stringify(getPaddockNamesMap())},
      paddockColors: ${JSON.stringify(PADDOCK_COLORS)},
      forageThresholds: ${JSON.stringify(FORAGE_THRESHOLDS)},
      herdDefaults: ${JSON.stringify(HERD_DEFAULTS)},
    };

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      loadWeatherForecast();
      updateStatusCards(initialResults);
      createChart(initialResults);
      updateRecommendations(initialResults);
    });

    // Load and display weather forecast
    async function loadWeatherForecast() {
      try {
        const response = await fetch('/weather');
        const forecast = await response.json();

        // Calculate summary stats
        const totalRain = forecast.reduce((sum, d) => sum + d.rain_mm, 0);
        const totalET = forecast.reduce((sum, d) => sum + d.et_mm, 0);
        const balance = totalRain - totalET;

        // Update summary
        document.getElementById('totalRain').textContent = totalRain.toFixed(1);
        document.getElementById('totalET').textContent = totalET.toFixed(1);
        document.getElementById('waterBalance').textContent =
          (balance > 0 ? '+' : '') + balance.toFixed(1);
        document.getElementById('waterBalance').style.color =
          balance > 0 ? '#48bb78' : '#f56565';

        // Outlook emoji
        const outlookEl = document.getElementById('outlook');
        if (balance > 20) {
          outlookEl.textContent = '🌧️ Wet';
          outlookEl.style.color = '#4299e1';
        } else if (balance > 0) {
          outlookEl.textContent = '☁️ Mild';
          outlookEl.style.color = '#48bb78';
        } else if (balance > -20) {
          outlookEl.textContent = '☀️ Dry';
          outlookEl.style.color = '#ed8936';
        } else {
          outlookEl.textContent = '🔥 Drought';
          outlookEl.style.color = '#f56565';
        }

        // Display daily forecast
        const grid = document.getElementById('forecastGrid');
        grid.innerHTML = forecast.slice(0, 14).map(day => {
          const date = new Date(day.date);
          const dateStr = (date.getMonth() + 1) + '/' + date.getDate();
          return \`
            <div class="forecast-day">
              <div class="date">\${dateStr}</div>
              <div class="rain">💧 \${day.rain_mm.toFixed(0)}mm</div>
              <div class="temp">\${day.temp_min_f.toFixed(0)}-\${day.temp_max_f.toFixed(0)}°F</div>
            </div>
          \`;
        }).join('');

      } catch (error) {
        console.error('Failed to load weather:', error);
        document.getElementById('outlook').textContent = '⚠️';
      }
    }

    // Create the forage chart
    function createChart(results) {
      const ctx = document.getElementById('forageChart').getContext('2d');

      // Extract paddock forage data (using centralized config)
      const paddocks = CONFIG.paddocks;
      const names = CONFIG.paddockNames;
      const colors = CONFIG.paddockColors;

      const datasets = paddocks
        .filter(p => results.stocks[\`\${p}_forage\`])
        .map(p => ({
          label: names[p],
          data: results.stocks[\`\${p}_forage\`],
          borderColor: colors[p],
          backgroundColor: colors[p] + '20',
          borderWidth: 3,
          tension: 0.4,
          fill: false
        }));

      if (chart) chart.destroy();

      chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: results.time,
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                font: { size: 14, weight: '600' },
                padding: 15,
                usePointStyle: true
              }
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: 12,
              titleFont: { size: 14, weight: 'bold' },
              bodyFont: { size: 13 }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Forage (kg/acre)',
                font: { size: 14, weight: '600' }
              },
              grid: { color: '#e2e8f0' }
            },
            x: {
              title: {
                display: true,
                text: 'Days',
                font: { size: 14, weight: '600' }
              },
              grid: { color: '#e2e8f0' }
            }
          },
          interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
          }
        }
      });
    }

    // Update status cards
    function updateStatusCards(results) {
      // Build paddock list from config
      const paddocks = CONFIG.paddocks.map(id => ({
        id,
        name: CONFIG.paddockNames[id]
      }));

      const container = document.getElementById('statusCards');
      container.innerHTML = '';

      // Helper to get forage status (mirrors lib/config.js getForageStatus)
      function getForageStatus(forage) {
        const t = CONFIG.forageThresholds;
        if (forage < t.critical) {
          return { status: 'critical', label: 'Critical - Hay Needed', cardClass: 'critical' };
        }
        if (forage < t.low) {
          return { status: 'warning', label: 'Low - Monitor Closely', cardClass: 'warning' };
        }
        if (forage < t.marginal) {
          return { status: 'warning', label: 'Marginal', cardClass: 'warning' };
        }
        return { status: 'good', label: 'Healthy', cardClass: '' };
      }

      paddocks.forEach(paddock => {
        const forageKey = \`\${paddock.id}_forage\`;
        if (!results.stocks[forageKey]) return;

        const forage = results.stocks[forageKey];
        const current = forage[forage.length - 1];
        const initial = forage[0];
        const change = current - initial;
        const changePct = ((change / initial) * 100).toFixed(1);

        const { status, label: statusText, cardClass } = getForageStatus(current);

        const card = document.createElement('div');
        card.className = \`status-card \${cardClass}\`;
        card.innerHTML = \`
          <div class="label">\${paddock.name}</div>
          <div class="value">\${Math.round(current)}</div>
          <div class="subvalue">kg/acre forage</div>
          <div class="subvalue" style="color: \${change >= 0 ? '#48bb78' : '#f56565'}">
            \${change >= 0 ? '▲' : '▼'} \${Math.abs(changePct)}% from start
          </div>
          <span class="status-badge badge-\${status}">\${statusText}</span>
        \`;
        container.appendChild(card);
      });
    }

    // Update recommendations
    function updateRecommendations(results) {
      const container = document.getElementById('recommendations');
      const recommendations = [];

      // Analyze results and generate recommendations (using centralized config)
      const paddocks = CONFIG.paddocks;
      const names = CONFIG.paddockNames;
      const t = CONFIG.forageThresholds;

      const statuses = paddocks
        .filter(p => results.stocks[\`\${p}_forage\`])
        .map(p => {
          const forage = results.stocks[\`\${p}_forage\`];
          const final = forage[forage.length - 1];
          return { paddock: p, name: names[p], forage: final };
        })
        .sort((a, b) => b.forage - a.forage);

      // Best paddock
      if (statuses.length > 0) {
        const best = statuses[0];
        if (best.forage > t.healthy) {
          recommendations.push(\`Rotate to \${best.name} - excellent forage (\${Math.round(best.forage)} kg/acre)\`);
        }
      }

      // Critical paddocks
      const critical = statuses.filter(s => s.forage < t.critical);
      if (critical.length > 0) {
        critical.forEach(p => {
          recommendations.push(\`\${p.name} CRITICAL - hay feeding required immediately\`);
        });
      }

      // Low paddocks
      const low = statuses.filter(s => s.forage >= t.critical && s.forage < t.low);
      if (low.length > 0) {
        recommendations.push(\`Monitor \${low.map(p => p.name).join(', ')} - forage levels low\`);
      }

      // General advice
      const avgForage = statuses.reduce((sum, s) => sum + s.forage, 0) / statuses.length;
      if (avgForage < t.marginal) {
        recommendations.push('Consider reducing herd size or increasing hay supplementation');
      } else if (avgForage > t.healthy) {
        recommendations.push('Pastures healthy - current stocking rate sustainable');
      }

      container.innerHTML = recommendations.map(r => \`<li>\${r}</li>\`).join('');
    }

    // Slider updates
    document.getElementById('herdSlider').addEventListener('input', (e) => {
      document.getElementById('herdValue').textContent = e.target.value;
    });

    document.getElementById('rainSlider').addEventListener('input', (e) => {
      document.getElementById('rainValue').textContent = e.target.value;
    });

    document.getElementById('rotationSlider').addEventListener('input', (e) => {
      document.getElementById('rotationValue').textContent = e.target.value;
    });

    // Run simulation with updated parameters
    async function runSimulation() {
      const herd = document.getElementById('herdSlider').value;
      const rain = document.getElementById('rainSlider').value;
      const rotation = document.getElementById('rotationSlider').value;

      // Update model params
      modelData.params.herd_count = parseInt(herd);
      modelData.params.total_herd_weight = parseInt(herd) * CONFIG.herdDefaults.averageWeight;
      modelData.params.base_rain_input = parseFloat(rain);
      modelData.params.rotation_days = parseInt(rotation);

      // Call server to run simulation
      try {
        const response = await fetch('/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelData, steps: ${steps}, dt: ${dt} })
        });

        const results = await response.json();

        // Update UI
        updateStatusCards(results);
        createChart(results);
        updateRecommendations(results);
      } catch (error) {
        console.error('Simulation failed:', error);
        alert('Simulation failed. Check console for details.');
      }
    }
  </script>
</body>
</html>`;
}
