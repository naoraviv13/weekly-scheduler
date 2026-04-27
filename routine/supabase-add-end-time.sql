-- Add end_time column to support time ranges on tasks
-- Run this in Supabase SQL Editor

alter table public.template_tasks add column end_time text;
alter table public.one_time_tasks add column end_time text;
