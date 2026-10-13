
import { AppState, Role, Venue } from './types';

export const LOGO_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Baylor_Athletics_logo.svg/1200px-Baylor_Athletics_logo.svg.png";

export const VENUES: Venue[] = [
  { id: 'foster', name: 'Foster Pavilion', latitude: 31.556698, longitude: -97.121613, radiusMeters: 200 },
  { id: 'ferrell', name: 'Ferrell Center', latitude: 31.547903, longitude: -97.105969, radiusMeters: 250 },
  { id: 'ballpark', name: 'Baylor Ballpark', latitude: 31.551278, longitude: -97.107779, radiusMeters: 200 },
  { id: 'getterman', name: 'Getterman Stadium', latitude: 31.54987, longitude: -97.10824, radiusMeters: 150 },
  { id: 'bettylou', name: 'Betty Lou Mays Field', latitude: 31.55177, longitude: -97.10909, radiusMeters: 200 },
  { id: 'hurd', name: 'Hurd Tennis Center', latitude: 31.5502238, longitude: -97.1094079, radiusMeters: 200 },
  { id: 'ferrell_vb', name: 'Ferrell Center (Volleyball)', latitude: 31.547903, longitude: -97.105969, radiusMeters: 200 },
  { id: 'foster_campus', name: 'Foster Campus for Business and Innovation', latitude: 31.5451683, longitude: -97.1154583, radiusMeters: 1000 } // coords corrected 2026-10-13 against OSM (old value was ~230 m off); radius kept at 1 km by owner so meetings work anywhere around Foster
];

// Officer-assigned point categories, from the points menu presented at the
// 2026-09-14 leadership meeting. Game Attendance is tracked separately and
// automatically from check-ins, so it isn't listed here. 'Other' stays last
// for legacy rows and one-off adjustments.
export const POINT_CATEGORIES = [
  'Hospitality',
  'Game Day',
  'Recruitment',
  'Marketing',
  'Media',
  'Community',
  'Leadership',
  'Other',
];

// Fan levels, lowest first. Tier names are from the 2026-09-14 meeting
// (Rookie, Starter, Captain, BPLT All-Star). Point + category thresholds
// follow the Fall 2026 Point Incentive Framework benchmarks (20/2, 40/3,
// 60/4). A member needs BOTH the points and the number of different
// categories to reach a tier ("no point farming" breadth rule).
// Game Attendance counts as a category; 'Other' does not.
export const FAN_TIERS = [
  { name: 'Rookie', minPoints: 0, minCategories: 0 },
  { name: 'Starter', minPoints: 20, minCategories: 2 },
  { name: 'Captain', minPoints: 40, minCategories: 3 },
  { name: 'BPLT All-Star', minPoints: 60, minCategories: 4 },
];

// Shown on the landing page's "Interested in Joining?" card. '' hides the badge.
// To re-enable, set it to the next meeting, e.g. 'Monday, Nov. 2'.
export const NEXT_INTEREST_MEETING = '';

export const AUTHORIZED_USERS = [
  "Ben Jacob",
  "Anna Carrey",
  "Cooper Menold",
  "Isaac Ludshaw",
  "Isaac Laddusaw"
];

export const INITIAL_STATE: AppState = {
  settings: {
    publicUrl: ''
  },
  members: [
    { id: 'm1', firstName: 'Ben', lastName: 'Jacob', role: Role.ADMIN, yearsInBPLT: 3 },
    { id: 'm2', firstName: 'Isaac', lastName: 'Laddusaw', role: Role.ADMIN, yearsInBPLT: 5 },
    { id: 'm13', firstName: 'Cooper', lastName: 'Menold', role: Role.ADMIN, yearsInBPLT: 0 },
    { id: 'm99', firstName: 'Anna', lastName: 'Carrey', role: Role.ADMIN, yearsInBPLT: 2 },
    { id: 'm3', firstName: 'Will', lastName: 'Boles', role: Role.OFFICER, yearsInBPLT: 4 },
    { id: 'm4', firstName: 'Owen', lastName: 'Miller', role: Role.OFFICER, yearsInBPLT: 1 },
    { id: 'm5', firstName: 'Lindsay', lastName: 'Johnson', role: Role.OFFICER, yearsInBPLT: 1 },
    { id: 'm6', firstName: 'Tryston', lastName: 'McGuyre', role: Role.OFFICER, yearsInBPLT: 0 },
    { id: 'm7', firstName: 'Nina', lastName: 'De Las Alas', role: Role.OFFICER, yearsInBPLT: 1 },
    { id: 'm8', firstName: 'Liam', lastName: 'Laddusaw', role: Role.OFFICER, yearsInBPLT: 2 },
    { id: 'm9', firstName: 'Jack', lastName: 'Heyroth', role: Role.OFFICER, yearsInBPLT: 0 },
    { id: 'm10', firstName: 'Cal', lastName: 'Baker', role: Role.OFFICER, yearsInBPLT: 0 },
    { id: 'm11', firstName: 'Michelle', lastName: 'Batho', role: Role.OFFICER, yearsInBPLT: 0 },
    { id: 'm12', firstName: 'Olivia', lastName: 'Galanski', role: Role.OFFICER, yearsInBPLT: 0 },
    { id: 'm14', firstName: 'Elizabeth', lastName: 'Shapley', role: Role.OFFICER, yearsInBPLT: 0 },
    { id: 'm15', firstName: 'Drew', lastName: 'Sadoski', role: Role.OFFICER, yearsInBPLT: 2 },
    { id: 'm16', firstName: 'Luke', lastName: 'Coulter', role: Role.MEMBER, yearsInBPLT: 0 },
    { id: 'm17', firstName: 'Beatriz', lastName: 'Martins', role: Role.MEMBER, yearsInBPLT: 0 },
    { id: 'm18', firstName: 'Jack', lastName: 'Bender', role: Role.MEMBER, yearsInBPLT: 0 },
  ],
  sports: [
    { id: 'vb', name: 'Volleyball', venueIds: ['ferrell'] },
    { id: 'soccer', name: 'Soccer', venueIds: ['bettylou'] },
    { id: 'wbb', name: "Women's Basketball", venueIds: ['foster', 'ferrell'] },
    { id: 'mbb', name: "Men's Basketball", venueIds: ['foster', 'ferrell'] },
    { id: 'mtennis', name: "Men's Tennis", venueIds: ['hurd'] },
    { id: 'wtennis', name: "Women's Tennis", venueIds: ['hurd'] },
    { id: 'baseball', name: 'Baseball', venueIds: ['ballpark'] },
    { id: 'softball', name: 'Softball', venueIds: ['getterman'] },
    { id: 'acro', name: 'Acro & Tumbling', venueIds: ['ferrell'] },
    { id: 'meetings', name: 'Meetings', venueIds: ['foster_campus'] },
  ],
  games: [
    // Volleyball (VB)
    { id: 'vb1', sportId: 'vb', date: '2024-09-04', time: '18:00', opponent: 'Northwestern', location: 'Home', isBonus: false, pointsValue: 1 },
    { id: 'vb2', sportId: 'vb', date: '2024-09-05', time: '19:00', opponent: "Saint Mary's", location: 'Home', isBonus: false, pointsValue: 1 },
    { id: 'vb3', sportId: 'vb', date: '2024-09-07', time: '14:00', opponent: 'Rice', location: 'Home', isBonus: false, pointsValue: 1 },
    { id: 'vb4', sportId: 'vb', date: '2024-09-27', time: '18:30', opponent: 'TCU', location: 'Home', isBonus: false, pointsValue: 1 },
    { id: 'vb5', sportId: 'vb', date: '2024-10-01', time: '19:00', opponent: 'Houston', location: 'Home', isBonus: false, pointsValue: 1 },
    { id: 'vb6', sportId: 'vb', date: '2024-10-03', time: '18:00', opponent: 'Kansas', location: 'Home', isBonus: false, pointsValue: 1 },
    // Soccer
    { id: 'soc1', sportId: 'soccer', date: '2024-08-14', time: '19:00', opponent: 'TAMU', location: 'Away', isBonus: true, pointsValue: 1 },
    { id: 'soc2', sportId: 'soccer', date: '2024-08-21', time: '17:00', opponent: 'Denver', location: 'Home', isBonus: true, pointsValue: 1 },
    { id: 'soc3', sportId: 'soccer', date: '2024-08-24', time: '16:00', opponent: 'Montana', location: 'Away', isBonus: true, pointsValue: 1 },
    { id: 'soc4', sportId: 'soccer', date: '2024-08-28', time: '19:00', opponent: 'Miss St', location: 'Home', isBonus: false, pointsValue: 1 },
    // MBB
    { id: 'mbb1', sportId: 'mbb', date: '2024-10-10', time: '20:00', opponent: 'GCU', location: 'Home', isBonus: true, pointsValue: 1 },
    { id: 'mbb2', sportId: 'mbb', date: '2024-10-26', time: '18:00', opponent: 'Indiana', location: 'Away', isBonus: false, pointsValue: 1 },
    { id: 'mbb3', sportId: 'mbb', date: '2024-11-03', time: '19:30', opponent: 'UTRGV', location: 'Home', isBonus: false, pointsValue: 1 },
  ],
  attendance: {
    'vb1': { 'm1': true, 'm2': true, 'm3': false, 'm4': false, 'm5': false, 'm6': true, 'm7': true },
    'vb2': { 'm1': true, 'm2': false, 'm3': false, 'm4': false, 'm5': false, 'm6': true, 'm7': false },
    'soc1': { 'm2': true, 'm6': true, 'm8': true },
  },
  selfies: [],
  bonusPoints: [],
  selfieVotes: [],
  clubEvents: [],
  eventSignups: [],
  emailTemplate: null
};
