
import { AppState, Role, Venue } from './types';

export const LOGO_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Baylor_Athletics_logo.svg/1200px-Baylor_Athletics_logo.svg.png";

export const VENUES: Venue[] = [
  { id: 'foster', name: 'Foster Pavilion', latitude: 31.556698, longitude: -97.121613, radiusMeters: 200 },
  { id: 'ferrell', name: 'Ferrell Center', latitude: 31.547903, longitude: -97.105969, radiusMeters: 250 },
  { id: 'ballpark', name: 'Baylor Ballpark', latitude: 31.551278, longitude: -97.107779, radiusMeters: 200 },
  { id: 'getterman', name: 'Getterman Stadium', latitude: 31.54987, longitude: -97.10824, radiusMeters: 150 },
  { id: 'bettylou', name: 'Betty Lou Mays Field', latitude: 31.55177, longitude: -97.10909, radiusMeters: 200 },
  { id: 'hurd', name: 'Hurd Tennis Center', latitude: 31.55177, longitude: -97.10909, radiusMeters: 200 }, // Shares space with soccer
  { id: 'ferrell_vb', name: 'Ferrell Center (Volleyball)', latitude: 31.547903, longitude: -97.105969, radiusMeters: 200 },
  { id: 'foster_campus', name: 'Foster Campus for Business and Innovation', latitude: 31.546944, longitude: -97.116667, radiusMeters: 200 }
];

export const AUTHORIZED_USERS = [
  "Ben Jacob",
  "Anna Carrey",
  "Cooper Menold",
  "Isaac Ludshaw",
  "Isaac Laddusaw"
];

export const INITIAL_STATE: AppState = {
  settings: {
    adminPassword: 'SicEmBPLT',
    publicUrl: ''
  },
  members: [
    { id: 'm1', firstName: 'Ben', lastName: 'Jacob', role: Role.ADMIN, yearsInBPLT: 3, password: 'BPLT' },
    { id: 'm2', firstName: 'Isaac', lastName: 'Laddusaw', role: Role.ADMIN, yearsInBPLT: 5, password: 'BPLT' },
    { id: 'm13', firstName: 'Cooper', lastName: 'Menold', role: Role.ADMIN, yearsInBPLT: 0, password: 'BPLT' },
    { id: 'm99', firstName: 'Anna', lastName: 'Carrey', role: Role.ADMIN, yearsInBPLT: 2, password: 'BPLT' },
    { id: 'm3', firstName: 'Will', lastName: 'Boles', role: Role.OFFICER, yearsInBPLT: 4, password: 'BPLT' },
    { id: 'm4', firstName: 'Owen', lastName: 'Miller', role: Role.OFFICER, yearsInBPLT: 1, password: 'BPLT' },
    { id: 'm5', firstName: 'Lindsay', lastName: 'Johnson', role: Role.OFFICER, yearsInBPLT: 1, password: 'BPLT' },
    { id: 'm6', firstName: 'Tryston', lastName: 'McGuyre', role: Role.OFFICER, yearsInBPLT: 0, password: 'BPLT' },
    { id: 'm7', firstName: 'Nina', lastName: 'De Las Alas', role: Role.OFFICER, yearsInBPLT: 1, password: 'BPLT' },
    { id: 'm8', firstName: 'Liam', lastName: 'Laddusaw', role: Role.OFFICER, yearsInBPLT: 2, password: 'BPLT' },
    { id: 'm9', firstName: 'Jack', lastName: 'Heyroth', role: Role.OFFICER, yearsInBPLT: 0, password: 'BPLT' },
    { id: 'm10', firstName: 'Cal', lastName: 'Baker', role: Role.OFFICER, yearsInBPLT: 0, password: 'BPLT' },
    { id: 'm11', firstName: 'Michelle', lastName: 'Batho', role: Role.OFFICER, yearsInBPLT: 0, password: 'BPLT' },
    { id: 'm12', firstName: 'Olivia', lastName: 'Galanski', role: Role.OFFICER, yearsInBPLT: 0, password: 'BPLT' },
    { id: 'm14', firstName: 'Elizabeth', lastName: 'Shapley', role: Role.OFFICER, yearsInBPLT: 0, password: 'BPLT' },
    { id: 'm15', firstName: 'Drew', lastName: 'Sadoski', role: Role.OFFICER, yearsInBPLT: 2, password: 'BPLT' },
    { id: 'm16', firstName: 'Luke', lastName: 'Coulter', role: Role.MEMBER, yearsInBPLT: 0, password: 'BPLT' },
    { id: 'm17', firstName: 'Beatriz', lastName: 'Martins', role: Role.MEMBER, yearsInBPLT: 0, password: 'BPLT' },
    { id: 'm18', firstName: 'Jack', lastName: 'Bender', role: Role.MEMBER, yearsInBPLT: 0, password: 'BPLT' },
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
  emailTemplate: null
};
