/**
 * Dashboard.
 *
 * Intentionally a placeholder. The tab, routing and panel exist so the shell is
 * settled; what goes in it comes later.
 */

export function renderDashboard() {
  const root = document.getElementById('dashboard-content');
  if (!root) return;

  root.innerHTML = `
    <div class="dashboard-placeholder">
      <span class="material-symbols-rounded">insights</span>
      <h2>Nothing here yet</h2>
      <p>This is where an at-a-glance view of your week will live.</p>
    </div>`;
}
