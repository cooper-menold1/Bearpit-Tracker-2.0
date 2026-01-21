const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Import
const importTag = \"import { SettingsModal } from './components/SettingsModal';\";
const newImport = \"import { SettingsModal } from './components/SettingsModal';\nimport { ChantGallery } from './components/ChantGallery';\";
content = content.replace(importTag, newImport);

// 2. Update Mode Type
const modeType = \"useState<'login' | 'dashboard' | 'member' | 'form'>(\";
const newModeType = \"useState<'login' | 'dashboard' | 'member' | 'form' | 'chants'>(\";
content = content.replace(modeType, newModeType);

// 3. Add 'chants' render block
// We find a unique anchor. The isLoading block end.
const loadingBlockEnd = \"        );\";
const loadingBlockEndRegex = /        \);\n    }/;
// Actually, let's just insert before 'if (mode === \'login\')'
// This is safer.
const loginBlockStart = \"    if (mode === 'login') {\";
const chantsBlock = 
\    if (mode === 'chants') {
        return <ChantGallery onBack={() => setMode('login')} />;
    }

\;
content = content.replace(loginBlockStart, chantsBlock + loginBlockStart);

// 4. Update Login Props
const exactLogin = 
\    if (mode === 'login') {
        return <Login
            members={data.members || []}
            onLogin={handleLogin}
            onGuest={handleGuestForm}
            selfies={data.selfies || []}
        />;
    }\;

const newLoginBlock = 
\    if (mode === 'login') {
        return <Login
            members={data.members || []}
            onLogin={handleLogin}
            onGuest={handleGuestForm}
            onChants={() => setMode('chants')}
            selfies={data.selfies || []}
        />;
    }\;

// Normalize newlines for replacement just in case
const normalize = (str) => str.replace(/\r\n/g, '\n').trim();

// Since exact string match might fail on line endings, checking if content includes it.
if (content.indexOf(exactLogin) === -1) {
    // If not found, try to replace based on signature
     console.log(\"Exact login block not found, trying regex...\");
     // Placeholder for regex if needed, but let's hope exact match works or we debug.
     // Windows might use \r\n
      const exactLoginCRLF = exactLogin.replace(/\n/g, '\r\n');
      if (content.indexOf(exactLoginCRLF) !== -1) {
          content = content.replace(exactLoginCRLF, newLoginBlock.replace(/\n/g, '\r\n'));
      } else {
          console.error(\"Could not find Login block to replace! Aborting Login prop update.\");
      }
} else {
    content = content.replace(exactLogin, newLoginBlock);
}

fs.writeFileSync(filePath, content);
console.log(\"App.tsx updated successfully\");
