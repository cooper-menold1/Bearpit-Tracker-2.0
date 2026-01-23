import fs from 'fs';
import path from 'path';

const baseDir = 'c:/Users/coope/.gemini/antigravity/brain/eaff70c4-9ced-4cb1-8067-62fd2f77c26f/BPLT_Migration/Project/BPLTWebApp-main';

// 1. Update types.ts to add Inactive role
const typesPath = 'types.ts';
let typesContent = fs.readFileSync(path.join(baseDir, typesPath), 'utf8');

const roleEnumTarget = `export enum Role {
    ADMIN = 'Admin',
    OFFICER = 'Officer',
    MEMBER = 'Member',
    PROSPECTIVE = 'Prospective',
}`;

const roleEnumReplacement = `export enum Role {
    ADMIN = 'Admin',
    OFFICER = 'Officer',
    MEMBER = 'Member',
    PROSPECTIVE = 'Prospective',
    INACTIVE = 'Inactive',
}`;

typesContent = typesContent.replace(roleEnumTarget, roleEnumReplacement);
fs.writeFileSync(path.join(baseDir, typesPath), typesContent);
console.log('Updated types.ts with Inactive role');
