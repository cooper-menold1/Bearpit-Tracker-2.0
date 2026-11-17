
import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { INITIAL_STATE, LOGO_URL, HIDDEN_MEMBER_IDS } from './constants';
import { AppState, Member, Game, Selfie, Role, Sport, BonusPoint, SelfieVote, EmailTemplate, ClubEvent, GameRole } from './types';
import { mediaApprovalReason, SHEET_ONLY_POINTS } from './utils/fanTier';
import { Login } from './components/Login';
import { AttendanceForm, AttendanceLocation } from './components/AttendanceForm';
import { InterestForm } from './components/InterestForm';
import { Instructions } from './components/Instructions';
import { QRCodeDisplay } from './components/QRCodeDisplay';
import { SettingsModal } from './components/SettingsModal';
import { ChantGallery } from './components/ChantGallery';
import { supabase } from './utils/supabaseClient';
import { splitApplications } from './utils/applicationArchive';
import { takeCheckinParams, officerSession } from './utils/eventCheckin';

// Lazily loaded: admin-only screens and on-demand modals. Splitting these out
// (Dashboard alone pulls in recharts) keeps the initial bundle small for the
// much more common public paths -- login, the guest attendance form, the
// interest form, and the member portal -- which never need this code.
const SportSheet = lazy(() => import('./components/SportSheet').then(m => ({ default: m.SportSheet })));
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const Management = lazy(() => import('./components/Management').then(m => ({ default: m.Management })));
const SelfieGallery = lazy(() => import('./components/SelfieGallery').then(m => ({ default: m.SelfieGallery })));
const SportsManager = lazy(() => import('./components/SportsManager').then(m => ({ default: m.SportsManager })));
const Leaderboard = lazy(() => import('./components/Leaderboard').then(m => ({ default: m.Leaderboard })));
const ChantManager = lazy(() => import('./components/ChantManager').then(m => ({ default: m.ChantManager })));
const ApplicationsList = lazy(() => import('./components/ApplicationsList').then(m => ({ default: m.ApplicationsList })));
// MemberPortal statically imports Management + Leaderboard for its embedded
// admin views, so lazy-loading it here is what actually keeps those two out
// of the main bundle for the public-facing paths above.
const MemberPortal = lazy(() => import('./components/MemberPortal').then(m => ({ default: m.MemberPortal })));
import {
    LayoutDashboard,
    Users,
    Menu,
    Trophy,
    LogOut,
    Settings,
    QrCode,
    Camera,
    Cloud,
    Dumbbell,
    TableProperties,
    RefreshCw,
    Music,
    User,
    Mail
} from 'lucide-react';

const getSportIcon = (id: string) => {
    return <Trophy className="w-4 h-4" />;
};

function App() {
    const [data, setData] = useState<AppState>(INITIAL_STATE);
    const [isLoading, setIsLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');

    const [currentMember, setCurrentMember] = useState<Member | null>(() => {
        const saved = sessionStorage.getItem('bp_member');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return null; }
        }
        return null;
    });
    // Holds the plaintext password just used to log in, in-memory only --
    // never persisted (not in sessionStorage, not on the Member object).
    // Used to prove identity server-side for later password-change RPCs
    // (rpc_set_own_password / rpc_admin_set_password) without re-prompting.
    // Cleared on logout; lost on page refresh (a fresh privileged action
    // after a refresh will ask the admin to log in again).
    const currentPasswordRef = useRef<string | null>(null);

    const [currentView, setCurrentView] = useState<string>('dashboard');
    const [isSidebarOpen, setSidebarOpen] = useState(true);

    const [showInstructions, setShowInstructions] = useState(false);
    const [showQRCode, setShowQRCode] = useState(false);
    const [showSelfies, setShowSelfies] = useState(false);
    const [showSportsManager, setShowSportsManager] = useState(false);
    const [showChantManager, setShowChantManager] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    const [mode, setMode] = useState<'login' | 'dashboard' | 'member' | 'form' | 'chants' | 'interest'>(() => {
        const savedMode = sessionStorage.getItem('bp_mode');
        return (savedMode as any) || 'login';
    });

    // Opened from an officer's rotating check-in QR (?checkin=<gameId>&code=<code>).
    const [qrCheckin, setQrCheckin] = useState(() => takeCheckinParams());

    const prospectiveCount = useMemo(
        () => splitApplications(data.members.filter(m => m.role === Role.PROSPECTIVE), data).active.length,
        [data.members, data.games, data.sports, data.attendance]
    );

    useEffect(() => {
        if (currentMember) {
            sessionStorage.setItem('bp_member', JSON.stringify(currentMember));
        } else {
            sessionStorage.removeItem('bp_member');
        }
        sessionStorage.setItem('bp_mode', mode);

        // Explicitly ensure modals are closed on view/identity shifts
        // This prevents "ghost" popups on refresh or login
        setShowSettingsModal(false);
        setShowInstructions(false);
        setShowQRCode(false);
        setShowSelfies(false);
        setShowSportsManager(false);
        setShowChantManager(false);
    }, [currentMember, mode]);

    // SECURITY FLAGGED: Do not select password column for all users
    const MEMBER_COLUMNS = 'id, first_name, last_name, role, years_in_bplt, email, phone, year, heard_about, referred_by, fall_sport_id, spring_sport_id, is_chair';
    // referred_by_id comes from 20261026_referral_points.sql. Until that's run the
    // select errors, so fall back to the old column list (referral points just stay 0).
    const fetchMembers = async () => {
        const res = await supabase.from('members').select(MEMBER_COLUMNS + ', referred_by_id');
        return res.error ? supabase.from('members').select(MEMBER_COLUMNS) : res;
    };

    // Split from selfies on purpose: selfies.image_data holds public Storage URLs
    // (photos bucket) for full-size images, so re-running that query on every unrelated realtime event (e.g. one
    // attendance toggle) would re-download every photo for every connected
    // client. fetchCoreData() covers everything else and is cheap to re-run.

    const fetchCoreData = async () => {
        const [
            { data: sports },
            { data: games },
            { data: members },
            { data: attendance },
            { data: bonusPoints },
            { data: selfieVotes },
            { data: emailTemplateRow },
            clubEventsRes,
            eventSignupsRes,
            gameRolesRes
        ] = await Promise.all([
            supabase.from('sports').select('*'),
            supabase.from('games').select('*'),
            fetchMembers(),
            supabase.from('attendance').select('*'),
            supabase.from('bonus_points').select('*'),
            supabase.from('selfie_votes').select('*'),
            // Falls back to null if the migration hasn't been run yet -- not fatal.
            supabase.from('email_templates').select('*').eq('id', 'prospective_welcome').maybeSingle(),
            // Falls back to empty if the club_events migration hasn't been run yet -- not fatal.
            supabase.from('club_events').select('*'),
            supabase.from('event_signups').select('*'),
            // Errors (no data) if the game_roles migration hasn't been run yet; gameRoles
            // stays null then, which hides the game-day roster UI. Not fatal.
            supabase.from('game_roles').select('*')
        ]);
        const clubEvents = clubEventsRes.data;
        const eventSignups = eventSignupsRes.data;

        const attendanceMap: Record<string, Record<string, boolean>> = {};
        attendance?.forEach((record: any) => {
            if (!attendanceMap[record.game_id]) attendanceMap[record.game_id] = {};
            attendanceMap[record.game_id][record.member_id] = true;
        });

        const mappedMembers: Member[] = (members || []).filter((m: any) => !HIDDEN_MEMBER_IDS.includes(m.id)).map((m: any) => ({
            id: m.id,
            firstName: m.first_name,
            lastName: m.last_name,
            role: (m.role.charAt(0).toUpperCase() + m.role.slice(1).toLowerCase()) as Role,
            yearsInBPLT: m.years_in_bplt,
            password: m.password, // This will be undefined now, which is safer
            email: m.email,
            phone: m.phone,
            year: m.year,
            heardAbout: m.heard_about,
            referredBy: m.referred_by,
            referredById: m.referred_by_id || undefined,
            fallSportId: m.fall_sport_id,
            springSportId: m.spring_sport_id,
            isChair: m.is_chair
        }));

        const mappedGames: Game[] = (games || []).map((g: any) => ({
            id: g.id,
            sportId: g.sport_id,
            date: g.date,
            time: g.time,
            opponent: g.opponent,
            location: g.location,
            isBonus: g.is_bonus,
            pointsValue: g.points_value || 1,
            description: g.description
        }));

        const mappedSports: Sport[] = (sports || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            attendanceThreshold: s.attendance_threshold || 0.5,
            venueIds: s.venue_ids || []
        }));

        const mappedEmailTemplate: EmailTemplate | null = emailTemplateRow ? {
            id: emailTemplateRow.id,
            subject: emailTemplateRow.subject,
            body: emailTemplateRow.body,
            meetingType: emailTemplateRow.meeting_type,
            meetingDate: emailTemplateRow.meeting_date,
            meetingTime: emailTemplateRow.meeting_time,
            meetingLocation: emailTemplateRow.meeting_location
        } : null;

        setData(prev => ({
            ...prev,
            members: mappedMembers,
            games: mappedGames,
            attendance: attendanceMap,
            sports: mappedSports,
            selfieVotes: (selfieVotes || []).map((v: any) => ({ selfieId: v.selfie_id, memberId: v.member_id })),
            // Only Excel-sheet points count while SHEET_ONLY_POINTS is on (see utils/fanTier.ts).
            bonusPoints: (bonusPoints || []).filter((b: any) => !SHEET_ONLY_POINTS || b.source === 'excel').map((b: any) => ({ id: b.id, memberId: b.member_id, points: b.points, reason: b.reason, date: b.date, category: b.category || 'Other' })),
            clubEvents: (clubEvents || []).map((e: any) => ({
                id: e.id, title: e.title, category: e.category || 'Marketing', date: e.date, time: e.time,
                location: e.location, maxSignups: e.max_signups ?? 2, pointsValue: e.points_value ?? 1, description: e.description
            })),
            eventSignups: (eventSignups || []).map((s: any) => ({ id: s.id, eventId: s.event_id, memberId: s.member_id, bonusPointId: s.bonus_point_id, timestamp: s.timestamp })),
            gameRoles: gameRolesRes.data ? gameRolesRes.data.map((r: any) => ({
                id: r.id, gameId: r.game_id, memberId: r.member_id, role: r.role,
                category: r.category || 'Game Day', points: r.points ?? 0, createdAt: r.created_at
            })) : null,
            emailTemplate: mappedEmailTemplate
        }));
    };

    const fetchSelfies = async () => {
        const { data: selfies } = await supabase.from('selfies').select('*');
        const mappedSelfies: Selfie[] = (selfies || []).map((s: any) => ({
            id: s.id,
            memberId: s.member_id,
            gameId: s.game_id,
            imageData: s.image_data,
            timestamp: s.timestamp
        }));
        setData(prev => ({ ...prev, selfies: mappedSelfies }));
    };

    const fetchData = async () => {
        setSyncStatus('syncing');
        try {
            await Promise.all([fetchCoreData(), fetchSelfies()]);
            setSyncStatus('success');
        } catch (error) {
            console.error("Error fetching data:", error);
            setSyncStatus('error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Realtime events arrive in bursts (game-day check-ins, bulk awards). Coalesce them with a
        // short trailing debounce so a burst triggers one refetch instead of one per event.
        let coreTimer: ReturnType<typeof setTimeout> | undefined;
        let selfiesTimer: ReturnType<typeof setTimeout> | undefined;
        const scheduleCoreRefetch = () => {
            clearTimeout(coreTimer);
            coreTimer = setTimeout(() => { fetchCoreData(); }, 300);
        };
        const scheduleSelfiesRefetch = () => {
            clearTimeout(selfiesTimer);
            selfiesTimer = setTimeout(() => { fetchSelfies(); }, 300);
        };
        const channels = supabase
            .channel('custom-all-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => scheduleCoreRefetch())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => scheduleCoreRefetch())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => scheduleCoreRefetch())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sports' }, () => scheduleCoreRefetch())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'selfies' }, () => scheduleSelfiesRefetch())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'email_templates' }, () => scheduleCoreRefetch())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_points' }, () => scheduleCoreRefetch())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'club_events' }, () => scheduleCoreRefetch())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'event_signups' }, () => scheduleCoreRefetch())
            .subscribe();
        return () => {
            clearTimeout(coreTimer);
            clearTimeout(selfiesTimer);
            supabase.removeChannel(channels);
        };
    }, []);

    // game_roles realtime gets its own channel, opened only once the table is
    // known to exist: subscribing to a missing table could break the shared
    // channel above for every other table.
    const gameRolesAvailable = data.gameRoles != null;
    useEffect(() => {
        if (!gameRolesAvailable) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const channel = supabase
            .channel('game-roles-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_roles' }, () => {
                clearTimeout(timer);
                timer = setTimeout(() => { fetchCoreData(); }, 300);
            })
            .subscribe();
        return () => {
            clearTimeout(timer);
            supabase.removeChannel(channel);
        };
    }, [gameRolesAvailable]);

    const handleLogin = (member: Member, password: string) => {
        setCurrentMember(member);
        currentPasswordRef.current = password;
        officerSession.memberId = member.id; officerSession.password = password; // check-in code screen
        setMode(member.role === Role.ADMIN ? 'dashboard' : 'member');
    };

    const handleGuestForm = () => setMode('form');

    const handleLogout = () => {
        setCurrentMember(null);
        currentPasswordRef.current = null;
        officerSession.memberId = null; officerSession.password = null;
        setMode('login');
        sessionStorage.removeItem('bp_member');
        sessionStorage.removeItem('bp_mode');
        window.history.replaceState({}, '', window.location.pathname);
    };

    // Returns an error message, or null on success (SettingsModal shows it).
    const handleUpdateProfile = async (updates: Partial<Member>, memberId?: string, actingPasswordOverride?: string): Promise<string | null> => {
        const idToUpdate = memberId || currentMember?.id;
        if (!idToUpdate) return 'No member selected.';

        try {
            // Password changes go through server-side RPCs -- the client
            // never writes to the password column directly (it can't; see
            // the column-level REVOKE in update_schema_v4_secure_login.sql).
            if (updates.password) {
                // Prefer the password typed into the modal: the login-time copy in
                // currentPasswordRef is lost whenever the page is refreshed.
                const actingPassword = actingPasswordOverride || currentPasswordRef.current;
                if (!actingPassword || !currentMember) {
                    return 'Please log out and back in before changing a password.';
                }

                const isSelf = idToUpdate === currentMember.id;
                const { data: ok, error: rpcError } = isSelf
                    ? await supabase.rpc('rpc_set_own_password', {
                        p_member_id: currentMember.id,
                        p_current_password: actingPassword,
                        p_new_password: updates.password
                    })
                    : await supabase.rpc('rpc_admin_set_password', {
                        p_admin_id: currentMember.id,
                        p_admin_password: actingPassword,
                        p_target_member_id: idToUpdate,
                        p_new_password: updates.password
                    });

                if (rpcError || !ok) {
                    return isSelf
                        ? 'Password not changed: your current password was incorrect.'
                        : 'Password not reset: your admin password was incorrect (or your account is not an Admin/Officer).';
                }

                if (isSelf) currentPasswordRef.current = updates.password;
            }

            const payload: any = {};
            if (updates.email !== undefined) payload.email = updates.email;
            if (updates.fallSportId !== undefined) payload.fall_sport_id = updates.fallSportId;
            if (updates.springSportId !== undefined) payload.spring_sport_id = updates.springSportId;
            if (updates.isChair !== undefined) payload.is_chair = updates.isChair;
            if (updates.referredById !== undefined) payload.referred_by_id = updates.referredById || null;

            if (Object.keys(payload).length > 0) {
                const { error } = await supabase.from('members').update(payload).eq('id', idToUpdate);
                if (error) throw error;
            }


            if (idToUpdate === currentMember?.id) {
                const refreshed: any = { ...currentMember, ...updates };
                delete refreshed.password; // never let a real password land in state/sessionStorage
                setCurrentMember(refreshed);
            }

            fetchCoreData();
            return null;
        } catch (e: any) { return "Error updating profile: " + e.message; }
    };

    const handleToggleAttendance = async (gameId: string, memberId: string) => {
        try {
            const isPresent = data.attendance[gameId]?.[memberId];
            setData(prev => {
                const newAttendance = { ...prev.attendance };
                if (!newAttendance[gameId]) newAttendance[gameId] = {};
                if (isPresent) delete newAttendance[gameId][memberId];
                else newAttendance[gameId][memberId] = true;
                return { ...prev, attendance: newAttendance };
            });
            if (isPresent) {
                await supabase.from('attendance').delete().match({ game_id: gameId, member_id: memberId });
            } else {
                await supabase.from('attendance').insert({ game_id: gameId, member_id: memberId });
            }
        } catch (e: any) { fetchCoreData(); }
    };

    const handleAddMember = async (newMember: Member) => {
        // Password is never written directly here (the client no longer has
        // insert/update privilege on that column -- see
        // update_schema_v4_secure_login.sql). Instead we attempt an
        // initial-password claim after the upsert -- rpc_claim_initial_password
        // only succeeds while that member's password is still unset, so this
        // is a safe no-op for existing members who already have one.
        //
        // Skipped entirely for Prospective role: this same function is called
        // from the public self-service "Interested in Joining?" form, where
        // the person submitting IS the new record -- they'd see their own
        // "temporary password" alert on their own phone, which is confusing
        // and pointless (prospects don't log in). Real members only get a
        // claimed password when they're actually created/approved as Member+.
        const payload: any = {
            id: newMember.id,
            first_name: newMember.firstName,
            last_name: newMember.lastName,
            role: newMember.role,
            years_in_bplt: newMember.yearsInBPLT,
            email: newMember.email
        };
        if (newMember.phone !== undefined) payload.phone = newMember.phone;
        if (newMember.year !== undefined) payload.year = newMember.year;
        if (newMember.heardAbout !== undefined) payload.heard_about = newMember.heardAbout;
        if (newMember.referredBy !== undefined) payload.referred_by = newMember.referredBy;
        if (newMember.referredById !== undefined) payload.referred_by_id = newMember.referredById;

        let { error } = await supabase.from('members').upsert(payload);
        // Retry without referred_by_id if the referral migration hasn't been run yet.
        if (error && 'referred_by_id' in payload) {
            delete payload.referred_by_id;
            ({ error } = await supabase.from('members').upsert(payload));
        }
        if (error) { alert('Error saving member: ' + error.message); return; }

        if (newMember.role !== Role.PROSPECTIVE) {
            const initialPassword = Math.random().toString(36).slice(-8);
            const { data: claimed, error: claimError } = await supabase.rpc('rpc_claim_initial_password', {
                p_member_id: newMember.id,
                p_new_password: initialPassword
            });
            if (!claimError && claimed) {
                alert(`Temporary password for ${newMember.firstName}: ${initialPassword}\n\nShare this with them -- they can change it once they log in.`);
            }
        }

        fetchCoreData();
    };

    const handleDeleteMember = async (id: string) => {
        if (window.confirm("Are you sure?")) await supabase.from('members').delete().eq('id', id);
    };

    const handleSaveEmailTemplate = async (template: EmailTemplate) => {
        const { error } = await supabase.from('email_templates').upsert({
            id: template.id,
            subject: template.subject,
            body: template.body,
            meeting_type: template.meetingType,
            meeting_date: template.meetingDate || null,
            meeting_time: template.meetingTime,
            meeting_location: template.meetingLocation
        });
        if (error) { alert('Error saving template: ' + error.message); return; }
        fetchCoreData();
    };

    const handleAddGame = async (game: Game) => {
        await supabase.from('games').upsert({
            id: game.id,
            sport_id: game.sportId,
            date: game.date,
            time: game.time,
            opponent: game.opponent,
            location: game.location,
            is_bonus: game.isBonus,
            points_value: game.pointsValue,
            description: game.description
        });
        await fetchCoreData();
    };

    const handleDeleteGame = async (id: string) => {
        if (window.confirm("Delete this game?")) await supabase.from('games').delete().eq('id', id);
    };

    const handleAddSport = async (name: string, venueIds: string[] = []): Promise<string> => {
        const id = 'sport_' + Date.now();
        await supabase.from('sports').insert({ id, name, venue_ids: venueIds });
        await fetchCoreData();
        return id;
    };

    const handleDeleteSport = async (id: string) => {
        if (window.confirm("Delete sport?")) await supabase.from('sports').delete().eq('id', id);
    };

    const handleFormSubmit = async (gameId: string, memberId: string, location: AttendanceLocation | null, newMember?: Member): Promise<string | null> => {
        if (newMember) await handleAddMember(newMember);
        if (newMember?.role === Role.PROSPECTIVE) return null;
        const { error } = await supabase.from('attendance').insert({
            game_id: gameId,
            member_id: memberId,
            latitude: location?.latitude ?? null,
            longitude: location?.longitude ?? null,
            accuracy_meters: location?.accuracyMeters ?? null,
            distance_meters: location?.distanceMeters ?? null,
            within_geofence: location?.withinGeofence ?? null,
        });
        if (error) {
            if (error.code === '23505') return "You're already checked in for this event.";
            console.error('Attendance insert failed', error);
            return "Check-in didn't save: " + error.message + ". Please try again or tell an officer.";
        }
        await fetchCoreData();
        return null;
    };

    const handleToggleSelfieVote = async (selfieId: string, memberId: string) => {
        const selfie = data.selfies.find(s => s.id === selfieId);
        if (!selfie) return;
        const voted = data.selfieVotes.some(v => v.memberId === memberId && v.selfieId === selfieId);
        if (voted) await supabase.from('selfie_votes').delete().match({ selfie_id: selfieId, member_id: memberId });
        else await supabase.from('selfie_votes').insert({ selfie_id: selfieId, member_id: memberId });
        fetchCoreData();
    };

    // Point/signup writes used to fire without checking the result, so a
    // failed save (bad connection, RLS) looked like success and the member
    // silently never got their points. Surface it instead.
    const pointsWriteFailed = (action: string, error: { message: string } | null) => {
        if (!error) return false;
        console.error(`${action} failed:`, error);
        alert(`${action} didn't save: ${error.message}. Nothing was changed, please try again.`);
        return true;
    };

    // --- Club Events (tabling signups etc) ---

    const handleAddClubEvent = async (event: Omit<ClubEvent, 'id'>) => {
        const { error } = await supabase.from('club_events').insert({
            title: event.title,
            category: event.category,
            date: event.date,
            time: event.time || null,
            location: event.location || null,
            max_signups: event.maxSignups,
            points_value: event.pointsValue,
            description: event.description || null,
        });
        if (pointsWriteFailed('Creating the event', error)) return;
        await fetchCoreData();
    };

    const handleDeleteClubEvent = async (id: string) => {
        if (window.confirm("Delete this event? Any existing signups (and the points they awarded) will be removed too.")) {
            const { error } = await supabase.from('club_events').delete().eq('id', id);
            pointsWriteFailed('Deleting the event', error);
            await fetchCoreData();
        }
    };

    // Signing up only reserves a slot. Points are paid when an officer marks
    // the member attended on the event day (components/ShiftAttendance.tsx),
    // so no-shows don't keep credit. Signups made before 2026-10-26 already
    // carry a bonus_point_id from the old pay-at-signup rule; those keep it.
    const handleSignUpForEvent = async (eventId: string, memberId: string) => {
        const event = data.clubEvents.find(e => e.id === eventId);
        if (!event) return;
        const alreadySignedUp = data.eventSignups.some(s => s.eventId === eventId && s.memberId === memberId);
        if (alreadySignedUp) return;
        const takenSlots = data.eventSignups.filter(s => s.eventId === eventId).length;
        if (takenSlots >= event.maxSignups) {
            alert("This event is already full.");
            return;
        }
        const { error: signupError } = await supabase.from('event_signups').insert({
            event_id: eventId,
            member_id: memberId,
        });
        if (signupError) {
            // The DB slot-limit trigger (20261012_event_signup_slot_limit.sql)
            // raises 'event_full' when someone else grabbed the last slot first.
            if (/event_full/i.test(signupError.message || '')) {
                alert('Sorry, this event just filled up. Someone else took the last slot.');
            } else {
                pointsWriteFailed('Signing up', signupError);
            }
        }
        await fetchCoreData();
    };

    // Cancelling a signup also reverses any points it carries (old
    // pay-at-signup rows, or an attended mark), so someone backing out of a
    // tabling shift doesn't keep credit for it. Most signups have none.
    const handleCancelSignup = async (signupId: string) => {
        const signup = data.eventSignups.find(s => s.id === signupId);
        if (!signup) return;
        const { error } = await supabase.from('event_signups').delete().eq('id', signupId);
        if (pointsWriteFailed('Cancelling the signup', error)) return;
        if (signup.bonusPointId) {
            const { error: bpError } = await supabase.from('bonus_points').delete().eq('id', signup.bonusPointId);
            pointsWriteFailed('Removing the signup points', bpError);
        }
        await fetchCoreData();
    };

    // Bulk-award the same category/points/reason to several members at
    // once -- for things an officer notices rather than a member
    // self-reports (hospitality duty, photography, etc), per the call's
    // "we could make an excel sheet... instead have officers log it".
    // Also used by Quick Award (QR scan) with a single member id; resolves
    // true when the insert succeeded so the scanner can show its toast.
    const handleBulkAwardPoints = async (memberIds: string[], points: number, reason: string, category: string) => {
        const rows = memberIds.map(memberId => ({
            member_id: memberId, points, reason, category, date: new Date().toISOString(),
        }));
        const { error } = await supabase.from('bonus_points').insert(rows);
        const failed = pointsWriteFailed('Bulk award', error);
        await fetchCoreData();
        return !failed;
    };

    // --- Game-day roster (game_roles) ---
    // Assigning a role writes no points: they're derived in utils/fanTier.ts
    // once the member also checks in to that game.
    const handleAddGameRole = async (role: Omit<GameRole, 'id' | 'createdAt'>) => {
        const { error } = await supabase.from('game_roles').insert({
            game_id: role.gameId,
            member_id: role.memberId,
            role: role.role,
            category: role.category,
            points: role.points,
        });
        if (error?.code === '23505') alert('That member already has that role for this game.');
        else pointsWriteFailed('Assigning the role', error);
        await fetchCoreData();
    };

    const handleDeleteGameRole = async (id: string) => {
        const { error } = await supabase.from('game_roles').delete().eq('id', id);
        pointsWriteFailed('Removing the role', error);
        await fetchCoreData();
    };

    // --- Media approval (photo gallery) ---
    // Approving a photo awards the uploader 'Media' points as a bonus_points
    // row keyed by the photo id in its reason. The DB is checked first (not
    // just local state) so two officers approving at once can't double-award.
    // Dated by the photo so the points land in the semester it was taken.
    const handleApproveMedia = async (selfie: Selfie, points: number) => {
        const reason = mediaApprovalReason(selfie.id);
        const { data: existing, error: lookupError } = await supabase.from('bonus_points').select('id').eq('reason', reason).limit(1);
        if (pointsWriteFailed('Approving the photo', lookupError)) return;
        if (!existing || existing.length === 0) {
            const { error } = await supabase.from('bonus_points').insert({
                member_id: selfie.memberId, points, reason, category: 'Media', date: selfie.timestamp || new Date().toISOString(),
            });
            pointsWriteFailed('Approving the photo', error);
        }
        await fetchCoreData();
    };

    // Deletes by reason, so it also clears any duplicate approvals of this photo.
    const handleRemoveMediaApproval = async (selfie: Selfie) => {
        const { error } = await supabase.from('bonus_points').delete().eq('reason', mediaApprovalReason(selfie.id));
        pointsWriteFailed('Removing the approval', error);
        await fetchCoreData();
    };

    const renderContent = () => {
        if (isLoading) return <div className="flex items-center justify-center h-full"><RefreshCw className="w-8 h-8 animate-spin text-green-700" /></div>;
        if (currentView === 'dashboard') return <Dashboard data={data} />;
        if (currentView === 'points') return <Leaderboard data={data} />;
        if (currentView === 'applications') return (
            <ApplicationsList
                data={data}
                onApprove={(memberId) => {
                    const m = data.members.find(mem => mem.id === memberId);
                    if (m) handleAddMember({ ...m, role: Role.MEMBER });
                }}
                onReject={handleDeleteMember}
                onSaveTemplate={handleSaveEmailTemplate}
                onLinkReferrer={(memberId, referrerId) => handleUpdateProfile({ referredById: referrerId }, memberId)}
            />
        );
        if (currentView === 'management') return (
            <Management
                members={data.members}
                games={data.games}
                sports={data.sports}
                bonusPoints={data.bonusPoints}
                onAddMember={handleAddMember}
                onDeleteMember={handleDeleteMember}
                onAddGame={handleAddGame}
                onDeleteGame={handleDeleteGame}
                onUpdateProfile={handleUpdateProfile}
                onAddBonusPoint={async (mid, pts, reason, category) => {
                    const { error } = await supabase.from('bonus_points').insert({ member_id: mid, points: pts, reason, category: category || 'Other', date: new Date().toISOString() });
                    pointsWriteFailed('Awarding points', error);
                    fetchCoreData();
                }}
                onDeleteBonusPoint={async (id) => {
                    const { error } = await supabase.from('bonus_points').delete().eq('id', id);
                    pointsWriteFailed('Deleting points', error);
                    fetchCoreData();
                }}
                onBulkAwardPoints={handleBulkAwardPoints}
                clubEvents={data.clubEvents}
                eventSignups={data.eventSignups}
                onAddClubEvent={handleAddClubEvent}
                onDeleteClubEvent={handleDeleteClubEvent}
                onAddSport={handleAddSport}
                userRole={currentMember?.role}
                gameRoles={data.gameRoles}
                attendance={data.attendance}
                onAddGameRole={handleAddGameRole}
                onDeleteGameRole={handleDeleteGameRole}
            />
        );
        const sport = data.sports.find(s => s.id === currentView);
        if (sport) return (
            <SportSheet
                sportName={sport.name}
                sportId={sport.id}
                games={data.games.filter(g => g.sportId === sport.id)}
                members={data.members}
                attendance={data.attendance}
                attendanceThreshold={sport.attendanceThreshold}
                onToggleAttendance={handleToggleAttendance}
                onUpdateThreshold={async (id, val) => {
                    await supabase.from('sports').update({ attendance_threshold: val }).eq('id', id);
                    fetchCoreData();
                }}
            />
        );
        return <Dashboard data={data} />;
    };

    if (isLoading) return <div className="h-screen bg-[#154734] flex items-center justify-center text-white"><RefreshCw className="w-10 h-10 animate-spin" /></div>;
    // QR check-in sits on top of whatever mode the visitor is in; Back drops
    // them where they were (still logged in, if they were).
    if (qrCheckin) return <AttendanceForm members={data.members} games={data.games} sports={data.sports} onSubmit={handleFormSubmit} onBack={() => setQrCheckin(null)} initialGameId={qrCheckin.gameId} initialCode={qrCheckin.code} initialMember={currentMember} />;
    if (mode === 'chants') return <ChantGallery onBack={() => setMode('login')} />;
    if (mode === 'login') return <Login members={data.members} onLogin={handleLogin} onGuest={handleGuestForm} onChants={() => setMode('chants')} onInterest={() => setMode('interest')} selfies={data.selfies} />;
    if (mode === 'form') return <AttendanceForm members={data.members} games={data.games} sports={data.sports} onSubmit={handleFormSubmit} onBack={handleLogout} />;
    if (mode === 'interest') return <InterestForm members={data.members} onSubmit={handleAddMember} onBack={handleLogout} />;
    if (mode === 'member' && currentMember) return (
        <Suspense fallback={<div className="h-screen bg-[#154734] flex items-center justify-center text-white"><RefreshCw className="w-10 h-10 animate-spin" /></div>}>
            <MemberPortal member={currentMember} data={data} onLogout={handleLogout} onUpdateProfile={handleUpdateProfile} onVote={handleToggleSelfieVote} sports={data.sports} onAddGame={handleAddGame} onDeleteGame={handleDeleteGame} onAddClubEvent={handleAddClubEvent} onDeleteClubEvent={handleDeleteClubEvent} onSignUpForEvent={handleSignUpForEvent} onCancelSignup={handleCancelSignup} onAddGameRole={handleAddGameRole} onDeleteGameRole={handleDeleteGameRole}
                onBulkAwardPoints={handleBulkAwardPoints} />
        </Suspense>
    );

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
            <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-[#154734] text-white transition-all duration-300 flex flex-col shadow-xl z-20 h-full overflow-y-auto`}>
                <div className="p-4 border-b border-green-900/50 flex items-center justify-between shrink-0 sticky top-0 bg-[#154734] z-10">
                    <div className="font-bold flex items-center gap-3 overflow-hidden whitespace-nowrap">
                        <div className="w-8 h-8 bg-white rounded flex items-center justify-center shrink-0 p-1"><img src={LOGO_URL} alt="BearPit logo" className="w-full h-full object-contain" /></div>
                        {isSidebarOpen && <span>BearPit Tracker</span>}
                    </div>
                </div>
                <nav className="p-0 space-y-1 mt-2">
                    <button onClick={() => setCurrentView('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 ${currentView === 'dashboard' ? 'bg-[#FFB81C] text-[#154734] font-bold' : 'text-gray-300'}`}><LayoutDashboard className="w-5 h-5" />{isSidebarOpen && <span>Dashboard</span>}</button>
                    <button onClick={() => setCurrentView('management')} className={`w-full flex items-center gap-3 px-4 py-3 ${currentView === 'management' ? 'bg-[#FFB81C] text-[#154734] font-bold' : 'text-gray-300'}`}><Users className="w-5 h-5" />{isSidebarOpen && <span>Manage</span>}</button>
                    <button onClick={() => setCurrentView('applications')} className={`w-full flex items-center gap-3 px-4 py-3 ${currentView === 'applications' ? 'bg-[#FFB81C] text-[#154734] font-bold' : 'text-gray-300'}`}>
                        <Mail className="w-5 h-5" />
                        {isSidebarOpen && <span>Applications</span>}
                        {prospectiveCount > 0 && (
                            <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${currentView === 'applications' ? 'bg-[#154734] text-white' : 'bg-[#FFB81C] text-[#154734]'} ${isSidebarOpen ? 'ml-auto' : ''}`}>
                                {prospectiveCount}
                            </span>
                        )}
                    </button>
                    <button onClick={() => setCurrentView('points')} className={`w-full flex items-center gap-3 px-4 py-3 ${currentView === 'points' ? 'bg-[#FFB81C] text-[#154734] font-bold' : 'text-gray-300'}`}><TableProperties className="w-5 h-5" />{isSidebarOpen && <span>Standings</span>}</button>
                    {data.sports?.map(sport => (<button key={sport.id} onClick={() => setCurrentView(sport.id)} className={`w-full flex items-center gap-3 px-4 py-3 ${currentView === sport.id ? 'bg-[#FFB81C] text-[#154734] font-bold' : 'text-gray-300'}`}>{getSportIcon(sport.id)}{isSidebarOpen && <span>{sport.name}</span>}</button>))}
                </nav>
                <div className="p-4 border-t border-green-900/50 space-y-1 mt-auto">
                    <button onClick={() => setShowSettingsModal(true)} className="w-full flex items-center gap-3 px-2 py-2 text-gray-300 hover:text-white transition-colors text-left"><User className="w-5 h-5" />{isSidebarOpen && <span>Personal Profile</span>}</button>
                    <button onClick={() => setShowSportsManager(true)} className="w-full flex items-center gap-3 px-2 py-2 text-gray-300 hover:text-white transition-colors text-left"><Dumbbell className="w-5 h-5" />{isSidebarOpen && <span>Sports Manager</span>}</button>
                    <button onClick={() => setShowSelfies(true)} className="w-full flex items-center gap-3 px-2 py-2 text-gray-300 hover:text-white transition-colors text-left"><Camera className="w-5 h-5" />{isSidebarOpen && <span>Gallery</span>}</button>
                    <button onClick={() => setShowQRCode(true)} className="w-full flex items-center gap-3 px-2 py-2 text-gray-300 hover:text-white transition-colors text-left"><QrCode className="w-5 h-5" />{isSidebarOpen && <span>QR Code</span>}</button>
                    <button onClick={() => setShowChantManager(true)} className="w-full flex items-center gap-3 px-2 py-2 text-gray-300 hover:text-white transition-colors text-left"><Music className="w-5 h-5" />{isSidebarOpen && <span>Chants</span>}</button>
                    <button onClick={() => setShowInstructions(true)} className="w-full flex items-center gap-3 px-2 py-2 text-gray-300 hover:text-white transition-colors text-left"><Settings className="w-5 h-5" />{isSidebarOpen && <span>Admin Settings</span>}</button>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-2 py-2 text-red-300 hover:text-red-400 mt-2 text-left"><LogOut className="w-5 h-5" />{isSidebarOpen && <span>Sign Out</span>}</button>
                </div>
            </aside>
            <main className="flex-1 overflow-auto p-4 relative">
                <Suspense fallback={<div className="flex items-center justify-center h-full"><RefreshCw className="w-8 h-8 animate-spin text-green-700" /></div>}>
                    {renderContent()}
                </Suspense>
            </main>
            <QRCodeDisplay isOpen={showQRCode} onClose={() => setShowQRCode(false)} publicUrl={data.settings.publicUrl} />
            <Instructions isOpen={showInstructions} onClose={() => setShowInstructions(false)} sheetUrl="" onSaveUrl={() => { }} onSaveSettings={() => { }} />
            <Suspense fallback={null}>
                {currentMember && (
                    <SelfieGallery isOpen={showSelfies} onClose={() => setShowSelfies(false)} selfies={data.selfies} members={data.members} games={data.games} sports={data.sports} onDelete={async (id) => await supabase.from('selfies').delete().eq('id', id)} onVote={handleToggleSelfieVote} bonusPoints={data.bonusPoints} currentMember={currentMember} selfieVotes={data.selfieVotes} onApproveMedia={handleApproveMedia} onRemoveMediaApproval={handleRemoveMediaApproval} />
                )}
                <SportsManager isOpen={showSportsManager} onClose={() => setShowSportsManager(false)} sports={data.sports} games={data.games} onAddSport={handleAddSport} onDeleteSport={handleDeleteSport} onUpdateSportVenues={async (id, vids) => await supabase.from('sports').update({ venue_ids: vids }).eq('id', id)} />
                <ChantManager isOpen={showChantManager} onClose={() => setShowChantManager(false)} />
            </Suspense>
            {currentMember && (
                <SettingsModal
                    isOpen={showSettingsModal}
                    onClose={() => setShowSettingsModal(false)}
                    member={currentMember}
                    sports={data.sports}
                    onUpdateProfile={handleUpdateProfile}
                />
            )}
        </div>
    );
}

export default App;
