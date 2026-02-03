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
  const { steps = 100, dt = 1, rotationHistory = null, historicalResults = null } = options;

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

    .weather-day-icon {
      font-size: var(--text-xl);
      margin-bottom: var(--space-xs);
      line-height: 1;
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

    /* Rotation Schedule */
    .rotation-schedule {
      margin-top: var(--space-xl);
      padding: var(--space-lg);
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
    }

    .schedule-title {
      font-family: 'Fraunces', Georgia, serif;
      font-size: var(--text-lg);
      font-weight: 500;
      margin: 0 0 var(--space-sm) 0;
      color: var(--text-primary);
    }

    .schedule-description {
      font-size: var(--text-sm);
      color: var(--text-tertiary);
      margin: 0 0 var(--space-md) 0;
    }

    .schedule-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .schedule-item {
      display: grid;
      grid-template-columns: 100px 1fr auto;
      gap: var(--space-md);
      padding: var(--space-md);
      background: var(--bg-primary);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      align-items: center;
    }

    .schedule-item.current {
      border-left: 3px solid var(--accent-color);
      background: var(--accent-bg);
    }

    .schedule-date {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-secondary);
    }

    .schedule-paddock {
      font-family: 'Fraunces', Georgia, serif;
      font-size: var(--text-base);
      font-weight: 500;
      color: var(--text-primary);
    }

    .schedule-reason {
      font-size: var(--text-sm);
      color: var(--text-tertiary);
      text-align: right;
    }

    .schedule-note {
      margin-top: var(--space-md);
      font-size: var(--text-sm);
      color: var(--text-tertiary);
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
       LEARN PAGE
       ============================================ */
    .learn-container {
      max-width: 800px;
      margin: 0 auto;
    }

    .learn-section {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: var(--space-xl);
      margin-bottom: var(--space-lg);
    }

    .learn-title {
      font-family: 'Fraunces', Georgia, serif;
      font-size: var(--text-xl);
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: var(--space-md);
    }

    .learn-text {
      font-size: var(--text-base);
      color: var(--text-secondary);
      line-height: 1.7;
    }

    .learn-text p {
      margin-bottom: var(--space-sm);
    }

    .learn-callout {
      background: var(--accent-bg);
      border-left: 4px solid var(--accent);
      padding: var(--space-md) var(--space-lg);
      margin-top: var(--space-md);
      border-radius: 0 8px 8px 0;
      font-size: var(--text-base);
      color: var(--text-primary);
    }

    .learn-formula {
      font-family: 'DM Sans', monospace;
      background: var(--bg-tertiary);
      padding: var(--space-sm) var(--space-md);
      border-radius: 6px;
      margin: var(--space-sm) 0;
    }

    .learn-grid {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
      margin-top: var(--space-md);
    }

    .learn-card {
      padding: var(--space-md);
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }

    .learn-card.healthy {
      background: var(--status-healthy-bg);
      border-color: var(--status-healthy);
    }

    .learn-card.marginal {
      background: var(--status-marginal-bg);
      border-color: var(--status-marginal);
    }

    .learn-card.low {
      background: var(--status-low-bg);
      border-color: var(--status-low);
    }

    .learn-card.critical {
      background: var(--status-critical-bg);
      border-color: var(--status-critical);
    }

    .learn-card-header {
      font-weight: 600;
      font-size: var(--text-sm);
      margin-bottom: var(--space-xs);
      color: var(--text-primary);
    }

    .learn-card-body {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .learn-definitions {
      font-size: var(--text-base);
    }

    .learn-definitions dt {
      font-weight: 600;
      color: var(--text-primary);
      margin-top: var(--space-md);
    }

    .learn-definitions dt:first-child {
      margin-top: 0;
    }

    .learn-definitions dd {
      color: var(--text-secondary);
      margin-left: 0;
      padding-left: var(--space-md);
      border-left: 2px solid var(--border-color);
      margin-top: var(--space-xs);
      line-height: 1.6;
    }

    .learn-list {
      padding-left: var(--space-lg);
      color: var(--text-secondary);
    }

    .learn-list li {
      margin-bottom: var(--space-sm);
      line-height: 1.6;
    }

    .learn-grid-paddocks {
      display: grid;
      gap: var(--space-sm);
      margin-top: var(--space-md);
    }

    .learn-paddock {
      background: var(--bg-tertiary);
      padding: var(--space-md);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .learn-paddock-name {
      font-weight: 600;
      color: var(--text-primary);
    }

    .learn-paddock-desc {
      font-size: var(--text-sm);
      color: var(--text-tertiary);
    }

    .learn-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: var(--space-md);
      font-size: var(--text-sm);
    }

    .learn-table th,
    .learn-table td {
      text-align: left;
      padding: var(--space-sm) var(--space-md);
      border-bottom: 1px solid var(--border-color);
    }

    .learn-table th {
      font-weight: 600;
      color: var(--text-primary);
      background: var(--bg-tertiary);
    }

    .learn-table td {
      color: var(--text-secondary);
    }

    .learn-table tr:last-child td {
      border-bottom: none;
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
      <a class="nav-tab" data-tab="learn">Learn</a>
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

        <!-- Rotation Schedule -->
        <div class="rotation-schedule" id="rotationSchedule">
          <h4 class="schedule-title">📅 Suggested Rotation Schedule</h4>
          <p class="schedule-description">Based on current forage levels and seasonal growth projections:</p>
          <div class="schedule-list" id="scheduleList">
            <!-- Populated by JS -->
          </div>
          <p class="schedule-note">
            <em>Note: This schedule assumes no hay supplementation. Actual rotation timing depends on weather, herd behavior, and visual pasture assessment.</em>
          </p>
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

    <!-- LEARN PAGE -->
    <div class="page" id="page-learn">
      <div class="learn-container">

        <section class="learn-section">
          <h2 class="learn-title">What Is Adaptive Grazing?</h2>
          <p class="learn-text">
            <strong>Adaptive grazing</strong> means moving cattle between paddocks based on what the grass needs, not a fixed schedule.
            The goal: let each paddock <em>rest and recover</em> before grazing it again.
          </p>
          <div class="learn-callout">
            <strong>The Simple Rule:</strong> Move the herd when forage gets low. Let paddocks rest until they're healthy again.
          </div>
        </section>

        <section class="learn-section">
          <h2 class="learn-title">Understanding the Status Colors</h2>
          <div class="learn-grid">
            <div class="learn-card healthy">
              <div class="learn-card-header">Healthy (2,000+ kg/acre)</div>
              <div class="learn-card-body">
                Plenty of grass. Safe to graze. This paddock can support the herd without damage.
              </div>
            </div>
            <div class="learn-card marginal">
              <div class="learn-card-header">Marginal (1,500–2,000)</div>
              <div class="learn-card-body">
                Getting low. Graze for short periods only, or skip this rotation to let it recover.
              </div>
            </div>
            <div class="learn-card low">
              <div class="learn-card-header">Low (1,000–1,500)</div>
              <div class="learn-card-body">
                Needs rest. Only graze if no other options, and move the herd quickly.
              </div>
            </div>
            <div class="learn-card critical">
              <div class="learn-card-header">Critical (below 1,000)</div>
              <div class="learn-card-body">
                <strong>Hay needed</strong> if grazing here. The grass can't support the herd alone. Risk of overgrazing damage.
              </div>
            </div>
          </div>
        </section>

        <section class="learn-section">
          <h2 class="learn-title">Key Terms</h2>
          <dl class="learn-definitions">
            <dt>Forage</dt>
            <dd>The grass and plants cattle eat. Measured in kilograms per acre (kg/acre). Higher = more grass available.</dd>

            <dt>Dormant Forage</dt>
            <dd>Brown/dead grass that's still standing. Cattle will eat it, but it's less nutritious and doesn't grow back until spring.</dd>

            <dt>Active Forage</dt>
            <dd>Green, growing grass. This is the good stuff. Cattle prefer it, and it regrows when conditions are right.</dd>

            <dt>Rotation</dt>
            <dd>Moving the herd from one paddock to another. Gives the old paddock time to rest.</dd>

            <dt>Recovery Period</dt>
            <dd>How long a paddock rests between grazings. Longer rest = more regrowth. Winter needs longer rest than summer.</dd>

            <dt>Stocking Rate</dt>
            <dd>How many cattle per acre. Too many cattle on too few acres = overgrazing.</dd>

            <dt>Evapotranspiration (ET)</dt>
            <dd>Water lost to evaporation and plant breathing. Hot, dry, windy days have high ET. Affects how fast soil dries out.</dd>
          </dl>
        </section>

        <section class="learn-section">
          <h2 class="learn-title">How the Numbers Work</h2>
          <div class="learn-text">
            <p><strong>Daily Consumption:</strong></p>
            <p class="learn-formula">
              14 cattle × 557 kg average × 2.5% body weight = <strong>195 kg/day</strong> eaten by the herd
            </p>
            <p>Divide by paddock acres to get consumption per acre. A 5-acre paddock: 195 ÷ 5 = <strong>39 kg/acre/day</strong></p>

            <p style="margin-top: var(--space-lg);"><strong>Trampling Loss:</strong></p>
            <p>Cattle don't just eat—they step on grass too. About <strong>30%</strong> of what they impact gets trampled, not eaten.</p>

            <p style="margin-top: var(--space-lg);"><strong>Regrowth:</strong></p>
            <p>In peak summer: up to <strong>80 kg/acre/day</strong> can grow back.</p>
            <p>In winter (now): only about <strong>8 kg/acre/day</strong> (10% of summer). That's why rest periods need to be longer in winter.</p>
          </div>
        </section>

        <section class="learn-section">
          <h2 class="learn-title">How Recommendations Are Made</h2>
          <div class="learn-text">
            <p>The dashboard looks at:</p>
            <ol class="learn-list">
              <li><strong>Current forage levels</strong> — Which paddocks have enough grass?</li>
              <li><strong>Weather forecast</strong> — Is rain coming? Will it be dry?</li>
              <li><strong>Days since grazed</strong> — Has this paddock had enough rest?</li>
              <li><strong>Moisture levels</strong> — Wet soil grows grass faster.</li>
            </ol>
            <p style="margin-top: var(--space-md);">
              Then it suggests the paddock with the <em>best combination</em> of high forage and good recovery time.
            </p>
          </div>
          <div class="learn-callout">
            <strong>Remember:</strong> These are suggestions, not orders. You know your land better than any computer.
            Use this as a starting point, then trust your eyes and experience.
          </div>
        </section>

        <section class="learn-section">
          <h2 class="learn-title">Your Paddocks at a Glance</h2>
          <div class="learn-grid-paddocks">
            <div class="learn-paddock">
              <div class="learn-paddock-name">Cedar Crest East</div>
              <div class="learn-paddock-desc">8 acres • Hilltop, open exposure • Dries out fastest in drought</div>
            </div>
            <div class="learn-paddock">
              <div class="learn-paddock-name">Cedar Crest West</div>
              <div class="learn-paddock-desc">8 acres • Silvopasture with trees • Shade retains moisture</div>
            </div>
            <div class="learn-paddock">
              <div class="learn-paddock-name">Big Pasture</div>
              <div class="learn-paddock-desc">9 acres • Flood plain, wooded • Good moisture from low ground</div>
            </div>
            <div class="learn-paddock">
              <div class="learn-paddock-name">Hog Pasture</div>
              <div class="learn-paddock-desc">5 acres • Creek access • Wettest paddock, smallest acreage</div>
            </div>
            <div class="learn-paddock">
              <div class="learn-paddock-name">Frankie's Pasture</div>
              <div class="learn-paddock-desc">8 acres • Creek runoff area • Recently seeded, recovering</div>
            </div>
          </div>
        </section>

        <section class="learn-section">
          <h2 class="learn-title">Quick Reference: When to Act</h2>
          <table class="learn-table">
            <thead>
              <tr>
                <th>Situation</th>
                <th>What To Do</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Current paddock drops below 1,000</td>
                <td>Start planning the move. Feed hay if staying longer.</td>
              </tr>
              <tr>
                <td>Current paddock drops below 500</td>
                <td>Move immediately or feed hay daily. Grass is critically low.</td>
              </tr>
              <tr>
                <td>All paddocks are low</td>
                <td>Feed hay across the board. Consider reducing herd size.</td>
              </tr>
              <tr>
                <td>Rain is coming</td>
                <td>Good news! Growth will pick up. Low paddocks will recover faster.</td>
              </tr>
              <tr>
                <td>Drought conditions</td>
                <td>Extend hay feeding. Shorten grazing periods. Prioritize creek-adjacent paddocks.</td>
              </tr>
            </tbody>
          </table>
        </section>

      </div>
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
    let currentResults = ${JSON.stringify(results)};  // Forward projection
    const historicalResults = ${JSON.stringify(historicalResults)};  // Historical reconstruction
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
      updateRotationSchedule(currentResults, modelData.params.rotation_days || 14);
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
            createTrendsChart();
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
        // Threshold: 0.05" is minimum meaningful rain (Apple Weather standard)
        const RAIN_THRESHOLD = 0.05;
        const grid = document.getElementById('weatherGrid');
        grid.innerHTML = forecast.slice(0, 7).map(day => {
          const date = new Date(day.date);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
          const rainInches = day.rain_mm * 0.0394;
          const hasRain = rainInches >= RAIN_THRESHOLD;

          // Display: show "0in" for trace amounts, real value otherwise
          const rainDisplay = hasRain
            ? rainInches.toFixed(1) + 'in'
            : '0in';

          // Weather emoji - MUST match display (no rain icon for "0in")
          let weatherIcon;
          if (rainInches >= 0.5) {
            weatherIcon = '🌧️';    // Heavy rain (0.5"+)
          } else if (rainInches >= 0.25) {
            weatherIcon = '🌦️';    // Moderate rain
          } else if (hasRain) {
            weatherIcon = '🌦️';    // Light rain (0.05-0.25")
          } else if (day.temp_max_f < 32) {
            weatherIcon = '❄️';    // Freezing
          } else if (day.temp_max_f < 50) {
            weatherIcon = '🌤️';   // Cool
          } else if (day.temp_max_f > 90) {
            weatherIcon = '☀️';    // Hot
          } else if (day.temp_max_f > 70) {
            weatherIcon = '🌤️';   // Warm, nice
          } else {
            weatherIcon = '⛅';    // Mild / partly cloudy
          }

          return \`
            <div class="weather-day \${hasRain ? 'has-rain' : ''}">
              <div class="weather-day-icon">\${weatherIcon}</div>
              <div class="weather-day-date">\${dayName}</div>
              <div class="weather-day-rain">\${rainDisplay}</div>
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
      const statusInfo = getStatusInfo(currentForage, true);  // true = this IS the current paddock

      const badge = document.getElementById('herdStatusBadge');
      badge.textContent = statusInfo.label;
      badge.className = 'herd-status-badge ' + statusInfo.class;

      // Show alert only if CURRENT paddock (where herd is) needs hay
      const alertBanner = document.getElementById('alertBanner');
      const alertText = document.getElementById('alertText');

      if (statusInfo.class === 'critical') {
        const paddockName = rotationHistory?.currentPaddock?.name || 'Current paddock';
        alertText.textContent = \`Hay needed: \${paddockName} is critically low\`;
        alertBanner.classList.add('visible');
      } else {
        alertBanner.classList.remove('visible');
      }
    }

    // ============================================
    // ROTATION SCHEDULE
    // ============================================
    function updateRotationSchedule(results, rotationDays) {
      const container = document.getElementById('scheduleList');
      if (!container) return;

      const today = new Date();
      const currentPaddockId = rotationHistory?.currentPaddock?.id;
      const schedule = [];

      // Calculate daily consumption per acre
      const herdCount = modelData.params.herd_count || 14;
      const avgWeight = CONFIG.herdDefaults.averageWeight;
      const dailyIntake = herdCount * avgWeight * 0.025;

      // Build rotation schedule by simulating forward
      let simulationDay = 0;
      let currentPaddock = currentPaddockId;
      const paddockList = [...CONFIG.paddocks];

      // Track forage at each step (use simulation results)
      const paddockForage = {};
      CONFIG.paddocks.forEach(id => {
        const data = getTotalForage(results, id);
        if (data) {
          paddockForage[id] = [...data];  // Copy the time series
        }
      });

      // Generate schedule for next 4-5 rotations
      for (let rotation = 0; rotation < 5 && simulationDay < results.time.length - 1; rotation++) {
        const moveDate = new Date(today);
        moveDate.setDate(today.getDate() + simulationDay);

        const paddockName = CONFIG.paddockNames[currentPaddock];
        const currentForage = paddockForage[currentPaddock]?.[simulationDay] || 0;

        // Find how many days until forage hits threshold OR max rotation days
        let daysOnPaddock = 0;
        const paddockAcres = modelData.params[\`\${currentPaddock}_acres\`] || 8;
        const dailyConsumptionPerAcre = dailyIntake / paddockAcres;

        for (let d = simulationDay; d < results.time.length && daysOnPaddock < rotationDays; d++) {
          const forage = paddockForage[currentPaddock]?.[d] || 0;
          if (forage < CONFIG.forageThresholds.low) {
            break;  // Need to move - forage too low
          }
          daysOnPaddock++;
        }

        // Ensure at least 1 day
        daysOnPaddock = Math.max(1, daysOnPaddock);

        // Determine reason for move
        const endForage = paddockForage[currentPaddock]?.[simulationDay + daysOnPaddock] || 0;
        const reason = daysOnPaddock >= rotationDays
          ? \`\${rotationDays}-day rotation\`
          : \`Forage low (~\${Math.round(endForage)} kg/ac)\`;

        schedule.push({
          date: moveDate,
          paddock: paddockName,
          paddockId: currentPaddock,
          days: daysOnPaddock,
          reason: reason,
          isCurrent: rotation === 0
        });

        // Move to next day and find next paddock
        simulationDay += daysOnPaddock;

        // Choose next paddock: highest forage among rested paddocks
        let bestPaddock = null;
        let bestForage = -1;
        for (const id of paddockList) {
          if (id === currentPaddock) continue;  // Can't stay on same
          const forage = paddockForage[id]?.[simulationDay] || 0;
          if (forage > bestForage) {
            bestForage = forage;
            bestPaddock = id;
          }
        }

        currentPaddock = bestPaddock || paddockList[0];
      }

      // Render schedule
      container.innerHTML = schedule.map((item, idx) => {
        const dateStr = item.date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        });

        return \`
          <div class="schedule-item \${item.isCurrent ? 'current' : ''}">
            <span class="schedule-date">\${dateStr}</span>
            <span class="schedule-paddock">\${item.isCurrent ? '→ ' : ''}\${item.paddock}</span>
            <span class="schedule-reason">\${item.days} days • \${item.reason}</span>
          </div>
        \`;
      }).join('');
    }

    // ============================================
    // PADDOCK LIST
    // ============================================
    function getStatusInfo(forage, isCurrent = false) {
      const t = CONFIG.forageThresholds;
      if (forage < t.critical) {
        // Only show "Hay Needed" if herd is there; otherwise it's just recovering
        return { class: 'critical', label: isCurrent ? 'Hay Needed' : 'Recovering' };
      }
      if (forage < t.low) return { class: 'low', label: isCurrent ? 'Low' : 'Recovering' };
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
          const isCurrent = id === currentPaddockId;
          const statusInfo = getStatusInfo(current, isCurrent);
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

    // Generate FUTURE dates for Planning chart
    function generateFutureDateLabels(dayCount) {
      const today = new Date();
      const labels = [];
      for (let i = 0; i < dayCount; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      }
      return labels;
    }

    // Generate HISTORICAL dates for Trends chart
    function generateHistoricalDateLabels(results) {
      if (results?.dates) {
        // Use actual dates from historical simulation
        return results.dates.map(d => {
          const date = new Date(d);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
      }
      // Fallback: generate past dates
      const today = new Date();
      const labels = [];
      const dayCount = results?.time?.length || 60;
      for (let i = dayCount - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      }
      return labels;
    }

    // Chart config for PLANNING (forward projection)
    function getPlanningChartConfig(results) {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
      const textColor = isDark ? '#D6D3D1' : '#57534E';
      const dateLabels = generateFutureDateLabels(results.time.length);

      return {
        type: 'line',
        data: {
          labels: dateLabels,
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
            title: {
              display: true,
              text: '📈 Forward Projection (Next 100 Days)',
              font: { family: "'Fraunces', Georgia, serif", size: 14, weight: 500 },
              color: textColor,
              padding: { bottom: 15 }
            },
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
                text: 'Date',
                font: { family: "'DM Sans', sans-serif", size: 12 },
                color: textColor
              },
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                maxTicksLimit: 12,
                maxRotation: 45,
                minRotation: 0
              }
            }
          }
        }
      };
    }

    // Chart config for TRENDS (historical reconstruction)
    function getTrendsChartConfig(results) {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
      const textColor = isDark ? '#D6D3D1' : '#57534E';
      const dateLabels = generateHistoricalDateLabels(results);

      return {
        type: 'line',
        data: {
          labels: dateLabels,
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
            title: {
              display: true,
              text: '📜 Historical Trends (Past 60 Days)',
              font: { family: "'Fraunces', Georgia, serif", size: 14, weight: 500 },
              color: textColor,
              padding: { bottom: 15 }
            },
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
                text: 'Date',
                font: { family: "'DM Sans', sans-serif", size: 12 },
                color: textColor
              },
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                maxTicksLimit: 10,
                maxRotation: 45,
                minRotation: 0
              }
            }
          }
        }
      };
    }

    function createTrendsChart() {
      // Use historical results if available, otherwise fall back to current
      const data = historicalResults || currentResults;
      const ctx = document.getElementById('trendsChart').getContext('2d');
      if (trendsChart) trendsChart.destroy();
      trendsChart = new Chart(ctx, getTrendsChartConfig(data));
    }

    function createPlanningChart(results) {
      const ctx = document.getElementById('planningChart').getContext('2d');
      if (planningChart) planningChart.destroy();
      planningChart = new Chart(ctx, getPlanningChartConfig(results));
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
          body: JSON.stringify({
            params: {
              herd_count: herd,
              total_herd_weight: herd * CONFIG.herdDefaults.averageWeight,
              base_rain_input: rain,
              rotation_days: rotation
            },
            steps: ${steps},
            dt: ${dt}
          })
        });

        currentResults = await response.json();

        // Update all views
        updatePaddockList(currentResults);
        updateHerdStatus(currentResults);
        updateRotationSchedule(currentResults, rotation);
        if (planningChart) createPlanningChart(currentResults);
        if (trendsChart) createTrendsChart();

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
      if (trendsChart) createTrendsChart();
      if (planningChart) createPlanningChart(currentResults);
    });
  </script>
</body>
</html>`;
}
