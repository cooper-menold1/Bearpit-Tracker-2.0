import { EmailTemplate, Member } from '../types';

const PLACEHOLDER_MAP = (template: EmailTemplate, member: Member): Record<string, string> => ({
    '{{first_name}}': member.firstName || 'there',
    '{{meeting_type}}': template.meetingType || 'meeting',
    '{{date}}': template.meetingDate
        ? new Date(template.meetingDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        : '[Date TBD]',
    '{{time}}': template.meetingTime || '[Time TBD]',
    '{{location}}': template.meetingLocation || '[Location TBD]',
});

const fill = (text: string, map: Record<string, string>): string =>
    Object.entries(map).reduce((acc, [token, value]) => acc.split(token).join(value), text);

export const renderEmailTemplate = (template: EmailTemplate, member: Member): { subject: string; body: string } => {
    const map = PLACEHOLDER_MAP(template, member);
    return {
        subject: fill(template.subject, map),
        body: fill(template.body, map),
    };
};

export const buildMailto = (template: EmailTemplate, member: Member): string => {
    const { subject, body } = renderEmailTemplate(template, member);
    const to = encodeURIComponent(member.email || '');
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

// One shared email to many people at once, via bcc so recipients don't see
// each other's addresses. Opens in whichever mail client/account the browser
// hands mailto: links to -- there's no "from" to set here, that's determined
// by the sender's own default mail app (e.g. signed into bear_pit@baylor.edu).
export const buildBulkMailto = (subject: string, body: string, emails: string[]): string => {
    // Deliberately not encodeURIComponent-ing the whole joined list: percent-
    // encoding the comma (%2C) between addresses trips up some mail clients'
    // mailto bcc parsing (notably Outlook), which expect a literal comma.
    // Plain email addresses don't contain characters that need escaping.
    const bcc = emails.join(',');
    return `mailto:?bcc=${bcc}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

const escapeCsvField = (value: string): string => `"${value.replace(/"/g, '""')}"`;

// A CSV data source for Outlook/Word Mail Merge (Mailings tab -> Start Mail
// Merge -> E-mail Messages -> Select Recipients -> Use an Existing List).
// This is the actual way to send genuinely individualized emails (a real
// "Dear <First Name>" per person, sent as separate messages) from
// bear_pit@baylor.edu at no cost and no per-recipient click -- a bcc blast
// can't do that since every bcc'd recipient shares one identical body.
export const downloadMailMergeCSV = (
    recipients: { firstName: string; lastName: string; email: string }[],
    filename: string
): void => {
    const header = ['First Name', 'Last Name', 'Email Address'];
    const lines = [header.map(escapeCsvField).join(',')];
    recipients.forEach(r => {
        lines.push([r.firstName, r.lastName, r.email].map(escapeCsvField).join(','));
    });
    const csvContent = lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
