import fs from 'fs';
import path from 'path';

const baseDir = 'c:/Users/coope/.gemini/antigravity/brain/eaff70c4-9ced-4cb1-8067-62fd2f77c26f/BPLT_Migration/Project/BPLTWebApp-main';

// Fix Management.tsx - add all role options to the dropdown
const mgmtPath = 'components/Management.tsx';
let mgmtContent = fs.readFileSync(path.join(baseDir, mgmtPath), 'utf8');

const roleDropdownTarget = `                            <select value={memberForm.role} onChange={e => setMemberForm({ ...memberForm, role: e.target.value as Role })} className="border p-2 rounded text-sm">
                                <option value={Role.MEMBER}>Member</option>
                                <option value={Role.OFFICER}>Officer</option>
                                <option value={Role.ADMIN}>Admin</option>
                            </select>`;

const roleDropdownReplacement = `                            <select value={memberForm.role} onChange={e => setMemberForm({ ...memberForm, role: e.target.value as Role })} className="border p-2 rounded text-sm">
                                <option value={Role.ADMIN}>Admin</option>
                                <option value={Role.OFFICER}>Officer</option>
                                <option value={Role.MEMBER}>Member</option>
                                <option value={Role.PROSPECTIVE}>Prospective</option>
                                <option value={Role.INACTIVE}>Inactive</option>
                            </select>`;

mgmtContent = mgmtContent.replace(roleDropdownTarget, roleDropdownReplacement);
fs.writeFileSync(path.join(baseDir, mgmtPath), mgmtContent);
console.log('Added Prospective and Inactive roles to Management.tsx dropdown');
