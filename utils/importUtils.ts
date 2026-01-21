import { Game, Sport } from '../types';

/**
 * Basic CSV Parser that handles quoted fields.
 */
const parseCSVLine = (text: string): string[] => {
    const re_valid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
    const re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'| "([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;

    // Simple split for now, robust enough for standard Outlook exports
    const matches: string[] = [];
    let match;
    const pattern = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
    // Actually, a simple regex for comma separation handling quotes:
    // This is a known regex for splitting CSV lines
    return text.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
};

export const parseOutlookCSV = (csvContent: string, defaultSportId: string): Partial<Game>[] => {
    const lines = csvContent.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.replace(/^"(.*)"$/, '$1').trim());

    // Identify indices
    const subjectIdx = headers.findIndex(h => h.toLowerCase().includes('subject'));
    const startDateIdx = headers.findIndex(h => h.toLowerCase().includes('start date'));
    const startTimeIdx = headers.findIndex(h => h.toLowerCase().includes('start time'));
    const locationIdx = headers.findIndex(h => h.toLowerCase().includes('location'));
    const descIdx = headers.findIndex(h => h.toLowerCase().includes('description'));

    if (subjectIdx === -1 || startDateIdx === -1) {
        console.error("Missing critical headers (Subject or Start Date)");
        return [];
    }

    const games: Partial<Game>[] = [];

    // Helper to parse CSV line respecting quotes
    const parseLine = (text: string) => {
        const result = [];
        let start = 0;
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '"') {
                inQuotes = !inQuotes;
            } else if (text[i] === ',' && !inQuotes) {
                let field = text.substring(start, i).trim();
                // Remove quotes
                if (field.startsWith('"') && field.endsWith('"')) {
                    field = field.substring(1, field.length - 1);
                }
                result.push(field);
                start = i + 1;
            }
        }
        let lastField = text.substring(start).trim();
        if (lastField.startsWith('"') && lastField.endsWith('"')) {
            lastField = lastField.substring(1, lastField.length - 1);
        }
        result.push(lastField);
        return result;
    }

    for (let i = 1; i < lines.length; i++) {
        const row = parseLine(lines[i]);
        if (row.length < headers.length) continue;

        const subject = row[subjectIdx] || 'Match';
        const dateRaw = row[startDateIdx] || '';
        const timeRaw = row[startTimeIdx] || '';
        const locationRaw = row[locationIdx] || '';
        const desc = descIdx > -1 ? row[descIdx] : '';

        // Determine Home/Away/Neutral from Subject or Location
        let location: 'Home' | 'Away' | 'Neutral' = 'Home';
        if (locationRaw.toLowerCase().includes('away') || subject.toLowerCase().includes(' at ')) {
            location = 'Away';
        } else if (locationRaw.toLowerCase().includes('neutral')) {
            location = 'Neutral';
        }

        // Clean up date (Outlook might allow M/D/YYYY or YYYY-MM-DD)
        // We need YYYY-MM-DD
        let formattedDate = dateRaw;
        // Basic check for M/D/YYYY
        if (dateRaw.includes('/')) {
            const parts = dateRaw.split('/');
            if (parts.length === 3) {
                // assume M/D/YYYY
                const m = parts[0].padStart(2, '0');
                const d = parts[1].padStart(2, '0');
                const y = parts[2];
                formattedDate = `${y}-${m}-${d}`;
            }
        }

        // Clean up time (Outlook might be h:mm:ss A or HH:MM)
        // We want HH:MM (24h)
        let formattedTime = timeRaw;
        if (timeRaw.includes('M')) { // AM/PM
            const [time, modifier] = timeRaw.split(' ');
            let [hours, minutes] = time.split(':');
            if (hours === '12') hours = '00';
            if (modifier === 'PM') hours = String(parseInt(hours, 10) + 12);
            formattedTime = `${hours}:${minutes}`;
        }

        games.push({
            id: `imported_${Date.now()}_${i}`,
            sportId: defaultSportId,
            date: formattedDate,
            time: formattedTime,
            opponent: subject, // TODO: Maybe try to extract opponent from "vs X" or "at X"
            location: location,
            isBonus: false,
            description: desc
        });
    }

    return games;
};
