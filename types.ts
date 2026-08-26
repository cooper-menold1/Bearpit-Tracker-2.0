
export enum Role {
    ADMIN = 'Admin',
    OFFICER = 'Officer',
    MEMBER = 'Member',
    PROSPECTIVE = 'Prospective',
}

export interface Member {
    id: string;
    firstName: string;
    lastName: string;
    role: Role;
    yearsInBPLT: number;
    password?: string;
    email?: string;
    phone?: string;
    year?: string; // class year, e.g. "Freshman" -- only meaningful pre-induction
    heardAbout?: string; // how a prospect heard about Bear Pit -- only meaningful pre-induction
    fallSportId?: string;
    springSportId?: string;
    isChair?: boolean;
}

export interface BonusPoint {
    id: string;
    memberId: string;
    points: number;
    reason: string;
    date: string;
}

export interface SelfieVote {
    selfieId: string;
    memberId: string;
}

export interface Game {
    id: string;
    sportId: string;
    date: string;
    time?: string; // 24h format "HH:MM"
    opponent: string;
    location: 'Home' | 'Away' | 'Neutral';
    isBonus: boolean;
    pointsValue: number; // New field
    description?: string;
}

export interface Venue {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
}

export interface Sport {
    id: string;
    name: string;
    attendanceThreshold?: number; // 0.0 to 1.0
    venueIds?: string[]; // Multiple venues allowed (e.g. Basketball)
}

export interface Selfie {
    id: string;
    memberId: string;
    gameId: string;
    imageData: string; // Base64 or URL
    timestamp: string;
    votes?: number; // Optional count for UI
}

export interface Settings {
    adminPassword?: string; // Fallback/Legacy
    publicUrl?: string;
}

export interface EmailTemplate {
    id: string;
    subject: string;
    body: string; // supports {{first_name}}, {{meeting_type}}, {{date}}, {{time}}, {{location}}
    meetingType?: string;
    meetingDate?: string;
    meetingTime?: string;
    meetingLocation?: string;
}

// Map of gameId -> { memberId -> attended (boolean) }
export interface AttendanceRecord {
    [gameId: string]: {
        [memberId: string]: boolean;
    };
}

export interface AppState {
    members: Member[];
    sports: Sport[];
    games: Game[];
    attendance: AttendanceRecord;
    selfies: Selfie[];
    bonusPoints: BonusPoint[]; // New field
    selfieVotes: SelfieVote[]; // New field
    settings: Settings;
    emailTemplate: EmailTemplate | null;
}

export interface Chant {
    id: string;
    title: string;
    imageUrl: string;
    createdAt: string;
}
