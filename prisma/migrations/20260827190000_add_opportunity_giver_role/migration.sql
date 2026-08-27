-- Add the provider role without changing existing student/admin accounts.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'OPPORTUNITY_GIVER';
