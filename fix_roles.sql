-- Standardize Role Casing (Title Case)
-- This fixes issues where 'admin' (lowercase) is not recognized as 'Admin' by the application logic.

UPDATE members SET role = 'Admin' WHERE role ILIKE 'admin';
UPDATE members SET role = 'Officer' WHERE role ILIKE 'officer';
UPDATE members SET role = 'Member' WHERE role ILIKE 'member';
UPDATE members SET role = 'Prospective' WHERE role ILIKE 'prospective';

-- Verify the changes
SELECT * FROM members;
