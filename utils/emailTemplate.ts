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
