import { createSeedlingStages, emptyPlant } from './data.js';
import { addDays, compareDateStrings, dueLabel, formatDate, randomId, today } from './utils.js';

const LEGACY_STORAGE_KEY = 'plant-care-planner-state';
const STORAGE_PREFIX = 'plant-care-planner-state';
const SESSION_KEY = 'plant-care-planner-session';

const clone = (value) => JSON.parse(JSON.stringify(value));
const emptyState = () => ({ plants: [], careEvents: [], seedlingTasks: [] });
const userStorageKey = (userId) => `${STORAGE_PREFIX}:${userId}`;

const readStorage = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeStorage = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const readLegacyState = () => readStorage(LEGACY_STORAGE_KEY);
const consumeLegacyState = () => {
  const legacyState = readLegacyState();
  if (legacyState) localStorage.removeItem(LEGACY_STORAGE_KEY);
  return legacyState;
};

const readSession = () => {
  try {
    return localStorage.getItem(SESSION_KEY) || '';
  } catch {
    return '';
  }
};

const normalizeState = (state) => ({
  plants: (state?.plants || []).map((plant) => ({ ...emptyPlant(), ...plant })),
  careEvents: state?.careEvents || [],
  seedlingTasks: (state?.seedlingTasks || []).map((task) => ({
    ...task,
    stages: (task.stages || [])
      .map((stage) => ({ ...stage, status: seedlingStatus(stage) }))
      .sort((a, b) => compareDateStrings(a.date, b.date)),
  })),
});

const getStoredState = (userId) => {
  if (!userId) return emptyState();
  const scopedState = readStorage(userStorageKey(userId));
  if (scopedState) return normalizeState(scopedState);
  return normalizeState(emptyState());
};

const nextWateringDate = (plant) => addDays(plant.lastWateredDate, Number(plant.wateringIntervalDays));
const nextRepottingDate = (plant) => addDays(plant.lastRepottedDate, 180);
const wateringState = (plant) => {
  const next = nextWateringDate(plant);
  if (compareDateStrings(next, today()) < 0) return 'overdue';
  if (next === today()) return 'today';
  return 'upcoming';
};
const seedlingStatus = (stage) => {
  if (stage.completedAt) return 'Done';
  if (compareDateStrings(stage.date, today()) <= 0) return 'Due';
  return 'Planned';
};

let currentUserId = readSession();
let state = getStoredState(currentUserId);
const listeners = new Set();

const persist = () => {
  if (!currentUserId) return;
  writeStorage(userStorageKey(currentUserId), state);
};
const emit = () => listeners.forEach((listener) => listener(getState(), getSession()));
const resetSessionState = () => {
  state = getStoredState(currentUserId);
};

export const getSession = () => ({ userId: currentUserId, authenticated: Boolean(currentUserId) });
export const getState = () => normalizeState(clone(state));
export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const setCurrentUser = (userId) => {
  currentUserId = userId;
  if (userId) localStorage.setItem(SESSION_KEY, userId);
  else localStorage.removeItem(SESSION_KEY);
  resetSessionState();
  if (userId) persist();
  emit();
};

const commit = (updater) => {
  if (!currentUserId) return;
  state = normalizeState(updater(getState()));
  persist();
  emit();
};

const newEvent = (plantId, type, note = '', value = '') => ({ id: randomId(), plantId, type, date: today(), note, value });

const USER_ID_PATTERN = /^[A-Z0-9]{3,5}(?:-[A-Z0-9]{3,5}){1,2}$/;

export const auth = {
  validateUserId: (value) => USER_ID_PATTERN.test(String(value || '').trim().toUpperCase()),
  normalizeUserId: (value) => String(value || '').trim().toUpperCase(),
  generateUserId: () => {
    const parts = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, 'X');
    return `FLR-${parts.slice(0, 3)}-${parts.slice(3, 6)}`;
  },
  createUser: () => {
    let userId = auth.generateUserId();
    while (readStorage(userStorageKey(userId))) userId = auth.generateUserId();
    writeStorage(userStorageKey(userId), normalizeState(consumeLegacyState() || emptyState()));
    setCurrentUser(userId);
    return userId;
  },
  login: (input) => {
    const userId = auth.normalizeUserId(input);
    if (!auth.validateUserId(userId)) throw new Error('Enter a valid ID in the format FLR-ABC-123.');
    if (!readStorage(userStorageKey(userId))) {
      const legacyState = consumeLegacyState();
      writeStorage(userStorageKey(userId), legacyState ? normalizeState(legacyState) : emptyState());
    }
    setCurrentUser(userId);
    return userId;
  },
  logout: () => setCurrentUser(''),
  getCurrentUser: () => currentUserId,
};

export const selectors = {
  activePlants: (snapshot) => snapshot.plants.filter((plant) => !plant.archived),
  activeSeedlingTasks: (snapshot) => snapshot.seedlingTasks.filter((task) => !task.archived),
  nextWateringDate,
  nextRepottingDate,
  wateringState,
  dueLabel,
  plantTimeline: (snapshot, plantId) => snapshot.careEvents.filter((event) => event.plantId === plantId).sort((a, b) => compareDateStrings(b.date, a.date)),
  wateringGroups: (snapshot) => {
    const plants = selectors.activePlants(snapshot).sort((a, b) => compareDateStrings(nextWateringDate(a), nextWateringDate(b)));
    return {
      today: plants.filter((plant) => wateringState(plant) === 'today'),
      overdue: plants.filter((plant) => wateringState(plant) === 'overdue'),
      upcoming: plants.filter((plant) => wateringState(plant) === 'upcoming'),
    };
  },
  dashboard: (snapshot) => {
    const activePlants = selectors.activePlants(snapshot);
    const activeSeedlings = selectors.activeSeedlingTasks(snapshot);
    return {
      watering: selectors.wateringGroups(snapshot),
      repotting: activePlants.slice().sort((a, b) => compareDateStrings(nextRepottingDate(a), nextRepottingDate(b))).slice(0, 4),
      milestones: activeSeedlings
        .flatMap((task) => task.stages.map((stage) => ({ ...stage, plantName: task.plantName, status: seedlingStatus(stage) })))
        .sort((a, b) => compareDateStrings(a.date, b.date))
        .slice(0, 6),
    };
  },
  calendarAgenda: (snapshot, date) => selectors.activePlants(snapshot).filter((plant) => nextWateringDate(plant) === date),
  notificationSummary: (snapshot) => selectors.activePlants(snapshot).map((plant) => ({
    plantId: plant.id,
    type: 'watering-reminder',
    triggerDate: nextWateringDate(plant),
    message: `${plant.name} should be watered ${formatDate(nextWateringDate(plant))}`,
  })),
};

export const actions = {
  addPlant: (plant) => commit((snapshot) => ({ ...snapshot, plants: [{ ...plant, id: randomId(), archived: false }, ...snapshot.plants] })),
  updatePlant: (id, updates) => commit((snapshot) => ({ ...snapshot, plants: snapshot.plants.map((plant) => (plant.id === id ? { ...plant, ...updates } : plant)) })),
  archivePlant: (id) => commit((snapshot) => ({ ...snapshot, plants: snapshot.plants.map((plant) => (plant.id === id ? { ...plant, archived: true } : plant)) })),
  deletePlant: (id) => commit((snapshot) => ({ ...snapshot, plants: snapshot.plants.filter((plant) => plant.id !== id), careEvents: snapshot.careEvents.filter((event) => event.plantId !== id) })),
  markWatered: (id) => commit((snapshot) => ({
    ...snapshot,
    plants: snapshot.plants.map((plant) => (plant.id === id ? { ...plant, lastWateredDate: today() } : plant)),
    careEvents: [newEvent(id, 'watered', 'Marked watered today.'), ...snapshot.careEvents],
  })),
  markRepotted: (id) => commit((snapshot) => ({
    ...snapshot,
    plants: snapshot.plants.map((plant) => (plant.id === id ? { ...plant, lastRepottedDate: today() } : plant)),
    careEvents: [newEvent(id, 'repotted', 'Marked repotted today.'), ...snapshot.careEvents],
  })),
  updateCondition: (id, condition, note) => commit((snapshot) => ({
    ...snapshot,
    plants: snapshot.plants.map((plant) => (plant.id === id ? { ...plant, condition } : plant)),
    careEvents: [newEvent(id, 'condition', note || 'Condition updated.', condition), ...snapshot.careEvents],
  })),
  addNote: (id, note) => commit((snapshot) => ({
    ...snapshot,
    plants: snapshot.plants.map((plant) => (plant.id === id ? { ...plant, notes: [note, plant.notes].filter(Boolean).join('\n') } : plant)),
    careEvents: [newEvent(id, 'note', note), ...snapshot.careEvents],
  })),
  addSeedlingTask: ({ plantName, notes, dates }) => commit((snapshot) => {
    const taskId = randomId();
    return {
      ...snapshot,
      seedlingTasks: [{ id: taskId, plantName, notes, archived: false, stages: createSeedlingStages(taskId, dates) }, ...snapshot.seedlingTasks],
    };
  }),
  updateSeedlingTask: (id, { plantName, notes, dates }) => commit((snapshot) => ({
    ...snapshot,
    seedlingTasks: snapshot.seedlingTasks.map((task) => (task.id === id ? {
      ...task,
      plantName,
      notes,
      stages: task.stages.map((stage) => ({ ...stage, date: dates[stage.key] || stage.date })),
    } : task)),
  })),
  toggleSeedlingStage: (taskId, stageId) => commit((snapshot) => ({
    ...snapshot,
    seedlingTasks: snapshot.seedlingTasks.map((task) => (task.id === taskId ? {
      ...task,
      stages: task.stages.map((stage) => (stage.id === stageId ? { ...stage, completedAt: stage.completedAt ? '' : today() } : stage)),
    } : task)),
  })),
  archiveSeedlingTask: (id) => commit((snapshot) => ({
    ...snapshot,
    seedlingTasks: snapshot.seedlingTasks.map((task) => (task.id === id ? { ...task, archived: true } : task)),
  })),
};
