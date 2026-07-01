-- Add athlete age, collected by the onboarding screen.
alter table athlete add column if not exists age int check (age between 10 and 100);
