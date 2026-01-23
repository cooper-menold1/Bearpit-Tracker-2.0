import fs from 'fs';
import path from 'path';

const baseDir = 'c:/Users/coope/.gemini/antigravity/brain/eaff70c4-9ced-4cb1-8067-62fd2f77c26f/BPLT_Migration/Project/BPLTWebApp-main';

// Fix App.tsx - handleAddMember function
const appPath = 'App.tsx';
let appContent = fs.readFileSync(path.join(baseDir, appPath), 'utf8');

// Fix handleAddMember to lowercase the role
const handleAddMemberTarget = `    const handleAddMember = async (newMember: Member) => {
        await supabase.from('members').upsert({
            id: newMember.id,
            first_name: newMember.firstName,
            last_name: newMember.lastName,
            role: newMember.role,
            years_in_bplt: newMember.yearsInBPLT,
            email: newMember.email,
            password: newMember.password || 'BPLT'
        });
    };`;

const handleAddMemberReplacement = `    const handleAddMember = async (newMember: Member) => {
        await supabase.from('members').upsert({
            id: newMember.id,
            first_name: newMember.firstName,
            last_name: newMember.lastName,
            role: newMember.role.toLowerCase(),
            years_in_bplt: newMember.yearsInBPLT,
            email: newMember.email,
            password: newMember.password || 'BPLT'
        });
    };`;

appContent = appContent.replace(handleAddMemberTarget, handleAddMemberReplacement);

// Also need to fix handleUpdateProfile if it exists
const updateProfilePattern = /if \(updates\.password\) payload\.password = updates\.password;\s+if \(updates\.email !== undefined\) payload\.email = updates\.email;/;
if (updateProfilePattern.test(appContent)) {
    // Add role normalization to handleUpdateProfile
    const updateProfileTarget = `            const payload: any = {};
            if (updates.password) payload.password = updates.password;
            if (updates.email !== undefined) payload.email = updates.email;`;

    const updateProfileReplacement = `            const payload: any = {};
            if (updates.password) payload.password = updates.password;
            if (updates.email !== undefined) payload.email = updates.email;
            if (updates.role !== undefined) payload.role = updates.role.toLowerCase();`;

    appContent = appContent.replace(updateProfileTarget, updateProfileReplacement);
}

fs.writeFileSync(path.join(baseDir, appPath), appContent);
console.log('Fixed role normalization in App.tsx');
