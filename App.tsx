import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_STATE, LOGO_URL } from './constants';
import { AppState, Member, Game, Selfie, Role, Sport, BonusPoint, SelfieVote } from './types';
import { SportSheet } from './components/SportSheet';
import { Dashboard } from './components/Dashboard';
import { Management } from './components/Management';
import { Login } from './components/Login';
import { AttendanceForm } from './components/AttendanceForm';
import { MemberPortal } from './components/MemberPortal';
import { Instructions } from './components/Instructions';
import { QRCodeDisplay } from './components/QRCodeDisplay';
import { SelfieGallery } from './components/SelfieGallery';
import { SportsManager } from './components/SportsManager';
import { Leaderboard } from './components/Leaderboard';
import { SettingsModal } from './components/SettingsModal';
import { ChantGallery } from './components/ChantGallery';
import { supabase } from './utils/supabaseClient';
import {
    LayoutDashboard,
    Users,
    Menu,
    Volleyball,
    Goal,
    Trophy,
    LogOut,
    Settings,
    QrCode,
    Camera,
    Cloud,
    CloudOff,
    Dumbbell,
    TableProperties,
    RefreshCw,
    List, // added
    Calendar // added
} from 'lucide-react';

// Helper to get icon for sport
// Helper to get icon for sport
const getSportIcon = (id: string) => {
    // Consistent Icon: Trophy for everything, or distinct if requested. 
    // User asked: "either all specific to their sport, or all trophies"
    // Let's stick to trophies for consistency if specificity is hard, but we have specific icons.
    // Let's just use Trophy for generic and specific for known. 
    // Actually, "all specific... OR all trophies". Let's do Trophies for a unified look as requested "consistent".
    return <Trophy className="w-4 h-4" />;
};

function App() {
    // State
    const [data, setData] = useState<AppState>(INITIAL_STATE);
    const [isLoading, setIsLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');

    // User State
    const [currentMember, setCurrentMember] = useState<Member | null>(null);

    // Navigation
    const [currentView, setCurrentView] = useState<string>('dashboard');
    const [isSidebarOpen, setSidebarOpen] = useState(true);

    // Modals
    const [showInstructions, setShowInstructions] = useState(false);
    const [showQRCode, setShowQRCode] = useState(false);
    const [showSelfies, setShowSelfies] = useState(false);
    const [showSportsManager, setShowSportsManager] = useState(false);
    const [showPasswordChange, setShowPasswordChange] = useState(false);

    const [mode, setMode] = useState<'login' | 'dashboard' | 'member' | 'form' | 'chants'>(() => {
        const savedMode = sessionStorage.getItem('bp_mode');
        return (savedMode as any) || 'login';
    });

    // --- Persist Session ---
    useEffect(() => {
        if (currentMember) {
            sessionStorage.setItem('bp_member', JSON.stringify(currentMember));
        } else {
            sessionStorage.removeItem('bp_member');
        }
        sessionStorage.setItem('bp_mode', mode);
    }, [currentMember, mode]);

    // Restore member on mount
    useEffect(() => {
        const savedMember = sessionStorage.getItem('bp_member');
        if (savedMember) {
            try {
                const parsed = JSON.parse(savedMember);
                setCurrentMember(parsed);
            } catch (e) {
                console.error("Failed to parse saved member", e);
            }
        }
    }, []);

    // --- Applications Component (Internal) ---
    const ApplicationsList = () => {
        // Filter Members with Role = PROSPECTIVE
        // We need to link them to the game they attended.
        // We find their attendance record.
        const prospective = data.members.filter(m => m.role === Role.PROSPECTIVE);

        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-700">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-[#154734]">Membership Applications</h2>
                        <p className="text-gray-500 text-sm">Prospective members who captured info at a game.</p>
                    </div>
                </div>
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                        <tr>
                            <th className="px-6 py-3">Timestamp / Date</th>
                            <th className="px-6 py-3">Name</th>
                            <th className="px-6 py-3">Email</th>
                            <th className="px-6 py-3">Game Attended</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {prospective.map(m => {
                            // Find game they attended (naive check: first game found in attendance)
                            const gameId = Object.keys(data.attendance).find(gid => data.attendance[gid][m.id]);
                            const game = data.games.find(g => g.id === gameId);
                            // Timestamp isn't stored on member, but we can assume "Now" relative to creation or just show Game Date

                            return (
                                <tr key={m.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-gray-500">
                                        {game ? game.date : 'Unknown'}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-900">{m.firstName} {m.lastName}</td>
                                    <td className="px-6 py-4 text-blue-600">{m.email || 'No Email'}</td>
                                    <td className="px-6 py-4">
                                        {game ? (
                                            <span className="flex items-center gap-1">
                                                {game.opponent} <span className="text-xs text-gray-400">({game.sportId})</span>
                                            </span>
                                        ) : 'No Attendance Found'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => {
                                                if (window.confirm("Approve member? Role will change to Member.")) {
                                                    handleAddMember({ ...m, role: Role.MEMBER });
                                                }
                                            }}
                                            className="text-green-600 hover:text-green-800 font-bold mr-3"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleDeleteMember(m.id)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            Reject
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {prospective.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-400 italic">No pending applications.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        );
    };

    // --- Supabase Data Loading ---
    const fetchData = async () => {
        setSyncStatus('syncing');
        try {
            const [
                { data: sports },
                { data: games },
                { data: members },
                { data: attendance },
                { data: selfies },
                { data: bonusPoints },
                { data: selfieVotes }
            ] = await Promise.all([
                supabase.from('sports').select('*'),
                supabase.from('games').select('*'),
                supabase.from('members').select('*'),
                supabase.from('attendance').select('*'),
                supabase.from('selfies').select('*'),
                supabase.from('bonus_points').select('*'),
                supabase.from('selfie_votes').select('*')
            ]);

            // Transform Attendance Flat List -> Nested Object
            const attendanceMap: Record<string, Record<string, boolean>> = {};
            attendance?.forEach((record: any) => {
                if (!attendanceMap[record.game_id]) {
                    attendanceMap[record.game_id] = {};
                }
                attendanceMap[record.game_id][record.member_id] = true;
            });

            // Map DB columns to App Types if needed (snake_case -> camelCase)
            // But we can just use the spread if column names match or we map manually
            // Our schema used: first_name, last_name, sport_id, etc.

            const mappedMembers: Member[] = (members || []).map((m: any) => ({
                id: m.id,
                firstName: m.first_name,
                lastName: m.last_name,
                role: (m.role.charAt(0).toUpperCase() + m.role.slice(1).toLowerCase()) as Role,
                yearsInBPLT: m.years_in_bplt,
                password: m.password,
                email: m.email,
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
                pointsValue: g.points_value || 1, // Default 1
                description: g.description
            }));

            const mappedSelfies: Selfie[] = (selfies || []).map((s: any) => ({
                id: s.id,
                memberId: s.member_id,
                gameId: s.game_id,
                imageData: s.image_data,
                timestamp: s.timestamp
            }));

            const mappedSports: Sport[] = (sports || []).map((s: any) => ({
                id: s.id,
                name: s.name,
                attendanceThreshold: s.attendance_threshold || 0.5,
                venueIds: s.venue_ids || []
            }));

            const mappedSelfieVotes: SelfieVote[] = (selfieVotes || []).map((v: any) => ({
                selfieId: v.selfie_id,
                memberId: v.member_id
            }));

            const mappedBonusPoints: BonusPoint[] = (bonusPoints || []).map((b: any) => ({
                id: b.id,
                memberId: b.member_id,
                points: b.points,
                reason: b.reason,
                date: b.date
            }));

            setData(prev => ({
                ...prev,
                members: mappedMembers,
                games: mappedGames,
                attendance: attendanceMap,
                sports: mappedSports,
                selfies: mappedSelfies,
                selfieVotes: mappedSelfieVotes,
                bonusPoints: mappedBonusPoints
            }));

            setSyncStatus('success');
            setIsLoading(false);

        } catch (error) {
            console.error("Error fetching data:", error);
            setSyncStatus('error');
            setIsLoading(false);
        }
    };

    // Initial Load & Realtime Subscription
    useEffect(() => {
        fetchData();

        // Subscribe to changes on all tables
        const channels = supabase
            .channel('custom-all-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sports' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'selfies' }, () => fetchData())
            .subscribe();

        return () => {
            supabase.removeChannel(channels);
        };
    }, []);

    // Reward Automation: Process winners when Admin logs in
    useEffect(() => {
        if (currentMember?.role === Role.ADMIN) {
            processSelfieWinners();
        }
    }, [currentMember, data.selfies, data.selfieVotes, data.bonusPoints]);

    const processSelfieWinners = async () => {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Games older than a week that HAVE selfies
        const eligibleGames = data.games.filter(g => {
            const gameDate = new Date(g.date);
            const hasSelfies = data.selfies.some(s => s.gameId === g.id);
            const alreadyProcessed = data.bonusPoints.some(b => b.reason.includes(`Selfie of the week: ${g.id}`));
            return gameDate < oneWeekAgo && hasSelfies && !alreadyProcessed;
        });

        for (const game of eligibleGames) {
            const gameSelfies = data.selfies.filter(s => s.gameId === game.id);
            if (gameSelfies.length === 0) continue;

            const selfieScores = gameSelfies.map(s => ({
                selfie: s,
                votes: data.selfieVotes.filter(v => v.selfieId === s.id).length
            })).sort((a, b) => b.votes - a.votes);

            const winner = selfieScores[0].selfie;
            console.log(`Awarding Selfie of the Week for ${game.opponent} to ${winner.memberId}`);

            await handleAddBonusPoint(winner.memberId, 1, `Selfie of the week: ${game.id}`);
        }
    };


    // Check for URL Query Params (for QR Code direct link)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('mode') === 'form') {
            setMode('form');
        }
    }, []);


    // --- Handlers (Now Writing to Supabase) ---

    const handleLogin = (member: Member) => {
        setCurrentMember(member);
        if (member.role === Role.ADMIN) {
            setMode('dashboard');
        } else {
            setMode('member');
        }
    };

    const handleGuestForm = () => {
        setMode('form');
    };

    const handleLogout = () => {
        setCurrentMember(null);
        setMode('login');
        window.history.replaceState({}, '', window.location.pathname);
    };

    const handleUpdateProfile = async (updates: Partial<Member>) => {
        if (!currentMember) return;

        try {
            const payload: any = {};
            if (updates.password) payload.password = updates.password;
            if (updates.email !== undefined) payload.email = updates.email;
            if (updates.fallSportId !== undefined) payload.fall_sport_id = updates.fallSportId;
            if (updates.springSportId !== undefined) payload.spring_sport_id = updates.springSportId;
            if (updates.isChair !== undefined) payload.is_chair = updates.isChair;

            const { error } = await supabase.from('members').update(payload).eq('id', currentMember.id);
            if (error) throw error;

            alert("Profile updated successfully!");
            fetchData(); // Refresh data
        } catch (e: any) {
            console.error(e);
            alert("Error updating profile: " + e.message);
        }
    };

    const handleToggleAttendance = async (gameId: string, memberId: string) => {
        try {
            const isPresent = data.attendance[gameId]?.[memberId];

            // Optimistic / Immediate Local Update
            setData(prev => {
                const newAttendance = { ...prev.attendance };
                if (!newAttendance[gameId]) newAttendance[gameId] = {};

                if (isPresent) {
                    delete newAttendance[gameId][memberId];
                } else {
                    newAttendance[gameId][memberId] = true;
                }
                return { ...prev, attendance: newAttendance };
            });

            if (isPresent) {
                const { error } = await supabase
                    .from('attendance')
                    .delete()
                    .match({ game_id: gameId, member_id: memberId });
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('attendance')
                    .insert({ game_id: gameId, member_id: memberId });
                if (error) {
                    if (error.code === '23505') {
                        console.warn("Attendance already exists. Ensuring local state is set to true.");
                        // Ensure local state is definitely presence=true (it should be allowed by the optimistic update above)
                    } else {
                        // If it failed for another reason, Revert local state
                        throw error;
                    }
                }
            }
        } catch (e: any) {
            console.error("Attendance toggle error", e);
            alert("Error updating attendance: " + (e.message || e.details || "Unknown error"));

            // Revert on error
            // (Re-fetching data is the safest way to revert to truth)
            fetchData();
        }
    };

    const handleAddMember = async (newMember: Member) => {
        const payload = {
            id: newMember.id,
            first_name: newMember.firstName,
            last_name: newMember.lastName,
            role: newMember.role,
            years_in_bplt: newMember.yearsInBPLT,
            email: newMember.email,
            password: newMember.password || 'BPLT'
        };

        const { error } = await supabase.from('members').upsert(payload);
        if (error) {
            console.error("Error adding member", error);
            alert("Error saving member: " + error.message);
        }
    };

    const handleDeleteMember = async (id: string) => {
        if (window.confirm("Are you sure? This will also unenroll them from all games.")) {
            await supabase.from('members').delete().eq('id', id);
        }
    };

    const handleAddGame = async (game: Game) => {
        try {
            // Try inserting with all fields (including new schema fields)
            const { error } = await supabase.from('games').upsert({
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

            if (error) throw error;
            await fetchData();
        } catch (e: any) {
            console.error("Initial save failed, trying fallback...", e);

            // Fallback: If 'points_value' column doesn't exist, try saving without it
            if (e.message?.includes('points_value') || e.code === '42703') { // 42703 is Undefined Column
                try {
                    const { error: retryError } = await supabase.from('games').upsert({
                        id: game.id,
                        sport_id: game.sportId,
                        date: game.date,
                        time: game.time,
                        opponent: game.opponent,
                        location: game.location,
                        is_bonus: game.isBonus,
                        // points_value omitted
                        description: game.description
                    });

                    if (retryError) throw retryError;

                    alert("Game saved! (Note: 'Points Value' was ignored because your database needs an update. Please run the update_schema.sql script in Supabase.)");
                    await fetchData();
                    return;
                } catch (retryE: any) {
                    alert('Error saving game (Fallback failed): ' + retryE.message);
                }
            } else {
                alert('Error saving game: ' + e.message);
            }
        }
    };

    // Alias for edit (reusing upsert logic)
    const handleEditGame = handleAddGame;

    const handleDeleteGame = async (id: string) => {
        if (window.confirm("Delete this game?")) {
            await supabase.from('games').delete().eq('id', id);
        }
    };

    const handleAddSport = async (name: string, venueIds: string[] = []): Promise<string> => {
        const id = 'sport_' + Date.now();
        await supabase.from('sports').insert({
            id,
            name,
            venue_ids: venueIds
        });
        await fetchData();
        return id;
    };

    const handleUpdateSportVenues = async (id: string, venueIds: string[]) => {
        await supabase.from('sports').update({ venue_ids: venueIds }).eq('id', id);
        await fetchData();
    };

    const handleDeleteSport = async (id: string) => {
        if (window.confirm("Delete sport? This will remove all associated games.")) {
            await supabase.from('sports').delete().eq('id', id);
        }
    };

    const handleFormSubmit = async (gameId: string, memberId: string, newMember?: Member, selfie?: Selfie) => {
        try {
            if (newMember) {
                await handleAddMember(newMember); // Insert member first
            }

            // If prospective, stop here (handled by handleAddMember upserting the role)
            if (newMember?.role === Role.PROSPECTIVE) {
                return;
            }

            // Record Attendance
            await supabase.from('attendance').insert({
                game_id: gameId,
                member_id: memberId
            });

            // Save Selfies (if any)
            // 'selfie' arg is now treated as Selfie[]
            // We cast it:
            const selfyArray = Array.isArray(selfie) ? selfie : (selfie ? [selfie] : []);

            for (const s of selfyArray) {
                if (s.imageData.startsWith('data:')) {
                    const timestamp = Date.now();
                    const randomId = Math.random().toString(36).substring(7);
                    // Upload Loop
                    const res = await fetch(s.imageData);
                    const blob = await res.blob();
                    // ... (rest of logic per image)
                    const game = data.games.find(g => g.id === gameId);
                    const sportId = game ? game.sportId : 'unknown';
                    const filePath = `${sportId}/${gameId}/${timestamp}_${randomId}.jpg`;

                    const { error: uploadError } = await supabase.storage.from('photos').upload(filePath, blob);
                    if (uploadError) {
                        console.error("Storage upload error:", uploadError);
                        alert("Storage upload failed: " + uploadError.message + " (Path: " + filePath + ")");
                    } else {
                        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filePath);
                        const { error: dbError } = await supabase.from('selfies').insert({
                            id: s.id,
                            member_id: memberId,
                            game_id: gameId,
                            image_data: urlData.publicUrl,
                            timestamp: s.timestamp
                        });
                        if (dbError) {
                            console.error("Selfie DB insert error:", dbError);
                            alert("Selfie database entry failed: " + dbError.message);
                        }
                    }
                }
            }
            await fetchData(); // Refresh to see new data
        } catch (e: any) {
            console.error("Form submit error", e);
            alert("Error submitting form: " + e.message);
        }
    };

    const handleDeleteSelfie = async (selfieId: string, imageUrl: string) => {
        if (!window.confirm("Are you sure you want to delete this photo permanently?")) return;

        try {
            // 1. Delete from Database
            const { error: dbError } = await supabase
                .from('selfies')
                .delete()
                .eq('id', selfieId);

            if (dbError) throw dbError;

            // 2. Delete from Storage (if it is a storage URL)
            if (imageUrl.includes('supabase.co')) {
                // Extract path from URL:  .../storage/v1/object/public/photos/vb/game_123/file.jpg
                const urlObj = new URL(imageUrl);
                const pathParts = urlObj.pathname.split('/photos/');
                if (pathParts.length > 1) {
                    const storagePath = pathParts[1]; // vb/game_123/file.jpg
                    const decodedPath = decodeURIComponent(storagePath);
                    const { error: storageError } = await supabase.storage
                        .from('photos')
                        .remove([decodedPath]);

                    if (storageError) console.error("Storage delete warning:", storageError);
                }
            }
        } catch (e: any) {
            console.error("Delete error", e);
            alert("Error deleting photo: " + e.message);
        }
    };

    const handleAddBonusPoint = async (memberId: string, points: number, reason: string) => {
        try {
            const { error } = await supabase.from('bonus_points').insert({
                member_id: memberId,
                points,
                reason
            });
            if (error) throw error;
        } catch (e: any) {
            console.error("Error adding bonus points", e);
            alert("Error: " + e.message);
        }
    };

    const handleDeleteBonusPoint = async (id: string) => {
        if (!window.confirm("Remove these points?")) return;
        try {
            const { error } = await supabase.from('bonus_points').delete().eq('id', id);
            if (error) throw error;
        } catch (e: any) {
            console.error("Error deleting bonus point", e);
            alert("Error: " + e.message);
        }
    };

    const handleToggleSelfieVote = async (selfieId: string, memberId: string) => {
        try {
            const selfie = data.selfies.find(s => s.id === selfieId);
            if (!selfie) return;

            const gameId = selfie.gameId;
            const existingVotesInGame = data.selfieVotes.filter(v =>
                v.memberId === memberId &&
                data.selfies.find(s => s.id === v.selfieId)?.gameId === gameId
            );

            const hasVotedForThis = existingVotesInGame.some(v => v.selfieId === selfieId);

            if (hasVotedForThis) {
                // Remove Vote
                await supabase.from('selfie_votes')
                    .delete()
                    .match({ selfie_id: selfieId, member_id: memberId });
            } else {
                // If they voted for ANOTHER selfie in this game, block them
                if (existingVotesInGame.length > 0) {
                    alert("You can only vote for one photo per game!");
                    return;
                }

                // Add Vote
                await supabase.from('selfie_votes')
                    .insert({ selfie_id: selfieId, member_id: memberId });
            }
            fetchData();
        } catch (e: any) {
            console.error("Selfie vote error", e);
        }
    };

    const handleSaveSettings = (password: string, publicUrl: string) => {
        // In a real app, 'adminPassword' implies managing a global config.
        // For Supabase, we might store this in a 'settings' table.
        // For now, we'll just acknowledge it.
        console.log("Settings updated locally");
    };

    const renderContent = () => {
        if (isLoading) return <div className="flex items-center justify-center h-full"><RefreshCw className="w-8 h-8 animate-spin text-green-700" /></div>;

        if (currentView === 'dashboard') return <Dashboard data={data} />;
        if (currentView === 'points') return <Leaderboard data={data} />;
        if (currentView === 'applications') return <ApplicationsList />;
        if (currentView === 'management') return (
            <Management
                members={data.members}
                games={data.games}
                sports={data.sports}
                bonusPoints={data.bonusPoints || []}
                onAddMember={handleAddMember}
                onDeleteMember={handleDeleteMember}
                onAddGame={handleAddGame}
                onDeleteGame={handleDeleteGame}
                onUpdateGame={handleEditGame}
                onUpdateProfile={handleUpdateProfile}
                onAddSport={handleAddSport}
                onUpdateSport={async (sport) => {
                    await supabase.from('sports').update({ attendance_threshold: sport.attendanceThreshold }).eq('id', sport.id);
                    await fetchData();
                }}
                userRole={currentMember?.role}
            />
        );

        const sport = data.sports.find(s => s.id === currentView);
        if (sport) {
            const sportGames = data.games.filter(g => g.sportId === sport.id);
            return (
                <SportSheet
                    sportName={sport.name}
                    sportId={sport.id}
                    games={sportGames}
                    members={data.members}
                    attendance={data.attendance}
                    attendanceThreshold={sport.attendanceThreshold}
                    onToggleAttendance={handleToggleAttendance}
                    onUpdateThreshold={async (id, val) => {
                        await supabase.from('sports').update({ attendance_threshold: val }).eq('id', id);
                        // Update local state to reflect change immediately if possible, or refetch
                        const updatedSports = data.sports.map(s => s.id === id ? { ...s, attendanceThreshold: val } : s);
                        setData(prev => ({ ...prev, sports: updatedSports }));
                    }}
                />
            );
        }

        return <Dashboard data={data} />;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#154734] text-white">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-10 h-10 animate-spin" />
                    <p className="font-bold text-lg">Loading BearPit Data...</p>
                </div>
            </div>
        );
    }

    if (mode === 'chants') {
        return <ChantGallery onBack={() => setMode('login')} />;
    }

    if (mode === 'login') {
        return <Login
            members={data.members || []}
            onLogin={handleLogin}
            onGuest={handleGuestForm}
            onChants={() => setMode('chants')}
            selfies={data.selfies || []}
        />;
    }

    if (mode === 'form') {
        return <AttendanceForm
            members={data.members || []}
            games={data.games || []}
            sports={data.sports || []}
            onSubmit={handleFormSubmit}
            onBack={handleLogout}
        />;
    }

    if (mode === 'member' && currentMember) {
        return (
            <MemberPortal
                member={currentMember}
                data={data}
                onLogout={handleLogout}
                onUpdateProfile={handleUpdateProfile}
                onAddGame={currentMember.role === Role.OFFICER || currentMember.role === Role.ADMIN ? handleAddGame : undefined}
                onDeleteGame={currentMember.role === Role.OFFICER || currentMember.role === Role.ADMIN ? handleDeleteGame : undefined}
                onVote={handleToggleSelfieVote}
                sports={data.sports}
            />
        );
    }

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
            {/* Scrollable Sidebar Container */}
            <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-[#154734] text-white transition-all duration-300 flex flex-col shadow-xl z-20 h-full overflow-y-auto`}>
                {/* Header - Shrink 0 */}
                <div className="p-4 border-b border-green-900/50 flex items-center justify-between shrink-0 sticky top-0 bg-[#154734] z-10">
                    <div className={`font-bold flex items-center gap-3 overflow-hidden whitespace-nowrap ${!isSidebarOpen && 'justify-center w-full'}`}>
                        <div className="w-8 h-8 bg-white rounded flex items-center justify-center shrink-0 overflow-hidden p-1">
                            <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        {isSidebarOpen && <span>BearPit Tracker</span>}
                    </div>
                    <button onClick={() => setSidebarOpen(!isSidebarOpen)} className={`p-1 hover:bg-white/10 rounded ${!isSidebarOpen && 'hidden'}`}>
                        <Menu className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation Items */}
                <nav className="p-0 space-y-1 mt-2">
                    <button
                        onClick={() => setCurrentView('dashboard')}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors ${currentView === 'dashboard' ? 'bg-[#FFB81C] text-[#154734] font-bold' : 'text-gray-300'}`}
                    >
                        <LayoutDashboard className="w-5 h-5 shrink-0" />
                        {isSidebarOpen && <span>Dashboard</span>}
                    </button>
                    <button
                        onClick={() => setCurrentView('management')}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors ${currentView === 'management' ? 'bg-[#FFB81C] text-[#154734] font-bold' : 'text-gray-300'}`}
                    >
                        <Users className="w-5 h-5 shrink-0" />
                        {isSidebarOpen && <span>Manage</span>}
                    </button>
                    <button
                        onClick={() => setCurrentView('points')}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors ${currentView === 'points' ? 'bg-[#FFB81C] text-[#154734] font-bold' : 'text-gray-300'}`}
                    >
                        <TableProperties className="w-5 h-5 shrink-0" />
                        {isSidebarOpen && <span>Standings</span>}
                    </button>

                    <div className={`pt-4 pb-2 px-4 text-xs font-bold text-green-400 uppercase tracking-wider ${!isSidebarOpen && 'hidden'}`}>
                        Sports
                    </div>
                    {data.sports?.map(sport => (
                        <button
                            key={sport.id}
                            onClick={() => setCurrentView(sport.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors ${currentView === sport.id ? 'bg-[#FFB81C] text-[#154734] font-bold' : 'text-gray-300'}`}
                        >
                            {getSportIcon(sport.id)}
                            {isSidebarOpen && <span className="truncate">{sport.name}</span>}
                        </button>
                    ))}
                </nav>

                {/* Footer Links */}
                <div className="p-4 border-t border-green-900/50 space-y-2 mt-auto">
                    <div className={`text-xs font-bold text-green-400 uppercase tracking-wider mb-2 ${!isSidebarOpen && 'hidden'}`}>Admin</div>

                    <button
                        onClick={() => setShowSelfies(true)}
                        className="w-full flex items-center gap-3 px-2 py-2 hover:bg-white/10 transition-colors text-gray-300 rounded"
                    >
                        <Camera className="w-5 h-5 shrink-0" />
                        {isSidebarOpen && <span className="text-sm">Gallery</span>}
                    </button>

                    <button
                        onClick={() => setShowQRCode(true)}
                        className="w-full flex items-center gap-3 px-2 py-2 hover:bg-white/10 transition-colors text-gray-300 rounded"
                    >
                        <QrCode className="w-5 h-5 shrink-0" />
                        {isSidebarOpen && <span className="text-sm">QR Code</span>}
                    </button>

                    <button
                        onClick={() => setShowSportsManager(true)}
                        className="w-full flex items-center gap-3 px-2 py-2 hover:bg-white/10 transition-colors text-gray-300 rounded"
                    >
                        <Dumbbell className="w-5 h-5 shrink-0" />
                        {isSidebarOpen && <span className="text-sm">Sports</span>}
                    </button>

                    <button
                        onClick={() => setShowPasswordChange(true)}
                        className="w-full flex items-center gap-3 px-2 py-2 hover:bg-white/10 transition-colors text-gray-300 rounded"
                    >
                        <Settings className="w-5 h-5 shrink-0" />
                        {isSidebarOpen && <span className="text-sm">Security</span>}
                    </button>
                    <button
                        onClick={() => setShowInstructions(true)}
                        className="w-full flex items-center gap-3 px-2 py-2 hover:bg-white/10 transition-colors text-gray-300 rounded group"
                    >
                        <Cloud className="w-5 h-5 shrink-0 group-hover:scale-110 transition-transform" />
                        {isSidebarOpen && <div className="flex flex-col items-start">
                            <span className="text-sm">System</span>
                            {syncStatus === 'syncing' && <span className="text-[10px] text-yellow-400 flex items-center gap-1">Syncing...</span>}
                            {syncStatus === 'success' && <span className="text-[10px] text-green-400 flex items-center gap-1">Online</span>}
                            {syncStatus === 'error' && <span className="text-[10px] text-red-400 flex items-center gap-1">Error</span>}
                        </div>}
                    </button>

                    <div className={`flex items-center gap-2 pt-2 mt-2 border-t border-green-900/50 ${!isSidebarOpen && 'justify-center'}`}>
                        <div className="w-8 h-8 bg-green-800 rounded-full flex items-center justify-center font-bold">
                            {currentMember ? currentMember.firstName.charAt(0) : 'A'}
                        </div>
                        {isSidebarOpen && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{currentMember?.firstName}</p>
                                <button onClick={handleLogout} className="text-xs text-red-300 hover:text-red-100 flex items-center gap-1">
                                    <LogOut className="w-3 h-3" /> Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto p-4 relative">
                {renderContent()}
            </main>

            {/* Modals */}
            <Instructions
                isOpen={showInstructions}
                onClose={() => setShowInstructions(false)}
                sheetUrl=""
                adminPassword={data.settings.adminPassword}
                publicUrl={data.settings.publicUrl}
                onSaveUrl={() => { }}
                onSaveSettings={handleSaveSettings}
            />

            <QRCodeDisplay
                isOpen={showQRCode}
                onClose={() => setShowQRCode(false)}
                publicUrl={data.settings.publicUrl}
            />

            <SelfieGallery
                isOpen={showSelfies}
                onClose={() => setShowSelfies(false)}
                selfies={data.selfies || []}
                members={data.members}
                games={data.games}
                sports={data.sports}
                onDelete={handleDeleteSelfie}
                onVote={handleToggleSelfieVote}
                bonusPoints={data.bonusPoints || []}
                currentMember={currentMember!}
                selfieVotes={data.selfieVotes || []}
            />

            <SportsManager
                isOpen={showSportsManager}
                onClose={() => setShowSportsManager(false)}
                sports={data.sports}
                games={data.games}
                onAddSport={handleAddSport}
                onDeleteSport={handleDeleteSport}
                onUpdateSportVenues={handleUpdateSportVenues}
            />

            {currentMember && (
                <SettingsModal
                    isOpen={showPasswordChange}
                    onClose={() => setShowPasswordChange(false)}
                    member={currentMember}
                    sports={data.sports}
                    onUpdateProfile={handleUpdateProfile}
                />
            )}
        </div>
    );
}

export default App;