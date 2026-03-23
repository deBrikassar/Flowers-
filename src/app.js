import { emptyPlant, emptySeedlingTask, recommendationLibrary } from './data.js';
import { actions, getState, selectors, subscribe } from './store.js';
import { compareDateStrings, dateRange, dueLabel, formatDate, formatMonthDay, startOfMonthGrid, today } from './utils.js';

const app = document.querySelector('#app');

const uiState = {
  tab: 'dashboard',
  selectedPlantId: null,
  wateringMonth: new Date(),
  wateringDate: today(),
  seedlingMonth: new Date(),
  showPlantModal: false,
  plantDraft: emptyPlant(),
  editingPlantId: null,
  plantError: '',
  showSeedlingModal: false,
  seedlingDraft: emptySeedlingTask(),
  editingSeedlingId: null,
  seedlingError: '',
  noteDraft: '',
  conditionDraft: 'Good',
};

const icons = {
  dashboard: '☀️',
  plants: '🪴',
  watering: '💧',
  seedlings: '🌱',
  recommendations: '✨',
};

const conditionTone = (condition) => ({ Good: 'success', Okay: 'neutral', 'Needs attention': 'warning', Sick: 'warning' }[condition] || 'neutral');
const eventLabel = (event) => {
  if (event.type === 'watered') return 'Watered';
  if (event.type === 'repotted') return 'Repotted';
  if (event.type === 'condition') return `Condition: ${event.value || 'Updated'}`;
  return 'Note added';
};

const escapeHtml = (value = '') => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const openPlantModal = (plant = emptyPlant(), plantId = null) => {
  uiState.showPlantModal = true;
  uiState.plantDraft = { ...plant };
  uiState.editingPlantId = plantId;
  uiState.plantError = '';
  render();
};

const openSeedlingModal = (task = emptySeedlingTask(), taskId = null) => {
  uiState.showSeedlingModal = true;
  uiState.seedlingDraft = JSON.parse(JSON.stringify(task));
  uiState.editingSeedlingId = taskId;
  uiState.seedlingError = '';
  render();
};

const card = (title, body, action = '') => `
  <section class="surface-card">
    <div class="card-header">
      <h2>${title}</h2>
      ${action ? `<span class="card-action">${action}</span>` : ''}
    </div>
    ${body}
  </section>
`;

const emptyState = (title, message) => `<div class="empty-state"><strong>${title}</strong><p>${message}</p></div>`;

const plantTaskList = (plants) => {
  if (!plants.length) return emptyState('Nothing here', 'There are no plants in this list right now.');
  return `<div class="list-stack">${plants.map((plant) => `
      <div class="list-row">
        <button class="text-button" data-action="select-plant" data-id="${plant.id}">
          <strong>${escapeHtml(plant.photo)} ${escapeHtml(plant.name)}</strong>
          <p>${escapeHtml(plant.location)} · ${formatMonthDay(selectors.nextWateringDate(plant))}</p>
        </button>
        <div class="row-actions">
          <span class="badge ${selectors.wateringState(plant) === 'overdue' ? 'warning' : selectors.wateringState(plant) === 'today' ? 'today' : 'neutral'}">${dueLabel(selectors.nextWateringDate(plant))}</span>
          <button class="secondary-button" data-action="mark-watered" data-id="${plant.id}">Watered</button>
        </div>
      </div>`).join('')}</div>`;
};

const buildWateringCalendar = (plants) => {
  const anchor = uiState.wateringMonth;
  const start = startOfMonthGrid(anchor);
  const dates = dateRange(start, 35);
  const agenda = plants.filter((plant) => selectors.nextWateringDate(plant) === uiState.wateringDate);
  return `
    <div class="calendar-layout">
      ${card('Month view', `
        <div class="calendar-controls">
          <button class="ghost-button" data-action="month-nav" data-target="watering" data-direction="-1">←</button>
          <button class="ghost-button" data-action="month-current" data-target="watering">Today</button>
          <button class="ghost-button" data-action="month-nav" data-target="watering" data-direction="1">→</button>
        </div>
        <div class="calendar-grid">
          ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => `<span class="calendar-label">${label}</span>`).join('')}
          ${dates.map((date) => {
            const tasks = plants.filter((plant) => selectors.nextWateringDate(plant) === date);
            const current = new Date(date);
            return `
              <button class="calendar-day ${current.getMonth() !== anchor.getMonth() ? 'muted' : ''} ${date === uiState.wateringDate ? 'selected' : ''}" data-action="select-watering-date" data-date="${date}">
                <span>${current.getDate()}</span>
                <small>${tasks.length ? `${tasks.length} plants` : '—'}</small>
                <div class="calendar-dots">${tasks.slice(0, 3).map((task) => `<span class="dot ${selectors.wateringState(task)}"></span>`).join('')}</div>
              </button>`;
          }).join('')}
        </div>
      `, anchor.toLocaleString('en-US', { month: 'long', year: 'numeric' }))}
      ${card('Daily agenda', agenda.length ? `<div class="list-stack">${agenda.map((plant) => `
          <div class="list-row">
            <div><strong>${escapeHtml(plant.photo)} ${escapeHtml(plant.name)}</strong><p>${escapeHtml(plant.location)}</p></div>
            <div class="row-actions">
              <button class="ghost-button" data-action="jump-to-plant" data-id="${plant.id}">Details</button>
              <button class="secondary-button" data-action="mark-watered" data-id="${plant.id}">Watered</button>
            </div>
          </div>`).join('')}</div>` : emptyState('No watering tasks', 'Pick another date to review scheduled watering.'), formatDate(uiState.wateringDate))}
    </div>`;
};

const buildSeedlingCalendar = (tasks) => {
  const anchor = uiState.seedlingMonth;
  const dates = dateRange(startOfMonthGrid(anchor), 35);
  const stages = tasks.flatMap((task) => task.stages.map((stage) => ({ ...stage, plantName: task.plantName, status: stage.status })));
  const cards = tasks.length ? tasks.map((task) => card(task.plantName, `
      <p class="muted-block">${escapeHtml(task.notes || 'No notes added.')}</p>
      <div class="timeline">
        ${task.stages.sort((a, b) => compareDateStrings(a.date, b.date)).map((stage) => `
          <div class="list-row">
            <div>
              <strong>${stage.name}</strong>
              <p>${formatDate(stage.date)}</p>
            </div>
            <div class="row-actions">
              <span class="badge ${stage.status === 'Done' ? 'success' : stage.status === 'Due' ? 'warning' : 'neutral'}">${stage.status}</span>
              <button class="ghost-button" data-action="toggle-stage" data-task-id="${task.id}" data-stage-id="${stage.id}">${stage.completedAt ? 'Undo' : 'Done'}</button>
            </div>
          </div>`).join('')}
      </div>
      <div class="action-grid compact">
        <button class="secondary-button" data-action="edit-seedling" data-id="${task.id}">Edit</button>
        <button class="ghost-button danger" data-action="archive-seedling" data-id="${task.id}">Archive</button>
      </div>
    `, 'Stage tracking')).join('') : card('Seedling plans', emptyState('No seedling plans yet', 'Add a plan to track sprouting and transplant milestones.'));

  return `
    <div class="stack-lg">
      ${card('Milestone calendar', `
        <div class="calendar-controls">
          <button class="ghost-button" data-action="month-nav" data-target="seedling" data-direction="-1">←</button>
          <button class="ghost-button" data-action="month-current" data-target="seedling">Today</button>
          <button class="ghost-button" data-action="month-nav" data-target="seedling" data-direction="1">→</button>
        </div>
        <div class="calendar-grid">
          ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => `<span class="calendar-label">${label}</span>`).join('')}
          ${dates.map((date) => {
            const items = stages.filter((stage) => stage.date === date);
            const current = new Date(date);
            return `<div class="calendar-day ${current.getMonth() !== anchor.getMonth() ? 'muted' : ''}">
              <span>${current.getDate()}</span>
              <small>${items.length ? `${items.length} milestones` : '—'}</small>
              <div class="calendar-dots">${items.slice(0, 3).map((item) => `<span class="dot ${item.status === 'Done' ? 'today' : item.status === 'Due' ? 'overdue' : 'upcoming'}"></span>`).join('')}</div>
            </div>`;
          }).join('')}
        </div>
      `, anchor.toLocaleString('en-US', { month: 'long', year: 'numeric' }))}
      <div class="recommendation-grid">${cards}</div>
    </div>`;
};

const dashboardMarkup = (snapshot) => {
  const overview = selectors.dashboard(snapshot);
  const repotSoonCount = selectors.activePlants(snapshot).filter((plant) => compareDateStrings(selectors.nextRepottingDate(plant), today()) <= 14 * 24 * 60 * 60 * 1000).length;
  return `
    <section class="stack-lg">
      <div class="section-header"><div><h2>Today at a glance</h2><p>Quick actions for the most time-sensitive care tasks.</p></div></div>
      <div class="stats-grid">
        <div class="metric-card today"><span>Water today</span><strong>${overview.watering.today.length}</strong></div>
        <div class="metric-card overdue"><span>Overdue</span><strong>${overview.watering.overdue.length}</strong></div>
        <div class="metric-card upcoming"><span>Repot due</span><strong>${repotSoonCount}</strong></div>
      </div>
      ${card('Needs watering today', plantTaskList(overview.watering.today), overview.watering.today.length ? `${overview.watering.today.length} plants` : 'All clear')}
      ${card('Overdue tasks', plantTaskList(overview.watering.overdue), overview.watering.overdue.length ? `${overview.watering.overdue.length} plants` : 'None')}
      ${card('Upcoming repotting', overview.repotting.length ? `<div class="list-stack">${overview.repotting.map((plant) => `
          <button class="list-row interactive" data-action="jump-to-plant" data-id="${plant.id}">
            <div><strong>${escapeHtml(plant.photo)} ${escapeHtml(plant.name)}</strong><p>${escapeHtml(plant.species)}</p></div>
            <span class="badge neutral">${dueLabel(selectors.nextRepottingDate(plant))}</span>
          </button>`).join('')}</div>` : emptyState('No repotting tasks', 'Your repotting schedule is clear right now.'), 'Next 4 plants')}
      ${card('Seedling milestones', overview.milestones.length ? `<div class="list-stack">${overview.milestones.map((stage) => `
          <div class="list-row"><div><strong>${escapeHtml(stage.plantName)}</strong><p>${stage.name}</p></div><span class="badge ${stage.status === 'Done' ? 'success' : stage.status === 'Due' ? 'warning' : 'neutral'}">${formatMonthDay(stage.date)}</span></div>`).join('')}</div>` : emptyState('No milestones yet', 'Add a seedling plan to track key stage dates.'), 'Planning board')}
    </section>`;
};

const plantSectionMarkup = (snapshot) => {
  const plants = selectors.activePlants(snapshot);
  if (!uiState.selectedPlantId && plants[0]) uiState.selectedPlantId = plants[0].id;
  const selectedPlant = plants.find((plant) => plant.id === uiState.selectedPlantId) || plants[0] || null;
  const timeline = selectedPlant ? selectors.plantTimeline(snapshot, selectedPlant.id) : [];

  return `
    <section class="stack-lg two-column-layout">
      <div class="stack-md">
        <div class="section-header"><div><h2>Plants</h2><p>Keep a clear record for every active plant.</p></div><button class="primary-button" data-action="open-add-plant">+ Add plant</button></div>
        ${card('Collection', plants.length ? `<div class="list-stack">${plants.map((plant) => `
            <button class="plant-card ${selectedPlant?.id === plant.id ? 'selected' : ''}" data-action="select-plant" data-id="${plant.id}">
              <div class="plant-card-top">
                <div><h3>${escapeHtml(plant.photo)} ${escapeHtml(plant.name)}</h3><p>${escapeHtml(plant.species)}</p></div>
                <span class="badge ${conditionTone(plant.condition)}">${plant.condition}</span>
              </div>
              <div class="plant-meta-row"><span>${escapeHtml(plant.location)}</span><span>${dueLabel(selectors.nextWateringDate(plant))}</span></div>
            </button>`).join('')}</div>` : emptyState('No plants added', 'Add your first plant to start tracking watering and repotting.'), `${plants.length} active`)}
      </div>
      <div class="stack-md">
        ${selectedPlant ? card(`${escapeHtml(selectedPlant.photo)} ${escapeHtml(selectedPlant.name)}`, `
          <div class="detail-grid">
            <div><span class="info-label">Location</span><strong>${escapeHtml(selectedPlant.location)}</strong></div>
            <div><span class="info-label">Added</span><strong>${formatDate(selectedPlant.dateAdded)}</strong></div>
            <div><span class="info-label">Last watered</span><strong>${formatDate(selectedPlant.lastWateredDate)}</strong></div>
            <div><span class="info-label">Next watering</span><strong>${formatDate(selectors.nextWateringDate(selectedPlant))}</strong></div>
            <div><span class="info-label">Last repotted</span><strong>${formatDate(selectedPlant.lastRepottedDate)}</strong></div>
            <div><span class="info-label">Next repotting</span><strong>${formatDate(selectors.nextRepottingDate(selectedPlant))}</strong></div>
          </div>
          <p class="muted-block">${escapeHtml(selectedPlant.notes || 'No notes yet.')}</p>
          <div class="action-grid">
            <button class="secondary-button" data-action="mark-watered" data-id="${selectedPlant.id}">Mark watered</button>
            <button class="secondary-button" data-action="mark-repotted" data-id="${selectedPlant.id}">Mark repotted</button>
            <button class="secondary-button" data-action="edit-plant" data-id="${selectedPlant.id}">Edit plant</button>
            <button class="ghost-button danger" data-action="archive-plant" data-id="${selectedPlant.id}">Archive</button>
          </div>
        `, escapeHtml(selectedPlant.species)) : card('Plant detail', emptyState('Choose a plant', 'Select a plant from the list or add one to see detail and timeline data.'))}
        ${selectedPlant ? card('Quick update', `
            <div class="inline-form-grid">
              <label>Condition<select id="condition-draft">${['Good', 'Okay', 'Needs attention', 'Sick'].map((option) => `<option ${uiState.conditionDraft === option ? 'selected' : ''}>${option}</option>`).join('')}</select></label>
              <div class="align-end"><button class="secondary-button" data-action="save-condition" data-id="${selectedPlant.id}">Save condition</button></div>
              <label class="full-width">Add note<textarea id="note-draft" rows="4" placeholder="Log an observation or care reminder">${escapeHtml(uiState.noteDraft)}</textarea></label>
              <button class="secondary-button" data-action="save-note" data-id="${selectedPlant.id}">Add note to history</button>
              <button class="ghost-button danger" data-action="delete-plant" data-id="${selectedPlant.id}">Delete plant</button>
            </div>
          `, 'Timeline-ready') : ''}
        ${selectedPlant ? card('Care timeline', timeline.length ? `<div class="timeline">${timeline.map((event) => `
            <div class="timeline-item">
              <span class="timeline-dot ${event.type}"></span>
              <div><strong>${eventLabel(event)}</strong><p>${formatDate(event.date)}</p>${event.note ? `<small>${escapeHtml(event.note)}</small>` : ''}</div>
            </div>`).join('')}</div>` : emptyState('No care history yet', 'Mark care actions to build a timeline.'), 'Newest first') : ''}
      </div>
    </section>`;
};

const recommendationsMarkup = (snapshot) => {
  const plants = selectors.activePlants(snapshot);
  const body = plants.length ? plants.map((plant) => {
    const rec = recommendationLibrary[plant.recommendationId];
    return card(`${escapeHtml(plant.photo)} ${escapeHtml(plant.name)}`, `
      <div class="recommendation-stack">
        <div class="compact-info"><span>Light</span><strong>${escapeHtml(rec.light)}</strong></div>
        <div class="compact-info"><span>Water</span><strong>${escapeHtml(rec.watering)}</strong></div>
        <div class="compact-info"><span>Humidity</span><strong>${escapeHtml(rec.humidity)}</strong></div>
        <div class="compact-info"><span>Temperature</span><strong>${escapeHtml(rec.temperature)}</strong></div>
        <div class="compact-info"><span>Repotting</span><strong>${escapeHtml(rec.repotting)}</strong></div>
        <div><span class="info-label">Overwatering signs</span><ul class="chip-list">${rec.overwateringSigns.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
        <div><span class="info-label">Underwatering signs</span><ul class="chip-list">${rec.underwateringSigns.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
        <div><span class="info-label">Basic tips</span><ul class="chip-list">${rec.tips.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
      </div>
    `, escapeHtml(rec.label));
  }).join('') : card('Recommendations', emptyState('No plants yet', 'Plant recommendations will appear once you add a plant.'));
  return `<section class="stack-lg"><div class="section-header"><div><h2>Plant recommendations</h2><p>Compact care guidance that is quick to scan while you work.</p></div></div><div class="recommendation-grid">${body}</div></section>`;
};

const renderPlantModal = () => {
  if (!uiState.showPlantModal) return '';
  const draft = uiState.plantDraft;
  return `
    <div class="modal-backdrop">
      <div class="modal-card">
        <div class="modal-header"><h2>${uiState.editingPlantId ? 'Edit plant' : 'Add plant'}</h2><button class="ghost-button" data-action="close-plant-modal">✕</button></div>
        <div class="inline-form-grid">
          <label>Plant name<input data-field="name" data-form="plant" value="${escapeHtml(draft.name)}" /></label>
          <label>Photo / emoji<input data-field="photo" data-form="plant" value="${escapeHtml(draft.photo)}" /></label>
          <label>Species / variety<input data-field="species" data-form="plant" value="${escapeHtml(draft.species)}" /></label>
          <label>Room / location<input data-field="location" data-form="plant" value="${escapeHtml(draft.location)}" /></label>
          <label>Date added<input type="date" data-field="dateAdded" data-form="plant" value="${draft.dateAdded}" /></label>
          <label>Last watered<input type="date" data-field="lastWateredDate" data-form="plant" value="${draft.lastWateredDate}" /></label>
          <label>Watering interval (days)<input type="number" min="1" data-field="wateringIntervalDays" data-form="plant" value="${draft.wateringIntervalDays}" /></label>
          <label>Last repotted<input type="date" data-field="lastRepottedDate" data-form="plant" value="${draft.lastRepottedDate}" /></label>
          <label>Condition<select data-field="condition" data-form="plant">${['Good', 'Okay', 'Needs attention', 'Sick'].map((option) => `<option ${draft.condition === option ? 'selected' : ''}>${option}</option>`).join('')}</select></label>
          <label>Recommendation<select data-field="recommendationId" data-form="plant">${Object.entries(recommendationLibrary).map(([key, value]) => `<option value="${key}" ${draft.recommendationId === key ? 'selected' : ''}>${value.label}</option>`).join('')}</select></label>
          <label class="full-width">Notes<textarea rows="4" data-field="notes" data-form="plant">${escapeHtml(draft.notes)}</textarea></label>
          ${uiState.plantError ? `<p class="error-text full-width">${uiState.plantError}</p>` : ''}
          <div class="modal-actions full-width"><button class="ghost-button" data-action="close-plant-modal">Cancel</button><button class="primary-button" data-action="submit-plant">Save plant</button></div>
        </div>
      </div>
    </div>`;
};

const renderSeedlingModal = () => {
  if (!uiState.showSeedlingModal) return '';
  const draft = uiState.seedlingDraft;
  const stages = [
    ['seeded', 'Seeded'],
    ['sprouting', 'Expected sprouting'],
    ['picking', 'Picking / transplanting'],
    ['transplant', 'Move to larger pot / final transplant'],
  ];
  return `
    <div class="modal-backdrop">
      <div class="modal-card">
        <div class="modal-header"><h2>${uiState.editingSeedlingId ? 'Edit seedling plan' : 'Add seedling plan'}</h2><button class="ghost-button" data-action="close-seedling-modal">✕</button></div>
        <div class="inline-form-grid">
          <label class="full-width">Plant name<input data-field="plantName" data-form="seedling" value="${escapeHtml(draft.plantName)}" /></label>
          ${stages.map(([key, label]) => `<label>${label}<input type="date" data-form="seedling-date" data-field="${key}" value="${draft.dates[key]}" /></label>`).join('')}
          <label class="full-width">Notes<textarea rows="4" data-field="notes" data-form="seedling">${escapeHtml(draft.notes)}</textarea></label>
          ${uiState.seedlingError ? `<p class="error-text full-width">${uiState.seedlingError}</p>` : ''}
          <div class="modal-actions full-width"><button class="ghost-button" data-action="close-seedling-modal">Cancel</button><button class="primary-button" data-action="submit-seedling">Save plan</button></div>
        </div>
      </div>
    </div>`;
};

const mainMarkup = (snapshot) => {
  const plants = selectors.activePlants(snapshot);
  const notifications = selectors.notificationSummary(snapshot);
  return `
    <div class="app-shell">
      <header class="hero-card">
        <div>
          <p class="eyebrow">Plant care planner</p>
          <h1>Healthy routines for every leaf and seedling.</h1>
          <p class="hero-copy">Track watering, repotting, care history, and recommendations in one calm mobile-first workspace.</p>
        </div>
        <div class="hero-actions">
          <button class="primary-button" data-action="quick-add-plant">+ Quick add plant</button>
          <span class="badge neutral">${notifications.length} reminder-ready entries</span>
        </div>
      </header>
      <main class="content-grid">
        ${uiState.tab === 'dashboard' ? dashboardMarkup(snapshot) : ''}
        ${uiState.tab === 'plants' ? plantSectionMarkup(snapshot) : ''}
        ${uiState.tab === 'watering' ? `<section class="stack-lg"><div class="section-header"><div><h2>Watering calendar</h2><p>Calendar, agenda, and reminder-ready watering structure.</p></div></div>${card('Reminder readiness', '<p class="muted-block">Each plant stores a calculated next watering date based on last watering and interval. This structure is ready for local notifications or backend sync later.</p>', 'Local notifications ready')}${buildWateringCalendar(plants)}<div class="three-column-grid">${card('Today needs watering', plantTaskList(selectors.wateringGroups(snapshot).today))}${card('Overdue', plantTaskList(selectors.wateringGroups(snapshot).overdue))}${card('Upcoming', plantTaskList(selectors.wateringGroups(snapshot).upcoming.slice(0, 6)))}</div></section>` : ''}
        ${uiState.tab === 'seedlings' ? `<section class="stack-lg"><div class="section-header"><div><h2>Seedling & repotting calendar</h2><p>Track seeding, sprouting, transplanting, and larger-pot milestones.</p></div><button class="primary-button" data-action="open-add-seedling">+ Add seedling plan</button></div>${buildSeedlingCalendar(selectors.activeSeedlingTasks(snapshot))}</section>` : ''}
        ${uiState.tab === 'recommendations' ? recommendationsMarkup(snapshot) : ''}
      </main>
      <nav class="bottom-nav">${['dashboard', 'plants', 'watering', 'seedlings', 'recommendations'].map((tab) => `<button class="${uiState.tab === tab ? 'active' : ''}" data-action="tab" data-tab="${tab}"><span>${icons[tab]}</span><span>${tab === 'dashboard' ? 'Today' : tab === 'recommendations' ? 'Care' : tab.charAt(0).toUpperCase() + tab.slice(1)}</span></button>`).join('')}</nav>
      ${renderPlantModal()}
      ${renderSeedlingModal()}
    </div>`;
};

const render = () => {
  const snapshot = getState();
  const firstPlant = selectors.activePlants(snapshot)[0];
  if (!uiState.selectedPlantId && firstPlant) {
    uiState.selectedPlantId = firstPlant.id;
    uiState.conditionDraft = firstPlant.condition;
  }
  app.innerHTML = mainMarkup(snapshot);
  const noteField = document.querySelector('#note-draft');
  if (noteField) noteField.addEventListener('input', (event) => { uiState.noteDraft = event.target.value; });
  const conditionField = document.querySelector('#condition-draft');
  if (conditionField) conditionField.addEventListener('change', (event) => { uiState.conditionDraft = event.target.value; });
};

app.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const form = target.dataset.form;
  const field = target.dataset.field;
  if (form === 'plant' && field) {
    uiState.plantDraft[field] = target.type === 'number' ? Number(target.value) : target.value;
  }
  if (form === 'seedling' && field) {
    uiState.seedlingDraft[field] = target.value;
  }
  if (form === 'seedling-date' && field) {
    uiState.seedlingDraft.dates[field] = target.value;
  }
});

app.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const { action, id, tab, direction, date, target: targetType, taskId, stageId } = target.dataset;
  const snapshot = getState();

  if (action === 'tab') uiState.tab = tab;
  if (action === 'quick-add-plant' || action === 'open-add-plant') openPlantModal(emptyPlant());
  if (action === 'close-plant-modal') uiState.showPlantModal = false;
  if (action === 'close-seedling-modal') uiState.showSeedlingModal = false;
  if (action === 'select-plant' && id) { const plant = selectors.activePlants(snapshot).find((item) => item.id === id); uiState.selectedPlantId = id; uiState.tab = 'plants'; uiState.conditionDraft = plant?.condition || 'Good'; uiState.noteDraft = ''; }
  if (action === 'jump-to-plant' && id) { const plant = selectors.activePlants(snapshot).find((item) => item.id === id); uiState.selectedPlantId = id; uiState.tab = 'plants'; uiState.conditionDraft = plant?.condition || 'Good'; uiState.noteDraft = ''; }
  if (action === 'mark-watered' && id) actions.markWatered(id);
  if (action === 'mark-repotted' && id) actions.markRepotted(id);
  if (action === 'archive-plant' && id) { actions.archivePlant(id); if (uiState.selectedPlantId === id) uiState.selectedPlantId = selectors.activePlants(getState())[0]?.id || null; }
  if (action === 'delete-plant' && id) { actions.deletePlant(id); uiState.selectedPlantId = selectors.activePlants(getState())[0]?.id || null; }
  if (action === 'edit-plant' && id) {
    const plant = selectors.activePlants(snapshot).find((item) => item.id === id);
    if (plant) openPlantModal(plant, id);
  }
  if (action === 'save-condition' && id) {
    actions.updateCondition(id, uiState.conditionDraft, uiState.noteDraft.trim() || 'Condition reviewed.');
    uiState.noteDraft = '';
  }
  if (action === 'save-note' && id && uiState.noteDraft.trim()) {
    actions.addNote(id, uiState.noteDraft.trim());
    uiState.noteDraft = '';
  }
  if (action === 'submit-plant') {
    const draft = uiState.plantDraft;
    if (!draft.name.trim() || !draft.species.trim() || !draft.location.trim()) {
      uiState.plantError = 'Name, species, and location are required.';
      return render();
    }
    if (Number(draft.wateringIntervalDays) < 1) {
      uiState.plantError = 'Watering interval must be at least 1 day.';
      return render();
    }
    uiState.showPlantModal = false;
    uiState.plantError = '';
    if (uiState.editingPlantId) {
      actions.updatePlant(uiState.editingPlantId, { ...draft, name: draft.name.trim(), species: draft.species.trim(), location: draft.location.trim(), notes: draft.notes.trim() });
    } else {
      actions.addPlant({ ...draft, name: draft.name.trim(), species: draft.species.trim(), location: draft.location.trim(), notes: draft.notes.trim() });
    }
    uiState.editingPlantId = null;
  }
  if (action === 'open-add-seedling') openSeedlingModal(emptySeedlingTask());
  if (action === 'submit-seedling') {
    const draft = uiState.seedlingDraft;
    if (!draft.plantName.trim()) {
      uiState.seedlingError = 'Plant name is required.';
      return render();
    }
    uiState.showSeedlingModal = false;
    uiState.seedlingError = '';
    if (uiState.editingSeedlingId) actions.updateSeedlingTask(uiState.editingSeedlingId, { ...draft, plantName: draft.plantName.trim(), notes: draft.notes.trim() });
    else actions.addSeedlingTask({ ...draft, plantName: draft.plantName.trim(), notes: draft.notes.trim() });
    uiState.editingSeedlingId = null;
  }
  if (action === 'edit-seedling' && id) {
    const task = selectors.activeSeedlingTasks(snapshot).find((item) => item.id === id);
    if (task) openSeedlingModal({ plantName: task.plantName, notes: task.notes, dates: Object.fromEntries(task.stages.map((stage) => [stage.key, stage.date])) }, id);
  }
  if (action === 'toggle-stage' && taskId && stageId) actions.toggleSeedlingStage(taskId, stageId);
  if (action === 'archive-seedling' && id) actions.archiveSeedlingTask(id);
  if (action === 'month-nav' && targetType === 'watering') uiState.wateringMonth = new Date(uiState.wateringMonth.getFullYear(), uiState.wateringMonth.getMonth() + Number(direction), 1);
  if (action === 'month-nav' && targetType === 'seedling') uiState.seedlingMonth = new Date(uiState.seedlingMonth.getFullYear(), uiState.seedlingMonth.getMonth() + Number(direction), 1);
  if (action === 'month-current' && targetType === 'watering') { uiState.wateringMonth = new Date(); uiState.wateringDate = today(); }
  if (action === 'month-current' && targetType === 'seedling') uiState.seedlingMonth = new Date();
  if (action === 'select-watering-date' && date) uiState.wateringDate = date;
  render();
});

subscribe(() => render());
render();
