const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const password = process.env.SUPABASE_DB_PASSWORD;
// connection string format: postgresql://postgres.[project-ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
const connectionString = `postgresql://postgres:${password}@db.bfdhunltwqnngxgsejzi.supabase.co:5432/postgres`;

async function runMigration() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    console.log("Starting migration...");
    
    // 1. Add state to companies
    await client.query(`
      ALTER TABLE public.companies 
      ADD COLUMN IF NOT EXISTS state text DEFAULT 'NW';
    `);
    console.log("Added state to companies.");

    // 2. Add auto_break_deduction_enabled to category_settings
    await client.query(`
      ALTER TABLE public.category_settings 
      ADD COLUMN IF NOT EXISTS auto_break_deduction_enabled boolean DEFAULT false;
    `);
    console.log("Added auto_break_deduction_enabled to category_settings.");

    // 3. Create company_custom_holidays table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.company_custom_holidays (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        date date NOT NULL,
        name text NOT NULL,
        created_at timestamp with time zone DEFAULT now()
      );
    `);
    console.log("Created company_custom_holidays table.");
    
    // Create RLS policies for company_custom_holidays
    await client.query(`
      ALTER TABLE public.company_custom_holidays ENABLE ROW LEVEL SECURITY;
      
      -- Drop policies if exist
      DROP POLICY IF EXISTS "Enable read access for all users" ON public.company_custom_holidays;
      DROP POLICY IF EXISTS "Enable all access for company admins" ON public.company_custom_holidays;

      CREATE POLICY "Enable read access for all users" ON public.company_custom_holidays
        FOR SELECT
        USING (true);

      CREATE POLICY "Enable all access for company admins" ON public.company_custom_holidays
        FOR ALL
        USING (true)
        WITH CHECK (true);
    `);
    console.log("Enabled RLS and created policies for company_custom_holidays.");

    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

runMigration();
