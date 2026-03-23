import { addDays, randomId, today } from './utils.js';

const seededTaskId = randomId();
const fernId = randomId();
const monsteraId = randomId();
const basilId = randomId();
const now = today();

export const recommendationLibrary = {
  pothos: {
    label: 'Pothos / vine care',
    light: 'Bright to medium indirect light',
    watering: 'Water when the top 1–2 in of soil is dry',
    humidity: 'Average household humidity is usually enough',
    temperature: '65–85°F',
    repotting: 'Check roots yearly, repot every 12–18 months',
    overwateringSigns: ['Yellowing leaves', 'Soft stems', 'Musty soil'],
    underwateringSigns: ['Drooping vines', 'Crispy edges', 'Very dry potting mix'],
    tips: ['Rotate monthly', 'Trim vines to encourage fuller growth'],
  },
  monstera: {
    label: 'Monstera care',
    light: 'Bright indirect light',
    watering: 'Water after the top 2 in of soil dries out',
    humidity: 'Moderate to high humidity',
    temperature: '68–86°F',
    repotting: 'Repot every 1–2 years in active growth season',
    overwateringSigns: ['Black spots', 'Yellow lower leaves', 'Mushy roots'],
    underwateringSigns: ['Curling leaves', 'Slow unfurling', 'Dry compact soil'],
    tips: ['Support larger growth with a moss pole', 'Wipe leaves often'],
  },
  herbs: {
    label: 'Herb planter care',
    light: '4–6 hours of sun or a strong grow light',
    watering: 'Keep evenly moist, avoid letting roots sit in water',
    humidity: 'Average humidity with gentle airflow',
    temperature: '60–78°F',
    repotting: 'Refresh soil when roots fill the container',
    overwateringSigns: ['Wilting in wet soil', 'Gnats', 'Stem rot'],
    underwateringSigns: ['Fast wilting', 'Leaf drop', 'Dry lightweight pot'],
    tips: ['Harvest regularly', 'Use drainage holes and airy soil'],
  },
  succulent: {
    label: 'Succulent care',
    light: 'Bright light with a few hours of direct sun',
    watering: 'Water deeply, then let the mix dry completely',
    humidity: 'Low humidity preferred',
    temperature: '60–80°F',
    repotting: 'Repot every couple of years into gritty mix',
    overwateringSigns: ['Translucent leaves', 'Stem collapse', 'Rot smell'],
    underwateringSigns: ['Wrinkled leaves', 'Shallow roots', 'Shriveled rosette'],
    tips: ['Use cactus mix', 'Reduce watering in cooler months'],
  },
};

export const emptyPlant = () => ({
  name: '',
  photo: '🪴',
  species: '',
  location: '',
  dateAdded: now,
  lastWateredDate: now,
  wateringIntervalDays: 7,
  lastRepottedDate: now,
  condition: 'Good',
  notes: '',
  recommendationId: 'pothos',
});

export const emptySeedlingTask = () => ({
  plantName: '',
  notes: '',
  dates: {
    seeded: now,
    sprouting: addDays(now, 7),
    picking: addDays(now, 21),
    transplant: addDays(now, 35),
  },
});

export const createSeedlingStages = (taskId, dates, completed = {}) => [
  { id: randomId(), taskId, key: 'seeded', name: 'Seeded', date: dates.seeded, completedAt: completed.seeded || dates.seeded },
  { id: randomId(), taskId, key: 'sprouting', name: 'Expected sprouting', date: dates.sprouting, completedAt: completed.sprouting || '' },
  { id: randomId(), taskId, key: 'picking', name: 'Picking / transplanting', date: dates.picking, completedAt: completed.picking || '' },
  { id: randomId(), taskId, key: 'transplant', name: 'Move to larger pot / final transplant', date: dates.transplant, completedAt: completed.transplant || '' },
];

export const mockState = {
  plants: [
    {
      id: fernId,
      name: 'Milo',
      photo: '🌿',
      species: 'Boston fern',
      location: 'Living room shelf',
      dateAdded: addDays(now, -43),
      lastWateredDate: addDays(now, -3),
      wateringIntervalDays: 3,
      lastRepottedDate: addDays(now, -122),
      condition: 'Good',
      notes: 'Likes a weekly mist and filtered morning light.',
      recommendationId: 'pothos',
      archived: false,
    },
    {
      id: monsteraId,
      name: 'Sol',
      photo: '🪴',
      species: 'Monstera deliciosa',
      location: 'Bedroom corner',
      dateAdded: addDays(now, -95),
      lastWateredDate: addDays(now, -6),
      wateringIntervalDays: 7,
      lastRepottedDate: addDays(now, -188),
      condition: 'Okay',
      notes: 'Newest leaf is unfurling slowly — check humidity.',
      recommendationId: 'monstera',
      archived: false,
    },
    {
      id: basilId,
      name: 'Kitchen Basil',
      photo: '🌱',
      species: 'Genovese basil',
      location: 'Kitchen window',
      dateAdded: addDays(now, -14),
      lastWateredDate: addDays(now, -1),
      wateringIntervalDays: 2,
      lastRepottedDate: addDays(now, -20),
      condition: 'Needs attention',
      notes: 'Pinch tips often to keep it bushy.',
      recommendationId: 'herbs',
      archived: false,
    },
  ],
  careEvents: [
    { id: randomId(), plantId: fernId, type: 'watered', date: addDays(now, -6), note: 'Deep soak after soil dried out.' },
    { id: randomId(), plantId: fernId, type: 'watered', date: addDays(now, -3), note: 'Top-up watering.' },
    { id: randomId(), plantId: monsteraId, type: 'repotted', date: addDays(now, -188), note: 'Moved to a 10 inch nursery pot.' },
    { id: randomId(), plantId: basilId, type: 'condition', date: addDays(now, -2), value: 'Needs attention', note: 'Leaves drooped after warm afternoon sun.' },
  ],
  seedlingTasks: [
    {
      id: seededTaskId,
      plantName: 'Tomato seedlings',
      notes: 'Start indoors before the last frost date.',
      archived: false,
      stages: createSeedlingStages(seededTaskId, {
        seeded: addDays(now, -8),
        sprouting: addDays(now, -1),
        picking: addDays(now, 8),
        transplant: addDays(now, 24),
      }, { seeded: addDays(now, -8) }),
    },
  ],
};
