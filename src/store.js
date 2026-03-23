import { createSeedlingStages, emptyPlant, emptySeedlingTask, mockState } from './data.js';
import { addDays, compareDateStrings, dueLabel, formatDate, randomId, today } from './utils.js';

const STORAGE_KEY = 'plant-care-planner-state';

const clone = (value) => JSON.parse(JSON.stringify(value));

const getStoredState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : clone(mockState);
  } catch {
    return clone(mockState);
  }
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

const normalizeState = (state) => ({
  ...state,
  plants: state.plants.map((plant) => ({ ...emptyPlant(), ...plant })),
  seedlingTasks: state.seedlingTasks.map((task) => ({
    ...task,
    stages: task.stages.map((stage) => ({ ...stage, status: seedlingStatus(stage) })).sort((a, b) => compareDateStrings(a.date, b.date)),
  })),
});

let state = normalizeState(getStoredState());
const listeners = new Set();

const persist = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const emit = () => listeners.forEach((listener) => listener(getState()));

export const getState = () => normalizeState(clone(state));
export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const commit = (updater) => {
  state = normalizeState(updater(getState()));
  persist();
  emit();
};

const newEvent = (plantId, type, note = '', value = '') => ({ id: randomId(), plantId, type, date: today(), note, value });

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
