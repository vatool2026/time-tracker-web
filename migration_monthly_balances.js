const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const password = process.env.SUPABASE_DB_PASSWORD;
// connection string format: postgresql://postgres:[password]@db.bfdhunltwqnngxgsejzi.supabase.co:5432/postgres
const connectionString = `postgresql://postgres:${password}@db.bfdhunltwqnngxgsejzi.supabase.co:5432/postgres`;

async function runMigration() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    console.log("Starting migration for monthly balances...");
    
    // 1. Create monthly_time_balances table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.monthly_time_balances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        transferred_hours DECIMAL DEFAULT 0.0,
        paid_out_hours DECIMAL DEFAULT 0.0,
        status TEXT DEFAULT 'CLOSED',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        UNIQUE(user_id, year, month)
      );
    `);
    console.log("Created monthly_time_balances table.");
    
    // 2. Enable RLS and create policies
    await client.query(`
      ALTER TABLE public.monthly_time_balances ENABLE ROW LEVEL SECURITY;
      
      -- Drop policies if exist
      DROP POLICY IF EXISTS "Allow users to view own monthly balances or admin to view company balances" ON public.monthly_time_balances;
      DROP POLICY IF EXISTS "Allow admin to insert monthly balances" ON public.monthly_time_balances;
      DROP POLICY IF EXISTS "Allow admin to update monthly balances" ON public.monthly_time_balances;
      DROP POLICY IF EXISTS "Allow admin to delete monthly balances" ON public.monthly_time_balances;

      CREATE POLICY "Allow users to view own monthly balances or admin to view company balances" ON public.monthly_time_balances 
        FOR SELECT TO authenticated 
        USING (public.get_user_role() = 'ROOT' OR user_id = auth.uid() OR (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id()));
      
      CREATE POLICY "Allow admin to insert monthly balances" ON public.monthly_time_balances 
        FOR INSERT TO authenticated 
        WITH CHECK (public.get_user_role() = 'ROOT' OR (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id()));
      
      CREATE POLICY "Allow admin to update monthly balances" ON public.monthly_time_balances 
        FOR UPDATE TO authenticated 
        USING (public.get_user_role() = 'ROOT' OR (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id()));
      
      CREATE POLICY "Allow admin to delete monthly balances" ON public.monthly_time_balances 
        FOR DELETE TO authenticated 
        USING (public.get_user_role() = 'ROOT' OR (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id()));
    `);
    console.log("Enabled RLS and created policies for monthly_time_balances.");

    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

runMigration();
