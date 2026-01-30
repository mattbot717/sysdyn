/**
 * HTML template generator for sysdyn web dashboard
 *
 * Generates a single-page HTML document with:
 * - Chart.js visualization of stock time-series
 * - Parameter sliders for live re-simulation
 * - Scenario save/compare functionality
 * - Export to PNG and CSV
 *
 * All CSS and JS is embedded inline for zero-dependency deployment.
 */

/**
 * Generate the complete HTML page for the dashboard
 * @param {object} model - The loaded model definition
 * @param {object} results - Initial simulation results
 * @param {object} options - { steps, dt }
 * @returns {string} - Complete HTML document
 */
export function generateHTML(model, results, options = {}) {
  const { steps = 100, dt = 1 } = options;

  // Generate colors for each stock
  const stockNames = Object.keys(model.stocks);
  const colors = generateColors(stockNames.length);
  const stockColors = {};
  stockNames.forEach((name, i) => {
    stockColors[name] = colors[i];
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${model.name} - sysdyn</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
${generateCSS()}
  </style>
</head>
<body>
  <header>
    <h1>${model.name}</h1>
    <p>${model.description || 'System dynamics model'}</p>
  </header>

  <main>
    <section class="chart-container">
      <canvas id="chart"></canvas>
    </section>

    <section class="controls">
      <div class="control-group">
        <h3>Simulation</h3>
        <div class="slider-row">
          <label for="steps">Steps:</label>
          <input type="range" id="steps" min="10" max="500" value="${steps}">
          <span id="steps-value">${steps}</span>
        </div>
        <div class="slider-row">
          <label for="dt">dt:</label>
          <input type="range" id="dt" min="0.1" max="2" step="0.1" value="${dt}">
          <span id="dt-value">${dt}</span>
        </div>
      </div>

      <div class="control-group">
        <h3>Parameters</h3>
${generateParamSliders(model)}
      </div>

      <div class="control-group">
        <h3>Scenarios</h3>
        <button id="save-scenario" class="btn">Save Current</button>
        <div id="scenario-list"></div>
      </div>

      <div class="control-group">
        <h3>Export</h3>
        <button id="export-png" class="btn">Export Chart as PNG</button>
        <button id="export-csv" class="btn">Export Data as CSV</button>
      </div>
    </section>
  </main>

  <script>
${generateJS(model, results, stockColors, options)}
  </script>
</body>
</html>`;
}

/**
 * Generate CSS styles for the dashboard
 */
function generateCSS() {
  return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      min-height: 100vh;
    }

    header {
      background: linear-gradient(135deg, #16213e 0%, #1a1a2e 100%);
      padding: 1.5rem 2rem;
      border-bottom: 1px solid #333;
    }

    header h1 {
      font-size: 1.5rem;
      color: #4cc9f0;
      margin-bottom: 0.25rem;
    }

    header p {
      color: #888;
      font-size: 0.9rem;
    }

    main {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 1rem;
      padding: 1rem;
      height: calc(100vh - 80px);
    }

    .chart-container {
      background: #16213e;
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #chart {
      max-width: 100%;
      max-height: 100%;
    }

    .controls {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      overflow-y: auto;
    }

    .control-group {
      background: #16213e;
      border-radius: 8px;
      padding: 1rem;
    }

    .control-group h3 {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #4cc9f0;
      margin-bottom: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #333;
    }

    .slider-row {
      display: grid;
      grid-template-columns: 100px 1fr 50px;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .slider-row label {
      font-size: 0.85rem;
      color: #aaa;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .slider-row input[type="range"] {
      width: 100%;
      height: 4px;
      -webkit-appearance: none;
      background: #333;
      border-radius: 2px;
      cursor: pointer;
    }

    .slider-row input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      background: #4cc9f0;
      border-radius: 50%;
      cursor: pointer;
    }

    .slider-row span {
      font-size: 0.85rem;
      color: #4cc9f0;
      text-align: right;
      font-family: monospace;
    }

    .btn {
      width: 100%;
      padding: 0.5rem 1rem;
      margin-bottom: 0.5rem;
      background: #333;
      border: 1px solid #444;
      border-radius: 4px;
      color: #eee;
      font-size: 0.85rem;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
    }

    .btn:hover {
      background: #444;
      border-color: #4cc9f0;
    }

    .btn:active {
      background: #4cc9f0;
      color: #1a1a2e;
    }

    #scenario-list {
      margin-top: 0.5rem;
    }

    .scenario-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.5rem;
      margin-bottom: 0.25rem;
      background: #1a1a2e;
      border-radius: 4px;
      font-size: 0.85rem;
      cursor: pointer;
      border: 1px solid transparent;
      transition: border-color 0.2s;
    }

    .scenario-item:hover {
      border-color: #333;
    }

    .scenario-item.active {
      border-color: #4cc9f0;
    }

    .scenario-item .color-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .scenario-item .name {
      flex: 1;
    }

    .scenario-item .remove {
      color: #666;
      cursor: pointer;
    }

    .scenario-item .remove:hover {
      color: #f00;
    }

    @media (max-width: 800px) {
      main {
        grid-template-columns: 1fr;
        grid-template-rows: 400px auto;
      }
    }
  `;
}

/**
 * Generate parameter slider HTML
 */
function generateParamSliders(model) {
  const params = model.params || {};
  let html = '';

  for (const [name, value] of Object.entries(params)) {
    // Calculate reasonable min/max based on value
    const min = 0;
    const max = value * 5 || 10;
    const step = value < 1 ? 0.01 : value < 10 ? 0.1 : 1;

    html += `        <div class="slider-row">
          <label for="param-${name}" title="${name}">${name}:</label>
          <input type="range" id="param-${name}" data-param="${name}"
                 min="${min}" max="${max}" step="${step}" value="${value}">
          <span id="param-${name}-value">${value}</span>
        </div>\n`;
  }

  return html;
}

/**
 * Generate JavaScript for the dashboard
 */
function generateJS(model, results, stockColors, options) {
  return `
    // ============================================================
    // State
    // ============================================================

    const initialModel = ${JSON.stringify(model)};
    const initialResults = ${JSON.stringify(results)};
    const stockColors = ${JSON.stringify(stockColors)};

    let currentParams = { ...initialModel.params };
    let currentSteps = ${options.steps || 100};
    let currentDt = ${options.dt || 1};
    let scenarios = [];
    let debounceTimer = null;

    // ============================================================
    // Chart Setup
    // ============================================================

    const ctx = document.getElementById('chart').getContext('2d');

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: initialResults.time,
        datasets: createDatasets(initialResults)
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#eee' }
          },
          tooltip: {
            backgroundColor: '#16213e',
            titleColor: '#4cc9f0',
            bodyColor: '#eee',
            borderColor: '#333',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Time', color: '#888' },
            ticks: { color: '#888' },
            grid: { color: '#333' }
          },
          y: {
            title: { display: true, text: 'Value', color: '#888' },
            ticks: { color: '#888' },
            grid: { color: '#333' }
          }
        }
      }
    });

    function createDatasets(results) {
      const datasets = [];

      for (const [name, values] of Object.entries(results.stocks)) {
        datasets.push({
          label: name,
          data: values,
          borderColor: stockColors[name],
          backgroundColor: stockColors[name] + '20',
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2
        });
      }

      return datasets;
    }

    // ============================================================
    // Simulation
    // ============================================================

    async function runSimulation() {
      const response = await fetch('/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: currentParams,
          steps: currentSteps,
          dt: currentDt
        })
      });

      const results = await response.json();
      updateChart(results);
    }

    function updateChart(results) {
      chart.data.labels = results.time;

      // Update main datasets
      const stockNames = Object.keys(results.stocks);
      for (let i = 0; i < stockNames.length; i++) {
        const name = stockNames[i];
        chart.data.datasets[i].data = results.stocks[name];
      }

      chart.update('none');
    }

    function debouncedRun() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runSimulation, 300);
    }

    // ============================================================
    // Event Handlers
    // ============================================================

    // Simulation controls
    document.getElementById('steps').addEventListener('input', (e) => {
      currentSteps = parseInt(e.target.value);
      document.getElementById('steps-value').textContent = currentSteps;
      debouncedRun();
    });

    document.getElementById('dt').addEventListener('input', (e) => {
      currentDt = parseFloat(e.target.value);
      document.getElementById('dt-value').textContent = currentDt.toFixed(1);
      debouncedRun();
    });

    // Parameter sliders
    document.querySelectorAll('[data-param]').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const param = e.target.dataset.param;
        const value = parseFloat(e.target.value);
        currentParams[param] = value;
        document.getElementById('param-' + param + '-value').textContent =
          value < 0.1 ? value.toFixed(3) : value < 10 ? value.toFixed(2) : value.toFixed(1);
        debouncedRun();
      });
    });

    // ============================================================
    // Scenarios
    // ============================================================

    let scenarioCounter = 0;
    const scenarioColors = ['#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4cc9f0'];

    document.getElementById('save-scenario').addEventListener('click', async () => {
      // Fetch current results
      const response = await fetch('/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: currentParams,
          steps: currentSteps,
          dt: currentDt
        })
      });

      const results = await response.json();
      const color = scenarioColors[scenarioCounter % scenarioColors.length];
      scenarioCounter++;

      const scenario = {
        id: Date.now(),
        name: 'Scenario ' + scenarioCounter,
        params: { ...currentParams },
        results,
        color,
        active: true
      };

      scenarios.push(scenario);
      addScenarioToChart(scenario);
      renderScenarioList();
    });

    function addScenarioToChart(scenario) {
      const stockNames = Object.keys(scenario.results.stocks);

      for (const name of stockNames) {
        chart.data.datasets.push({
          label: scenario.name + ' - ' + name,
          data: scenario.results.stocks[name],
          borderColor: scenario.color,
          backgroundColor: 'transparent',
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 1,
          borderDash: [5, 5],
          scenarioId: scenario.id
        });
      }

      chart.update('none');
    }

    function removeScenarioFromChart(scenarioId) {
      chart.data.datasets = chart.data.datasets.filter(ds => ds.scenarioId !== scenarioId);
      chart.update('none');
    }

    function toggleScenario(scenarioId) {
      const scenario = scenarios.find(s => s.id === scenarioId);
      if (!scenario) return;

      scenario.active = !scenario.active;

      if (scenario.active) {
        addScenarioToChart(scenario);
      } else {
        removeScenarioFromChart(scenarioId);
      }

      renderScenarioList();
    }

    function deleteScenario(scenarioId) {
      removeScenarioFromChart(scenarioId);
      scenarios = scenarios.filter(s => s.id !== scenarioId);
      renderScenarioList();
    }

    function renderScenarioList() {
      const list = document.getElementById('scenario-list');
      list.innerHTML = scenarios.map(s => \`
        <div class="scenario-item \${s.active ? 'active' : ''}" data-id="\${s.id}">
          <span class="color-dot" style="background: \${s.color}"></span>
          <span class="name">\${s.name}</span>
          <span class="remove" onclick="event.stopPropagation(); deleteScenario(\${s.id})">&times;</span>
        </div>
      \`).join('');

      list.querySelectorAll('.scenario-item').forEach(item => {
        item.addEventListener('click', () => toggleScenario(parseInt(item.dataset.id)));
      });
    }

    // Make deleteScenario available globally for onclick
    window.deleteScenario = deleteScenario;

    // ============================================================
    // Export
    // ============================================================

    document.getElementById('export-png').addEventListener('click', () => {
      const link = document.createElement('a');
      link.download = '${model.name}-chart.png';
      link.href = chart.toBase64Image();
      link.click();
    });

    document.getElementById('export-csv').addEventListener('click', async () => {
      // Get current results
      const response = await fetch('/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: currentParams,
          steps: currentSteps,
          dt: currentDt
        })
      });

      const results = await response.json();

      // Build CSV
      const stockNames = Object.keys(results.stocks);
      const headers = ['time', ...stockNames];
      const rows = [headers.join(',')];

      for (let i = 0; i < results.time.length; i++) {
        const row = [results.time[i]];
        for (const name of stockNames) {
          row.push(results.stocks[name][i]);
        }
        rows.push(row.join(','));
      }

      const csv = rows.join('\\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.download = '${model.name}-data.csv';
      link.href = url;
      link.click();

      URL.revokeObjectURL(url);
    });
  `;
}

/**
 * Generate distinct colors for chart lines
 */
function generateColors(count) {
  const baseColors = [
    '#4cc9f0', // cyan
    '#f72585', // pink
    '#7209b7', // purple
    '#3a0ca3', // indigo
    '#4361ee', // blue
    '#06d6a0', // green
    '#ffd166', // yellow
    '#ef476f', // red
  ];

  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  return colors;
}
