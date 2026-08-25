-- Email templates for recruitment automation (2026-08-25)
--
-- Replaces the old "Automation Configuration" feature that was built live
-- (via Antigravity/Gemini) but never finished -- it got as far as a UI
-- shell noting the templates "need to be connected to Supabase Edge
-- Functions" to actually send. No source for that ever existed in this
-- repo. Rebuilt from scratch here, seeded with Cooper's real template.
--
-- Sending model for now: no outbound email API/Edge Function -- generates
-- a mailto: link per recipient so it actually sends from Cooper's own
-- Baylor/BPLT inbox (matches what was discussed: it should feel personal
-- and official, not from a third-party automated sender). A real
-- SMTP/API-based sender is a natural next step if wanted later.

create table if not exists email_templates (
  id text primary key,
  subject text not null,
  body text not null,
  meeting_type text default 'interest session',
  meeting_date date,
  meeting_time text,
  meeting_location text,
  updated_at timestamptz default now()
);

alter table email_templates enable row level security;

create policy "Public Read Access" on email_templates for select using (true);
create policy "Authenticated Insert/Update" on email_templates for all
  using (auth.role() in ('authenticated', 'anon'));

insert into email_templates (id, subject, body, meeting_type)
values (
  'prospective_welcome',
  'Welcome to the Bear Pit Leadership Team!',
  'Hi {{first_name}},

Thanks so much for your interest in the BearPit Leadership Team! We''re excited to have you join us and can''t wait to get to know you.

The BearPit Leadership Team exists to ignite student passion and cultivate a unified Baylor fan culture through community-building, amplifying the student voice, and leading traditions that foster an engaging game-day experience.

We''d love to invite you to our next {{meeting_type}}:

Date: {{date}}
Time: {{time}}
Location: {{location}}

At the {{meeting_type}}, we''ll talk about upcoming games, BearPit events, ways to get involved, and what you can expect as a member of the Leadership Team.

We''re so glad you''re interested in being part of BPLT and helping us build an even stronger Baylor game day experience. We''ll see you soon!
Sic ''Em!

Cooper Menold
The BearPit Leadership Team',
  'interest session'
)
on conflict (id) do nothing;

-- Verify
select id, subject, meeting_type, meeting_date, meeting_time, meeting_location from email_templates;
