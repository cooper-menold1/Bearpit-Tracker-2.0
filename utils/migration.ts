import { supabase } from './supabaseClient';
import { AppState, AttendanceRecord, Role } from '../types';

export const migrateToSupabase = async (data: AppState, onProgress: (msg: string) => void) => {
    try {
        onProgress("Starting migration...");

        // 1. Migrate Sports
        onProgress(`Migrating ${data.sports.length} sports...`);
        if (data.sports.length > 0) {
            const { error: sportError } = await supabase
                .from('sports')
                .upsert(data.sports.map(s => ({
                    id: s.id,
                    name: s.name
                })));
            if (sportError) throw new Error(`Sports Error: ${sportError.message}`);
        }

        // 2. Migrate Members
        onProgress(`Migrating ${data.members.length} members...`);
        if (data.members.length > 0) {
            // Batch insert in chunks of 100 just in case
            const membersPayload = data.members.map(m => ({
                id: m.id,
                first_name: m.firstName,
                last_name: m.lastName,
                role: m.role,
                email: m.email,
                password: m.password,
                years_in_bplt: m.yearsInBPLT
            }));

            const { error: memberError } = await supabase
                .from('members')
                .upsert(membersPayload);
            if (memberError) throw new Error(`Members Error: ${memberError.message}`);
        }

        // 3. Migrate Games
        onProgress(`Migrating ${data.games.length} games...`);
        if (data.games.length > 0) {
            const gamesPayload = data.games.map(g => ({
                id: g.id,
                sport_id: g.sportId,
                date: g.date,
                time: g.time,
                opponent: g.opponent,
                location: g.location,
                is_bonus: g.isBonus,
                description: g.description
            }));

            const { error: gameError } = await supabase
                .from('games')
                .upsert(gamesPayload);
            if (gameError) throw new Error(`Games Error: ${gameError.message}`);
        }

        // 4. Migrate Attendance
        onProgress("Migrating attendance records...");
        const attendancePayload: any[] = [];
        Object.keys(data.attendance).forEach(gameId => {
            const memberMap = data.attendance[gameId];
            Object.keys(memberMap).forEach(memberId => {
                if (memberMap[memberId]) { // If true (attended)
                    attendancePayload.push({
                        game_id: gameId,
                        member_id: memberId
                        // created_at defaults to now
                    });
                }
            });
        });

        if (attendancePayload.length > 0) {
            // Chunk this as attendance can be large
            const chunkSize = 100;
            for (let i = 0; i < attendancePayload.length; i += chunkSize) {
                const chunk = attendancePayload.slice(i, i + chunkSize);
                const { error: attError } = await supabase
                    .from('attendance')
                    .upsert(chunk, { onConflict: 'game_id, member_id' });
                if (attError) throw new Error(`Attendance Error: ${attError.message}`);
            }
        }

        // 5. Migrate Selfies
        // NOTE: We are storing base64 strings in the text column for now as per schema plan
        onProgress(`Migrating ${data.selfies.length} selfies...`);
        if (data.selfies.length > 0) {
            const selfiesPayload = data.selfies.map(s => ({
                id: s.id,
                member_id: s.memberId,
                game_id: s.gameId,
                image_data: s.imageData,
                timestamp: s.timestamp
            }));
            // Selfies might be huge due to base64, insert one by one or small batches
            const chunkSize = 10;
            for (let i = 0; i < selfiesPayload.length; i += chunkSize) {
                const chunk = selfiesPayload.slice(i, i + chunkSize);
                const { error: selfieError } = await supabase
                    .from('selfies')
                    .upsert(chunk);
                if (selfieError) {
                    console.error("Selfie upload error", selfieError);
                    // Don't fail entire migration for a selfie failure, just log it
                }
            }
        }

        onProgress("Migration Complete!");
        return true;

    } catch (e: any) {
        console.error("Migration failed", e);
        onProgress(`FAILED: ${e.message}`);
        return false;
    }
};
