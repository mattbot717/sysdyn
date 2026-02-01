/**
 * HTML template for Pyrennial Farms Dashboard
 *
 * Design: Editorial Refined - Apple Weather meets Stripe
 * Clean, beautiful, informative without clutter.
 * Large text, high contrast, system light/dark theme.
 */

import {
  PADDOCK_KEYS,
  getPaddockNamesMap,
  PADDOCK_COLORS,
  FORAGE_THRESHOLDS,
  HERD_DEFAULTS,
} from '../config.js';

export function generateHTML(model, results, options = {}) {
  const { steps = 100, dt = 1, rotationHistory = null } = options;

  // Get current paddock info
  const currentPaddock = rotationHistory?.currentPaddock || null;
  const daysOnPaddock = currentPaddock?.since
    ? Math.floor((Date.now() - new Date(currentPaddock.since).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>Pyrennial Farms</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    /* ============================================
       CSS CUSTOM PROPERTIES - Light/Dark Themes
       ============================================ */
    :root {
      /* Light theme (default) */
      --bg-primary: #FAFAF9;
      --bg-secondary: #FFFFFF;
      --bg-tertiary: #F5F5F4;
      --text-primary: #1C1917;
      --text-secondary: #57534E;
      --text-tertiary: #A8A29E;
      --border-color: #E7E5E4;
      --border-subtle: #F5F5F4;

      /* Accent - Sage Green */
      --accent: #4A7C59;
      --accent-light: #5C9A6F;
      --accent-bg: rgba(74, 124, 89, 0.08);

      /* Status colors */
      --status-healthy: #4A7C59;
      --status-healthy-bg: rgba(74, 124, 89, 0.1);
      --status-marginal: #B59F3B;
      --status-marginal-bg: rgba(181, 159, 59, 0.1);
      --status-low: #C2763E;
      --status-low-bg: rgba(194, 118, 62, 0.1);
      --status-critical: #C2453D;
      --status-critical-bg: rgba(194, 69, 61, 0.15);

      /* Weather */
      --rain-color: #5B8FA8;
      --rain-bg: rgba(91, 143, 168, 0.1);

      /* Shadows */
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
      --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.06);

      /* Typography scale */
      --text-xs: 0.875rem;
      --text-sm: 1rem;
      --text-base: 1.125rem;
      --text-lg: 1.375rem;
      --text-xl: 1.75rem;
      --text-2xl: 2.25rem;
      --text-3xl: 3rem;

      /* Spacing */
      --space-xs: 0.5rem;
      --space-sm: 0.75rem;
      --space-md: 1rem;
      --space-lg: 1.5rem;
      --space-xl: 2rem;
      --space-2xl: 3rem;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-primary: #1C1917;
        --bg-secondary: #292524;
        --bg-tertiary: #1C1917;
        --text-primary: #FAFAF9;
        --text-secondary: #D6D3D1;
        --text-tertiary: #78716C;
        --border-color: #44403C;
        --border-subtle: #292524;

        --accent: #6B9B7A;
        --accent-light: #7FB08E;
        --accent-bg: rgba(107, 155, 122, 0.12);

        --status-healthy: #6B9B7A;
        --status-healthy-bg: rgba(107, 155, 122, 0.15);
        --status-marginal: #D4B94A;
        --status-marginal-bg: rgba(212, 185, 74, 0.15);
        --status-low: #E08A4A;
        --status-low-bg: rgba(224, 138, 74, 0.15);
        --status-critical: #E05A52;
        --status-critical-bg: rgba(224, 90, 82, 0.2);

        --rain-color: #7BAFC6;
        --rain-bg: rgba(123, 175, 198, 0.15);

        --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
        --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
    }

    /* ============================================
       RESET & BASE
       ============================================ */
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      font-size: 16px;
    }

    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.5;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    /* ============================================
       LAYOUT
       ============================================ */
    .app {
      max-width: 1100px;
      margin: 0 auto;
      padding: var(--space-lg);
    }

    /* ============================================
       NAVIGATION TABS
       ============================================ */
    .nav {
      display: flex;
      gap: var(--space-xs);
      border-bottom: 1px solid var(--border-color);
      margin-bottom: var(--space-xl);
    }

    .nav-tab {
      padding: var(--space-md) var(--space-lg);
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-tertiary);
      text-decoration: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: color 0.15s, border-color 0.15s;
      cursor: pointer;
    }

    .nav-tab:hover {
      color: var(--text-secondary);
    }

    .nav-tab.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }

    /* ============================================
       HEADER
       ============================================ */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: var(--space-2xl);
    }

    .brand {
      font-family: 'Fraunces', Georgia, serif;
      font-size: var(--text-xl);
      font-weight: 500;
      color: var(--text-primary);
      letter-spacing: -0.01em;
    }

    .date {
      font-size: var(--text-sm);
      color: var(--text-tertiary);
    }

    /* ============================================
       HERD STATUS - Priority #1
       ============================================ */
    .herd-status {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: var(--space-xl);
      margin-bottom: var(--space-xl);
    }

    .herd-status-label {
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: var(--space-sm);
    }

    .herd-status-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: var(--space-lg);
    }

    .herd-location {
      flex: 1;
    }

    .herd-paddock-name {
      font-family: 'Fraunces', Georgia, serif;
      font-size: var(--text-3xl);
      font-weight: 500;
      color: var(--text-primary);
      line-height: 1.1;
      margin-bottom: var(--space-xs);
    }

    .herd-meta {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      flex-wrap: wrap;
    }

    .herd-days {
      font-size: var(--text-base);
      color: var(--text-secondary);
    }

    .herd-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 100px;
      font-size: var(--text-xs);
      font-weight: 600;
    }

    .herd-status-badge.healthy {
      background: var(--status-healthy-bg);
      color: var(--status-healthy);
    }

    .herd-status-badge.marginal {
      background: var(--status-marginal-bg);
      color: var(--status-marginal);
    }

    .herd-status-badge.low {
      background: var(--status-low-bg);
      color: var(--status-low);
    }

    .herd-status-badge.critical {
      background: var(--status-critical-bg);
      color: var(--status-critical);
    }

    .herd-status-badge::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }

    .herd-count {
      text-align: right;
    }

    .herd-count-number {
      font-family: 'Fraunces', Georgia, serif;
      font-size: var(--text-2xl);
      font-weight: 500;
      color: var(--text-primary);
      line-height: 1;
    }

    .herd-count-label {
      font-size: var(--text-sm);
      color: var(--text-tertiary);
      margin-top: 4px;
    }

    /* ============================================
       ALERT BANNER (only shows when critical)
       ============================================ */
    .alert-banner {
      display: none;
      background: var(--status-critical-bg);
      border: 1px solid var(--status-critical);
      border-radius: 8px;
      padding: var(--space-md) var(--space-lg);
      margin-bottom: var(--space-xl);
    }

    .alert-banner.visible {
      display: block;
    }

    .alert-banner-content {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      font-size: var(--text-base);
      font-weight: 500;
      color: var(--status-critical);
    }

    /* ============================================
       WEATHER SECTION
       ============================================ */
    .weather {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: var(--space-xl);
      margin-bottom: var(--space-xl);
    }

    .weather-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-lg);
    }

    .weather-title {
      font-family: 'Fraunces', Georgia, serif;
      font-size: var(--text-lg);
      font-weight: 500;
      color: var(--text-primary);
    }

    .weather-outlook {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    .weather-outlook-label {
      font-size: var(--text-sm);
      color: var(--text-tertiary);
    }

    .weather-outlook-value {
      font-size: var(--text-sm);
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 100px;
    }

    .weather-outlook-value.wet {
      background: var(--rain-bg);
      color: var(--rain-color);
    }

    .weather-outlook-value.fair {
      background: var(--status-healthy-bg);
      color: var(--status-healthy);
    }

    .weather-outlook-value.dry {
      background: var(--status-marginal-bg);
      color: var(--status-marginal);
    }

    .weather-outlook-value.drought {
      background: var(--status-critical-bg);
      color: var(--status-critical);
    }

    .weather-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: var(--space-sm);
    }

    @media (max-width: 700px) {
      .weather-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }

    .weather-day {
      text-align: center;
      padding: var(--space-md);
      border-radius: 8px;
      background: var(--bg-tertiary);
      transition: background 0.15s;
    }

    .weather-day.has-rain {
      background: var(--rain-bg);
    }

    .weather-day-date {
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: var(--space-xs);
    }

    .weather-day-rain {
      font-size: var(--text-base);
      font-weight: 600;
      color: var(--rain-color);
      margin-bottom: 2px;
    }

    .weather-day-temp {
      font-size: var(--text-xs);
      color: var(--text-tertiary);
    }

    /* ============================================
       PADDOCK LIST
       ============================================ */
    .paddocks {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: var(--space-xl);
    }

    .paddocks-header {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
      gap: var(--space-md);
      padding: var(--space-md) var(--space-lg);
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    @media (max-width: 700px) {
      .paddocks-header {
        display: none;
      }
    }

    .paddock-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
      gap: var(--space-md);
      padding: var(--space-lg);
      border-bottom: 1px solid var(--border-subtle);
      align-items: center;
      transition: background 0.15s;
    }

    .paddock-row:last-child {
      border-bottom: none;
    }

    .paddock-row:hover {
      background: var(--bg-tertiary);
    }

    .paddock-row.current {
      background: var(--accent-bg);
    }

    .paddock-row.critical {
      background: var(--status-critical-bg);
    }

    @media (max-width: 700px) {
      .paddock-row {
        grid-template-columns: 1fr 1fr;
        grid-template-rows: auto auto;
        gap: var(--space-sm);
      }
    }

    .paddock-name-cell {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    .paddock-name {
      font-family: 'Fraunces', Georgia, serif;
      font-size: var(--text-base);
      font-weight: 500;
      color: var(--text-primary);
    }

    .paddock-current-badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 100px;
      background: var(--accent);
      color: white;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .paddock-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--text-sm);
      font-weight: 500;
    }

    .paddock-status::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .paddock-status.healthy { color: var(--status-healthy); }
    .paddock-status.healthy::before { background: var(--status-healthy); }
    .paddock-status.marginal { color: var(--status-marginal); }
    .paddock-status.marginal::before { background: var(--status-marginal); }
    .paddock-status.low { color: var(--status-low); }
    .paddock-status.low::before { background: var(--status-low); }
    .paddock-status.critical { color: var(--status-critical); font-weight: 700; }
    .paddock-status.critical::before { background: var(--status-critical); }

    .paddock-forage,
    .paddock-health,
    .paddock-days {
      font-size: var(--text-sm);
      color: var(--text-secondary);
    }

    .paddock-forage strong,
    .paddock-health strong,
    .paddock-days strong {
      font-weight: 600;
      color: var(--text-primary);
    }

    @media (max-width: 700px) {
      .paddock-name-cell { grid-column: 1 / -1; }
      .paddock-forage::before { content: 'Forage: '; color: var(--text-tertiary); }
      .paddock-health::before { content: 'Health: '; color: var(--text-tertiary); }
      .paddock-days::before { content: 'Days: '; color: var(--text-tertiary); }
    }

    /* ============================================
       PAGE CONTENT (for tabs)
       ============================================ */
    .page {
      display: none;
    }

    .page.active {
      display: block;
    }

    /* ============================================
       PLANNING PAGE
       ============================================ */
    .planning-section {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: var(--space-xl);
      margin-bottom: var(--space-xl);
    }

    .planning-title {
      font-family: 'Fraunces', Georgia, serif;
      font-size: var(--text-lg);
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: var(--space-lg);
    }

    .controls-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: var(--space-xl);
      margin-bottom: var(--space-xl);
    }

    .control-group label {
      display: block;
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: var(--space-sm);
    }

    .control-row {
      display: flex;
      align-items: center;
      gap: var(--space-md);
    }

    .control-group input[type="range"] {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: var(--border-color);
      outline: none;
      -webkit-appearance: none;
    }

    .control-group input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--accent);
      cursor: pointer;
      box-shadow: var(--shadow-md);
    }

    .control-group input[type="range"]::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--accent);
      cursor: pointer;
      box-shadow: var(--shadow-md);
      border: none;
    }

    .control-value {
      font-size: var(--text-lg);
      font-weight: 600;
      color: var(--accent);
      min-width: 60px;
      text-align: right;
    }

    .run-button {
      background: var(--accent);
      color: white;
      border: none;
      padding: var(--space-md) var(--space-xl);
      border-radius: 8px;
      font-family: 'DM Sans', sans-serif;
      font-size: var(--text-sm);
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
    }

    .run-button:hover {
      background: var(--accent-light);
    }

    .run-button:active {
      transform: scale(0.98);
    }

    .run-button.loading {
      opacity: 0.7;
      cursor: wait;
    }

    /* Chart container for Planning page */
    .chart-container {
      height: 350px;
      margin-top: var(--space-xl);
    }

    /* ============================================
       HISTORY PAGE
       ============================================ */
    .history-list {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow: hidden;
    }

    .history-item {
      display: grid;
      grid-template-columns: 100px 1fr auto auto;
      gap: var(--space-md);
      padding: var(--space-lg);
      border-bottom: 1px solid var(--border-subtle);
      align-items: center;
    }

    .history-item:last-child {
      border-bottom: none;
    }

    .history-item.current {
      background: var(--accent-bg);
    }

    .history-date {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-secondary);
    }

    .history-paddock {
      font-family: 'Fraunces', Georgia, serif;
      font-size: var(--text-base);
      font-weight: 500;
      color: var(--text-primary);
    }

    .history-days {
      font-size: var(--text-sm);
      color: var(--text-tertiary);
    }

    .history-hay-badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 100px;
      background: var(--status-low-bg);
      color: var(--status-low);
      text-transform: uppercase;
    }

    /* ============================================
       TRENDS PAGE (Chart)
       ============================================ */
    .trends-section {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: var(--space-xl);
    }

    .trends-title {
      font-family: 'Fraunces', Georgia, serif;
      font-size: var(--text-lg);
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: var(--space-lg);
    }

    .trends-chart {
      height: 400px;
    }

    /* ============================================
       FOOTER
       ============================================ */
    .footer {
      text-align: center;
      padding: var(--space-xl);
      font-size: var(--text-xs);
      color: var(--text-tertiary);
    }

    /* ============================================
       UTILITIES
       ============================================ */
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }
  </style>
</head>
<body>
  <div class="app">
    <!-- HEADER -->
    <header class="header">
      <h1 class="brand">Pyrennial Farms</h1>
      <time class="date" id="currentDate"></time>
    </header>

    <!-- NAVIGATION -->
    <nav class="nav">
      <a class="nav-tab active" data-tab="status">Status</a>
      <a class="nav-tab" data-tab="planning">Planning</a>
      <a class="nav-tab" data-tab="history">History</a>
      <a class="nav-tab" data-tab="trends">Trends</a>
    </nav>

    <!-- STATUS PAGE -->
    <main class="page active" id="page-status">
      <!-- Alert Banner (hidden by default) -->
      <div class="alert-banner" id="alertBanner">
        <div class="alert-banner-content">
          <span id="alertText">Action needed</span>
        </div>
      </div>

      <!-- Herd Status -->
      <section class="herd-status">
        <div class="herd-status-label">Current Location</div>
        <div class="herd-status-content">
          <div class="herd-location">
            <h2 class="herd-paddock-name" id="currentPaddockName">${currentPaddock?.name || '—'}</h2>
            <div class="herd-meta">
              <span class="herd-days" id="herdDays">${daysOnPaddock !== null ? `Day ${daysOnPaddock}` : ''}</span>
              <span class="herd-status-badge healthy" id="herdStatusBadge">Healthy</span>
            </div>
          </div>
          <div class="herd-count">
            <div class="herd-count-number">${model.params.herd_count || 14}</div>
            <div class="herd-count-label">head</div>
          </div>
        </div>
      </section>

      <!-- Weather -->
      <section class="weather">
        <div class="weather-header">
          <h3 class="weather-title">7-Day Forecast</h3>
          <div class="weather-outlook">
            <span class="weather-outlook-label">Outlook</span>
            <span class="weather-outlook-value fair" id="weatherOutlook">—</span>
          </div>
        </div>
        <div class="weather-grid" id="weatherGrid">
          <!-- Populated by JS -->
        </div>
      </section>

      <!-- Paddock List -->
      <section class="paddocks">
        <div class="paddocks-header">
          <span>Paddock</span>
          <span>Status</span>
          <span>Forage</span>
          <span>Health</span>
          <span>Est. Days</span>
        </div>
        <div id="paddockList">
          <!-- Populated by JS -->
        </div>
      </section>
    </main>

    <!-- PLANNING PAGE -->
    <div class="page" id="page-planning">
      <section class="planning-section">
        <h3 class="planning-title">What-If Scenarios</h3>
        <div class="controls-grid">
          <div class="control-group">
            <label>Herd Size</label>
            <div class="control-row">
              <input type="range" id="herdSlider" min="4" max="30" step="1" value="${model.params.herd_count || 14}">
              <span class="control-value" id="herdValue">${model.params.herd_count || 14}</span>
            </div>
          </div>
          <div class="control-group">
            <label>Daily Rainfall (mm)</label>
            <div class="control-row">
              <input type="range" id="rainSlider" min="0" max="15" step="0.5" value="${model.params.base_rain_input || 3}">
              <span class="control-value" id="rainValue">${model.params.base_rain_input || 3}</span>
            </div>
          </div>
          <div class="control-group">
            <label>Rotation Days</label>
            <div class="control-row">
              <input type="range" id="rotationSlider" min="5" max="30" step="1" value="${model.params.rotation_days || 14}">
              <span class="control-value" id="rotationValue">${model.params.rotation_days || 14}</span>
            </div>
          </div>
        </div>
        <button class="run-button" id="runButton">Run Simulation</button>
        <div class="chart-container">
          <canvas id="planningChart"></canvas>
        </div>
      </section>
    </div>

    <!-- HISTORY PAGE -->
    <div class="page" id="page-history">
      <div class="history-list" id="historyList">
        <!-- Populated by JS -->
      </div>
    </div>

    <!-- TRENDS PAGE -->
    <div class="page" id="page-trends">
      <section class="trends-section">
        <h3 class="trends-title">Forage Trends</h3>
        <div class="trends-chart">
          <canvas id="trendsChart"></canvas>
        </div>
      </section>
    </div>

    <footer class="footer">
      Collinsville, TX
    </footer>
  </div>

  <script>
    // ============================================
    // STATE
    // ============================================
    let planningChart = null;
    let trendsChart = null;
    const modelData = ${JSON.stringify(model)};
    let currentResults = ${JSON.stringify(results)};
    const rotationHistory = ${JSON.stringify(rotationHistory)};

    const CONFIG = {
      paddocks: ${JSON.stringify(PADDOCK_KEYS)},
      paddockNames: ${JSON.stringify(getPaddockNamesMap())},
      paddockColors: ${JSON.stringify(PADDOCK_COLORS)},
      forageThresholds: ${JSON.stringify(FORAGE_THRESHOLDS)},
      herdDefaults: ${JSON.stringify(HERD_DEFAULTS)},
    };

    // ============================================
    // INITIALIZATION
    // ============================================
    document.addEventListener('DOMContentLoaded', () => {
      updateDate();
      loadWeatherForecast();
      updatePaddockList(currentResults);
      updateHerdStatus(currentResults);
      renderHistory();
      setupSliders();
      setupTabs();
    });

    function updateDate() {
      const now = new Date();
      const options = { weekday: 'long', month: 'long', day: 'numeric' };
      document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);
    }

    // ============================================
    // TABS
    // ============================================
    function setupTabs() {
      const tabs = document.querySelectorAll('.nav-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          // Update active tab
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');

          // Show corresponding page
          const targetId = 'page-' + tab.dataset.tab;
          document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
          document.getElementById(targetId).classList.add('active');

          // Initialize charts when switching to those tabs
          if (tab.dataset.tab === 'trends' && !trendsChart) {
            createTrendsChart(currentResults);
          }
          if (tab.dataset.tab === 'planning' && !planningChart) {
            createPlanningChart(currentResults);
          }
        });
      });
    }

    // ============================================
    // WEATHER
    // ============================================
    async function loadWeatherForecast() {
      try {
        const response = await fetch('/weather');
        const forecast = await response.json();

        const totalRain = forecast.slice(0, 7).reduce((sum, d) => sum + d.rain_mm, 0);
        const totalET = forecast.slice(0, 7).reduce((sum, d) => sum + d.et_mm, 0);
        const balance = totalRain - totalET;

        // Update outlook
        const outlookEl = document.getElementById('weatherOutlook');
        if (balance > 15) {
          outlookEl.textContent = 'Wet';
          outlookEl.className = 'weather-outlook-value wet';
        } else if (balance > 0) {
          outlookEl.textContent = 'Fair';
          outlookEl.className = 'weather-outlook-value fair';
        } else if (balance > -15) {
          outlookEl.textContent = 'Dry';
          outlookEl.className = 'weather-outlook-value dry';
        } else {
          outlookEl.textContent = 'Drought';
          outlookEl.className = 'weather-outlook-value drought';
        }

        // Render 7-day grid
        const grid = document.getElementById('weatherGrid');
        grid.innerHTML = forecast.slice(0, 7).map(day => {
          const date = new Date(day.date);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
          const hasRain = day.rain_mm >= 1;
          return \`
            <div class="weather-day \${hasRain ? 'has-rain' : ''}">
              <div class="weather-day-date">\${dayName}</div>
              <div class="weather-day-rain">\${day.rain_mm >= 1 ? Math.round(day.rain_mm) + 'mm' : '—'}</div>
              <div class="weather-day-temp">\${Math.round(day.temp_min_f)}° / \${Math.round(day.temp_max_f)}°</div>
            </div>
          \`;
        }).join('');

      } catch (error) {
        console.error('Weather fetch failed:', error);
      }
    }

    // ============================================
    // FORAGE HELPER (combines dormant + active)
    // ============================================
    function getTotalForage(results, paddockId) {
      const dormant = results.stocks[\`\${paddockId}_dormant\`];
      const active = results.stocks[\`\${paddockId}_active\`];
      if (!dormant || !active) return null;
      return dormant.map((d, i) => d + active[i]);
    }

    // ============================================
    // HERD STATUS
    // ============================================
    function updateHerdStatus(results) {
      const currentPaddockId = rotationHistory?.currentPaddock?.id;
      if (!currentPaddockId) return;

      const forageData = getTotalForage(results, currentPaddockId);
      if (!forageData) return;

      const currentForage = forageData[forageData.length - 1];
      const statusInfo = getStatusInfo(currentForage);

      const badge = document.getElementById('herdStatusBadge');
      badge.textContent = statusInfo.label;
      badge.className = 'herd-status-badge ' + statusInfo.class;

      // Show alert if critical
      const alertBanner = document.getElementById('alertBanner');
      const alertText = document.getElementById('alertText');

      const criticalPaddocks = getCriticalPaddocks(results);
      if (criticalPaddocks.length > 0) {
        alertText.textContent = \`Hay needed: \${criticalPaddocks.map(p => p.name).join(', ')}\`;
        alertBanner.classList.add('visible');
      } else {
        alertBanner.classList.remove('visible');
      }
    }

    function getCriticalPaddocks(results) {
      return CONFIG.paddocks
        .filter(id => getTotalForage(results, id))
        .map(id => {
          const forage = getTotalForage(results, id);
          return { id, name: CONFIG.paddockNames[id], forage: forage[forage.length - 1] };
        })
        .filter(p => p.forage < CONFIG.forageThresholds.critical);
    }

    // ============================================
    // PADDOCK LIST
    // ============================================
    function getStatusInfo(forage) {
      const t = CONFIG.forageThresholds;
      if (forage < t.critical) return { class: 'critical', label: 'Hay Needed' };
      if (forage < t.low) return { class: 'low', label: 'Low' };
      if (forage < t.marginal) return { class: 'marginal', label: 'Marginal' };
      return { class: 'healthy', label: 'Healthy' };
    }

    function estimateDaysRemaining(forage, dailyConsumption) {
      const t = CONFIG.forageThresholds;
      const usableForage = Math.max(0, forage - t.critical);
      if (dailyConsumption <= 0) return '—';
      const days = Math.floor(usableForage / dailyConsumption);
      return days > 100 ? '100+' : days.toString();
    }

    function updatePaddockList(results) {
      const container = document.getElementById('paddockList');
      const currentPaddockId = rotationHistory?.currentPaddock?.id;

      // Calculate daily consumption per acre
      const herdCount = modelData.params.herd_count || 14;
      const avgWeight = CONFIG.herdDefaults.averageWeight;
      const dailyIntake = herdCount * avgWeight * 0.025; // 2.5% of body weight
      const totalAcres = 38; // approximate
      const dailyConsumptionPerAcre = dailyIntake / (totalAcres / 5); // rough per-paddock

      container.innerHTML = CONFIG.paddocks
        .filter(id => getTotalForage(results, id))
        .map(id => {
          const forageData = getTotalForage(results, id);
          const current = forageData[forageData.length - 1];
          const healthPct = Math.min(100, Math.round((current / CONFIG.forageThresholds.healthy) * 100));
          const statusInfo = getStatusInfo(current);
          const isCurrent = id === currentPaddockId;
          const daysRemaining = estimateDaysRemaining(current, dailyConsumptionPerAcre);

          return \`
            <div class="paddock-row \${isCurrent ? 'current' : ''} \${statusInfo.class === 'critical' ? 'critical' : ''}">
              <div class="paddock-name-cell">
                <span class="paddock-name">\${CONFIG.paddockNames[id]}</span>
                \${isCurrent ? '<span class="paddock-current-badge">Herd</span>' : ''}
              </div>
              <span class="paddock-status \${statusInfo.class}">\${statusInfo.label}</span>
              <span class="paddock-forage"><strong>\${Math.round(current)}</strong> kg/ac</span>
              <span class="paddock-health"><strong>\${healthPct}%</strong></span>
              <span class="paddock-days"><strong>\${daysRemaining}</strong> days</span>
            </div>
          \`;
        }).join('');
    }

    // ============================================
    // HISTORY
    // ============================================
    function renderHistory() {
      if (!rotationHistory?.rotations) return;

      const container = document.getElementById('historyList');
      const rotations = [...rotationHistory.rotations].reverse();

      container.innerHTML = rotations.map(r => {
        const startDate = new Date(r.start);
        const dateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const isCurrent = r.end === null;
        const days = isCurrent
          ? Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          : r.days;

        return \`
          <div class="history-item \${isCurrent ? 'current' : ''}">
            <span class="history-date">\${dateStr}</span>
            <span class="history-paddock">\${r.name}</span>
            <span class="history-days">\${days} days</span>
            \${r.hayFed ? '<span class="history-hay-badge">Hay Fed</span>' : ''}
          </div>
        \`;
      }).join('');
    }

    // ============================================
    // CHARTS
    // ============================================
    function getChartConfig(results) {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
      const textColor = isDark ? '#D6D3D1' : '#57534E';

      return {
        type: 'line',
        data: {
          labels: results.time,
          datasets: CONFIG.paddocks
            .filter(id => getTotalForage(results, id))
            .map(id => ({
              label: CONFIG.paddockNames[id],
              data: getTotalForage(results, id),
              borderColor: CONFIG.paddockColors[id],
              backgroundColor: CONFIG.paddockColors[id] + '20',
              borderWidth: 2,
              tension: 0.3,
              fill: false,
              pointRadius: 0,
              pointHoverRadius: 4
            }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                font: { family: "'DM Sans', sans-serif", size: 13 },
                padding: 20,
                usePointStyle: true
              }
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: isDark ? '#292524' : '#FFFFFF',
              titleColor: isDark ? '#FAFAF9' : '#1C1917',
              bodyColor: isDark ? '#D6D3D1' : '#57534E',
              borderColor: isDark ? '#44403C' : '#E7E5E4',
              borderWidth: 1,
              padding: 12,
              cornerRadius: 8
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Forage (kg/acre)',
                font: { family: "'DM Sans', sans-serif", size: 12 },
                color: textColor
              },
              grid: { color: gridColor },
              ticks: { color: textColor }
            },
            x: {
              title: {
                display: true,
                text: 'Days',
                font: { family: "'DM Sans', sans-serif", size: 12 },
                color: textColor
              },
              grid: { color: gridColor },
              ticks: { color: textColor }
            }
          }
        }
      };
    }

    function createTrendsChart(results) {
      const ctx = document.getElementById('trendsChart').getContext('2d');
      if (trendsChart) trendsChart.destroy();
      trendsChart = new Chart(ctx, getChartConfig(results));
    }

    function createPlanningChart(results) {
      const ctx = document.getElementById('planningChart').getContext('2d');
      if (planningChart) planningChart.destroy();
      planningChart = new Chart(ctx, getChartConfig(results));
    }

    // ============================================
    // SLIDERS & SIMULATION
    // ============================================
    function setupSliders() {
      const sliders = [
        { id: 'herdSlider', valueId: 'herdValue' },
        { id: 'rainSlider', valueId: 'rainValue' },
        { id: 'rotationSlider', valueId: 'rotationValue' }
      ];

      sliders.forEach(({ id, valueId }) => {
        const slider = document.getElementById(id);
        const value = document.getElementById(valueId);
        slider.addEventListener('input', () => {
          value.textContent = slider.value;
        });
      });

      document.getElementById('runButton').addEventListener('click', runSimulation);
    }

    async function runSimulation() {
      const button = document.getElementById('runButton');
      button.textContent = 'Running...';
      button.classList.add('loading');

      const herd = parseInt(document.getElementById('herdSlider').value);
      const rain = parseFloat(document.getElementById('rainSlider').value);
      const rotation = parseInt(document.getElementById('rotationSlider').value);

      modelData.params.herd_count = herd;
      modelData.params.total_herd_weight = herd * CONFIG.herdDefaults.averageWeight;
      modelData.params.base_rain_input = rain;
      modelData.params.rotation_days = rotation;

      try {
        const response = await fetch('/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelData, steps: ${steps}, dt: ${dt} })
        });

        currentResults = await response.json();

        // Update all views
        updatePaddockList(currentResults);
        updateHerdStatus(currentResults);
        if (planningChart) createPlanningChart(currentResults);
        if (trendsChart) createTrendsChart(currentResults);

        button.textContent = 'Run Simulation';
        button.classList.remove('loading');

      } catch (error) {
        console.error('Simulation failed:', error);
        button.textContent = 'Error';
        button.classList.remove('loading');
        setTimeout(() => {
          button.textContent = 'Run Simulation';
        }, 2000);
      }
    }

    // Listen for theme changes and update charts
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (trendsChart) createTrendsChart(currentResults);
      if (planningChart) createPlanningChart(currentResults);
    });
  </script>
</body>
</html>`;
}
