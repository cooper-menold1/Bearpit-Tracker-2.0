
import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_STATE, LOGO_URL } from './constants';
import { AppState, Member, Game, Selfie, Role, Sport, BonusPoint, SelfieVote, EmailTemplate } from './types';
import { SportSheet } from './components/SportSheet';
import { Dashboard } from './components/Dashboard';
import { Management } from './components/Management';
import { Login } from './components/Login';
import { AttendanceForm } from './components/AttendanceForm';
import { InterestForm } from './components/InterestForm';
import { MemberPortal } from './components/MemberPortal';
import { Instructions } from './components/Instructions';
import { QRCodeDisplay } from './components/QRCodeDisplay';
import { SelfieGallery } from './components/SelfieGallery';
import { SportsManager } from './components/SportsManager';
import { Leaderboard } from './components/Leaderboard';
import { SettingsModal } from './components/SettingsModal';
import { ChantGallery } from './components/ChantGallery';
import { ChantManager } from './components/ChantManager';
import { ApplicationsList } from './components/ApplicationsList';
import { supabase } from './utils/supabaseClient';
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
                { data: selfieVotes },
                { data: emailTemplateRow }
            ] = await Promise.all([
                supabase.from('sports').select('*'),
                supabase.from('games').select('*'),
                // SECURITY FLAGGED: Do not select password column for all users
                supabase.from('members').select('id, first_name, last_name, role, years_in_bplt, email, phone, year, heard_about, fall_sport_id, spring_sport_id, is_chair'),
                supabase.from('attendance').select('*'),
                supabase.from('selfies').select('*'),
                supabase.from('bonus_points').select('*'),
                supabase.from('selfie_votes').select('*'),
                // Falls back to null if the migration hasn't been run yet -- not fatal.
                supabase.from('email_templates').select('*').eq('id', 'prospective_welcome').maybeSingle()
            ]);

            const attendanceMap: Record<string, Record<string, boolean>> = {};
            attendance?.forEach((record: any) => {
                if (!attendanceMap[record.game_id]) attendanceMap[record.game_id] = {};
                attendanceMap[record.game_id][record.member_id] = true;
            });

            const mappedMembers: Member[] = (members || []).map((m: any) => ({
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
                selfies: mappedSelfies,
                selfieVotes: (selfieVotes || []).map((v: any) => ({ selfieId: v.selfie_id, memberId: v.member_id })),
                bonusPoints: (bonusPoints || []).map((b: any) => ({ id: b.id, memberId: b.member_id, points: b.points, reason: b.reason, date: b.date })),
                emailTemplate: mappedEmailTemplate
            }));

            setSyncStatus('success');
            setIsLoading(false);
        } catch (error) {
            console.error("Error fetching data:", error);
            setSyncStatus('error');
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const channels = supabase
            .channel('custom-all-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sports' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'selfies' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'email_templates' }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(channels); };
    }, []);

    const handleLogin = (member: Member, password: string) => {
        setCurrentMember(member);
        currentPasswordRef.current = password;
        setMode(member.role === Role.ADMIN ? 'dashboard' : 'member');
    };

    const handleGuestForm = () => setMode('form');

    const handleLogout = () => {
        setCurrentMember(null);
        currentPasswordRef.current = null;
        setMode('login');
        sessionStorage.removeItem('bp_member');
        sessionStorage.removeItem('bp_mode');
        window.history.replaceState({}, '', window.location.pathname);
    };

    const handleUpdateProfile = async (updates: Partial<Member>, memberId?: string) => {
        const idToUpdate = memberId || currentMember?.id;
        if (!idToUpdate) return;

        try {
            // Password changes go through server-side RPCs -- the client
            // never writes to the password column directly (it can't; see
            // the column-level REVOKE in update_schema_v4_secure_login.sql).
            if (updates.password) {
                const actingPassword = currentPasswordRef.current;
                if (!actingPassword || !currentMember) {
                    alert('Please log out and back in before changing a password.');
                    return;
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
                    alert('Could not update password -- your own password may be out of date. Try logging out and back in.');
                    return;
                }

                if (isSelf) currentPasswordRef.current = updates.password;
            }

            const payload: any = {};
            if (updates.email !== undefined) payload.email = updates.email;
            if (updates.fallSportId !== undefined) payload.fall_sport_id = updates.fallSportId;
            if (updates.springSportId !== undefined) payload.spring_sport_id = updates.springSportId;
            if (updates.isChair !== undefined) payload.is_chair = updates.isChair;

            if (Object.keys(payload).length > 0) {
                const { error } = await supabase.from('members').update(payload).eq('id', idToUpdate);
                if (error) throw error;
            }

            alert("Profile updated successfully!");

            if (idToUpdate === currentMember?.id) {
                const refreshed: any = { ...currentMember, ...updates };
                delete refreshed.password; // never let a real password land in state/sessionStorage
                setCurrentMember(refreshed);
            }

            fetchData();
        } catch (e: any) { alert("Error updating profile: " + e.message); }
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
        } catch (e: any) { fetchData(); }
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

        const { error } = await supabase.from('members').upsert(payload);
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

        fetchData();
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
        fetchData();
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
        await fetchData();
    };

    const handleDeleteGame = async (id: string) => {
        if (window.confirm("Delete this game?")) await supabase.from('games').delete().eq('id', id);
    };

    const handleAddSport = async (name: string, venueIds: string[] = []): Promise<string> => {
        const id = 'sport_' + Date.now();
        await supabase.from('sports').insert({ id, name, venue_ids: venueIds });
        await fetchData();
        return id;
    };

    const handleDeleteSport = async (id: string) => {
        if (window.confirm("Delete sport?")) await supabase.from('sports').delete().eq('id', id);
    };

    const handleFormSubmit = async (gameId: string, memberId: string, newMember?: Member, selfie?: Selfie) => {
        if (newMember) await handleAddMember(newMember);
        if (newMember?.role === Role.PROSPECTIVE) return;
        await supabase.from('attendance').insert({ game_id: gameId, member_id: memberId });
        await fetchData();
    };

    const handleToggleSelfieVote = async (selfieId: string, memberId: string) => {
        const selfie = data.selfies.find(s => s.id === selfieId);
        if (!selfie) return;
        const voted = data.selfieVotes.some(v => v.memberId === memberId && v.selfieId === selfieId);
        if (voted) await supabase.from('selfie_votes').delete().match({ selfie_id: selfieId, member_id: memberId });
        else await supabase.from('selfie_votes').insert({ selfie_id: selfieId, member_id: memberId });
        fetchData();
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
                onAddBonusPoint={async (mid, pts, reason) => {
                    await supabase.from('bonus_points').insert({ member_id: mid, points: pts, reason, date: new Date().toISOString() });
                    fetchData();
                }}
                onDeleteBonusPoint={async (id) => {
                    await supabase.from('bonus_points').delete().eq('id', id);
                    fetchData();
                }}
                onAddSport={handleAddSport}
                userRole={currentMember?.role}
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
                    fetchData();
                }}
            />
        );
        return <Dashboard data={data} />;
    };

    if (isLoading) return <div className="h-screen bg-[#154734] flex items-center justify-center text-white"><RefreshCw className="w-10 h-10 animate-spin" /></div>;
    if (mode === 'chants') return <ChantGallery onBack={() => setMode('login')} />;
    if (mode === 'login') return <Login members={data.members} onLogin={handleLogin} onGuest={handleGuestForm} onChants={() => setMode('chants')} onInterest={() => setMode('interest')} selfies={data.selfies} />;
    if (mode === 'form') return <AttendanceForm members={data.members} games={data.games} sports={data.sports} onSubmit={handleFormSubmit} onBack={handleLogout} />;
    if (mode === 'interest') return <InterestForm members={data.members} onSubmit={handleAddMember} onBack={handleLogout} />;
    if (mode === 'member' && currentMember) return <MemberPortal member={currentMember} data={data} onLogout={handleLogout} onUpdateProfile={handleUpdateProfile} onVote={handleToggleSelfieVote} sports={data.sports} onAddGame={handleAddGame} onDeleteGame={handleDeleteGame} />;

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
            <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-[#154734] text-white transition-all duration-300 flex flex-col shadow-xl z-20 h-full overflow-y-auto`}>
                <div className="p-4 border-b border-green-900/50 flex items-center justify-between shrink-0 sticky top-0 bg-[#154734] z-10">
                    <div className="font-bold flex items-center gap-3 overflow-hidden whitespace-nowrap">
                        <div className="w-8 h-8 bg-white rounded flex items-center justify-center shrink-0 p-1"><img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" /></div>
                        {isSidebarOpen && <span>Bear Pit Tracker</span>}
                    </div>
                </div>
                <nav className="p-0 space-y-1 mt-2">
                    <button onClick={() => setCurrentView('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 ${currentView === 'dashboard' ? 'bg-[#FFB81C] text-[#154734] font-bold' : 'text-gray-300'}`}><LayoutDashboard className="w-5 h-5" />{isSidebarOpen && <span>Dashboard</span>}</button>
                    <button onClick={() => setCurrentView('management')} className={`w-full flex items-center gap-3 px-4 py-3 ${currentView === 'management' ? 'bg-[#FFB81C] text-[#154734] font-bold' : 'text-gray-300'}`}><Users className="w-5 h-5" />{isSidebarOpen && <span>Manage</span>}</button>
                    <button onClick={() => setCurrentView('applications')} className={`w-full flex items-center gap-3 px-4 py-3 ${currentView === 'applications' ? 'bg-[#FFB81C] text-[#154734] font-bold' : 'text-gray-300'}`}>
                        <Mail className="w-5 h-5" />
                        {isSidebarOpen && <span>Applications</span>}
                        {data.members.filter(m => m.role === Role.PROSPECTIVE).length > 0 && (
                            <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${currentView === 'applications' ? 'bg-[#154734] text-white' : 'bg-[#FFB81C] text-[#154734]'} ${isSidebarOpen ? 'ml-auto' : ''}`}>
                                {data.members.filter(m => m.role === Role.PROSPECTIVE).length}
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
            <main className="flex-1 overflow-auto p-4 relative">{renderContent()}</main>
            <QRCodeDisplay isOpen={showQRCode} onClose={() => setShowQRCode(false)} publicUrl={data.settings.publicUrl} />
            <Instructions isOpen={showInstructions} onClose={() => setShowInstructions(false)} sheetUrl="" adminPassword={data.settings.adminPassword} onSaveUrl={() => { }} onSaveSettings={() => { }} />
            {currentMember && (
                <SelfieGallery isOpen={showSelfies} onClose={() => setShowSelfies(false)} selfies={data.selfies} members={data.members} games={data.games} sports={data.sports} onDelete={async (id) => await supabase.from('selfies').delete().eq('id', id)} onVote={handleToggleSelfieVote} currentMember={currentMember} selfieVotes={data.selfieVotes} />
            )}
            <SportsManager isOpen={showSportsManager} onClose={() => setShowSportsManager(false)} sports={data.sports} games={data.games} onAddSport={handleAddSport} onDeleteSport={handleDeleteSport} onUpdateSportVenues={async (id, vids) => await supabase.from('sports').update({ venue_ids: vids }).eq('id', id)} />
            <ChantManager isOpen={showChantManager} onClose={() => setShowChantManager(false)} />
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
