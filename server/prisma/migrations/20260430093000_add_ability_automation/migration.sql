-- Add per-ability workflow automation defaults.
ALTER TABLE "AbilityDefinition" ADD COLUMN "automation" JSONB;