import fs from 'fs';
import path from 'path';

const baseDir = 'c:/Users/coope/.gemini/antigravity/brain/eaff70c4-9ced-4cb1-8067-62fd2f77c26f/BPLT_Migration/Project/BPLTWebApp-main';

function replaceInFile(filePath, target, replacement) {
    const fullPath = path.join(baseDir, filePath);
    let content = fs.readFileSync(fullPath, 'utf8');
    if (content.indexOf(target) !== -1) {
        content = content.replace(target, replacement);
        fs.writeFileSync(fullPath, content);
        console.log('Updated ' + filePath);
    } else {
        console.error('Could not find target in ' + filePath);
    }
}

// 1. GameCalendar.tsx
const gcPath = 'components/GameCalendar.tsx';
let gcContent = fs.readFileSync(path.join(baseDir, gcPath), 'utf8');

// Use regex for more robust matching of whitespace/newlines
gcContent = gcContent.replace(/<div className="flex flex-col flex-1">/g, '<div className="flex flex-col flex-1 min-h-0 overflow-hidden">');
gcContent = gcContent.replace(/<div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">/g, '<div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 shrink-0 sticky top-0 z-10">');
gcContent = gcContent.replace(/<div className="grid grid-cols-7 bg-gray-200 gap-px border-b border-gray-200 flex-1">/g, '<div className="flex-1 overflow-y-auto min-h-0"><div className="grid grid-cols-7 bg-gray-200 gap-px border-b border-gray-200 h-full">');

// Match the closing part of the grid body
const gcEndPattern = /\{Array\.from\(\{ length: \(7 - \(daysInMonth \+ firstDayOfMonth\) % 7\) % 7 \}\)\.map\(\(_, i\) => \(\r?\n\s+<div key=\{`end-empty-\${i}`\} className="bg-gray-50\/50 min-h\[100px\]\"><\/div>\r?\n\s+\)\)\}\r?\n\s+<\/div>\r?\n\s+<\/div>/;
const gcEndReplacement = `{Array.from({ length: (7 - (daysInMonth + firstDayOfMonth) % 7) % 7 }).map((_, i) => (
                            <div key={\`end-empty-\${i}\`} className="bg-gray-50/50 min-h-[100px]"></div>
                        ))}
                    </div>
                </div>
                </div>`;

if (gcEndPattern.test(gcContent)) {
    gcContent = gcContent.replace(gcEndPattern, gcEndReplacement);
} else {
    // Fallback if regex fails - just append the extra div before the last div of the calendar view
    console.log('Regex for end of grid failed, using fallback source replacement');
    gcContent = gcContent.replace(/<\/div>\r?\n\s+<\/div>\r?\n\s+\) : \(/, '</div>\n                </div>\n                </div>\n            ) : (');
}

fs.writeFileSync(path.join(baseDir, gcPath), gcContent);
console.log('Fixed GameCalendar.tsx');

// 2. MemberPortal.tsx
const mpPath = 'components/MemberPortal.tsx';
let mpContent = fs.readFileSync(path.join(baseDir, mpPath), 'utf8');
mpContent = mpContent.replace(/<div className="animate-in fade-in slide-in-from-bottom-4 duration-500">(\r?\n\s+)<GameCalendar/g, '<div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-[600px] max-h-[80vh]">$1<GameCalendar');
fs.writeFileSync(path.join(baseDir, mpPath), mpContent);
console.log('Fixed MemberPortal.tsx');

// 3. Management.tsx
const mgPath = 'components/Management.tsx';
let mgContent = fs.readFileSync(path.join(baseDir, mgPath), 'utf8');
mgContent = mgContent.replace(/<div className="h-full relative">(\r?\n\s+)<GameCalendar/g, '<div className="h-[600px] max-h-[80vh] relative">$1<GameCalendar');
fs.writeFileSync(path.join(baseDir, mgPath), mgContent);
console.log('Fixed Management.tsx');
