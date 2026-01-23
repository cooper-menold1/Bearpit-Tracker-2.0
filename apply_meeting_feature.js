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

// 1. Update constants.ts
const constantsPath = 'constants.ts';
let constantsContent = fs.readFileSync(path.join(baseDir, constantsPath), 'utf8');

const venueTarget = "  { id: 'ferrell_vb', name: 'Ferrell Center (Volleyball)', latitude: 31.547903, longitude: -97.105969, radiusMeters: 200 }";
const venueReplacement = "  { id: 'ferrell_vb', name: 'Ferrell Center (Volleyball)', latitude: 31.547903, longitude: -97.105969, radiusMeters: 200 },\n  { id: 'foster_campus', name: 'Foster Campus for Business and Innovation', latitude: 31.546944, longitude: -97.116667, radiusMeters: 200 }";

const sportTarget = "    { id: 'acro', name: 'Acro & Tumbling', venueIds: ['ferrell'] },";
const sportReplacement = "    { id: 'acro', name: 'Acro & Tumbling', venueIds: ['ferrell'] },\n    { id: 'meetings', name: 'Meetings', venueIds: ['foster_campus'] },";

constantsContent = constantsContent.replace(venueTarget, venueReplacement);
constantsContent = constantsContent.replace(sportTarget, sportReplacement);
fs.writeFileSync(path.join(baseDir, constantsPath), constantsContent);
console.log('Updated constants.ts');

// 2. Update AutoFillModal.tsx
const afmPath = 'components/AutoFillModal.tsx';
let afmContent = fs.readFileSync(path.join(baseDir, afmPath), 'utf8');

if (!afmContent.includes('Clock')) {
    afmContent = afmContent.replace("Plus, MapPin", "Plus, MapPin, Clock");
}

const stateTarget = "    const [activeTab, setActiveTab] = useState<'new' | 'updates'>('new');";
const b = '`';
const stateReplacement = "    const [activeTab, setActiveTab] = useState<'new' | 'updates'>('new');\n    const [autoFillMode, setAutoFillMode] = useState<'scrape' | 'meetings'>('scrape');\n    const [meetingConfig, setMeetingConfig] = useState({\n        startDate: new Date().toISOString().split('T')[0],\n        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],\n        time: '17:30',\n        dayOfWeek: 4 // Thursday\n    });";

const resetTarget = "        setActiveTab('new');";
const resetReplacement = "        setActiveTab('new');\n        setAutoFillMode('scrape');";

const handleGenerateMeetings = `
    const handleGenerateMeetings = async () => {
        setLoading(true);
        try {
            let meetingSportId = existingSports.find(s => s.name.toLowerCase() === 'meetings' || s.id === 'meetings')?.id;
            if (!meetingSportId) {
                meetingSportId = await onAddSport('Meetings');
            }

            const start = new Date(meetingConfig.startDate);
            const end = new Date(meetingConfig.endDate);
            const meetingsToAdd = [];

            let current = new Date(start);
            while (current.getDay() !== meetingConfig.dayOfWeek) {
                current.setDate(current.getDate() + 1);
            }

            while (current <= end) {
                const dateStr = current.toISOString().split('T')[0];
                const existing = existingGames.find(g => g.date === dateStr && g.sportId === meetingSportId);
                
                if (!existing) {
                    meetingsToAdd.push({
                        id: 'meeting_' + Date.now() + '_' + current.getTime(),
                        sportId: meetingSportId,
                        date: dateStr,
                        time: meetingConfig.time,
                        opponent: 'Weekly Meeting',
                        location: 'Home',
                        isBonus: false,
                        pointsValue: 1,
                        description: 'Foster Campus'
                    });
                }
                current.setDate(current.getDate() + 7);
            }

            for (const meeting of meetingsToAdd) {
                onAddGame(meeting);
            }

            alert('Success! Generated ' + meetingsToAdd.length + ' meetings.');
            onClose();
        } catch (err) {
            alert("Error generating meetings.");
        } finally {
            setLoading(false);
        }
    };
`;

afmContent = afmContent.replace(stateTarget, stateReplacement);
afmContent = afmContent.replace(resetTarget, resetReplacement);
if (!afmContent.includes('handleGenerateMeetings')) {
    afmContent = afmContent.replace('    const handleImport = async () => {', handleGenerateMeetings + '\n    const handleImport = async () => {');
}

const uiStartTarget = '<div className="flex-1 overflow-y-auto p-6 bg-gray-50">';
const uiStartReplacement = `<div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {/* Mode Toggle */}
                    <div className="flex bg-gray-200 p-1 rounded-xl mb-6 sticky top-0 z-10">
                        <button 
                            onClick={() => setAutoFillMode('scrape')} 
                            className={'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ' + (autoFillMode === 'scrape' ? 'bg-white text-[#154734] shadow-sm' : 'text-gray-500')}
                        >
                            Baylor Schedule
                        </button>
                        <button 
                            onClick={() => setAutoFillMode('meetings')} 
                            className={'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ' + (autoFillMode === 'meetings' ? 'bg-white text-[#154734] shadow-sm' : 'text-gray-500')}
                        >
                            Weekly Meetings
                        </button>
                    </div>`;

afmContent = afmContent.replace(uiStartTarget, uiStartReplacement);
afmContent = afmContent.replace("{step === 'fetch' && (", "{autoFillMode === 'scrape' && step === 'fetch' && (");

const meetingsBlock = `
                    {autoFillMode === 'meetings' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3 text-blue-800 text-sm">
                                <Info className="w-5 h-5 shrink-0" />
                                <div>
                                    <p className="font-bold">Weekly Meeting Generator</p>
                                    <p>Quickly generate a series of weekly meetings for the club at the Foster Campus.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Start Date</label>
                                    <input 
                                        type="date" 
                                        value={meetingConfig.startDate}
                                        onChange={(e) => setMeetingConfig({...meetingConfig, startDate: e.target.value})}
                                        className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm font-bold focus:border-[#154734] outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">End Date</label>
                                    <input 
                                        type="date" 
                                        value={meetingConfig.endDate}
                                        onChange={(e) => setMeetingConfig({...meetingConfig, endDate: e.target.value})}
                                        className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm font-bold focus:border-[#154734] outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Meeting Time</label>
                                    <div className="relative">
                                        <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input 
                                            type="time" 
                                            value={meetingConfig.time}
                                            onChange={(e) => setMeetingConfig({...meetingConfig, time: e.target.value})}
                                            className="w-full border-2 border-gray-100 rounded-xl p-3 pl-10 text-sm font-bold focus:border-[#154734] outline-none transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Day of Week</label>
                                    <select 
                                        value={meetingConfig.dayOfWeek}
                                        onChange={(e) => setMeetingConfig({...meetingConfig, dayOfWeek: Number(e.target.value)})}
                                        className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm font-bold focus:border-[#154734] outline-none transition-all"
                                    >
                                        <option value={1}>Monday</option>
                                        <option value={2}>Tuesday</option>
                                        <option value={3}>Wednesday</option>
                                        <option value={4}>Thursday</option>
                                        <option value={5}>Friday</option>
                                        <option value={6}>Saturday</option>
                                        <option value={0}>Sunday</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleGenerateMeetings}
                                disabled={loading}
                                className="w-full bg-[#154734] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#0f3325] transition-all disabled:opacity-50 shadow-lg shadow-green-900/10 active:scale-95 mt-4"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Generate Weekly Meetings"}
                            </button>
                        </div>
                    )}
`;

afmContent = afmContent.replace('                    )}', '                    )}\n' + meetingsBlock);

fs.writeFileSync(path.join(baseDir, afmPath), afmContent);
console.log('Updated AutoFillModal.tsx');
