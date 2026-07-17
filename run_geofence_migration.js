const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const projectId = process.env.NEXT_PUBLIC_SUPABASE_URL.split('//')[1].split('.')[0];
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
// Pooler URL
const connectionString = `postgresql://postgres.${projectId}:${encodeURIComponent(dbPassword)}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;

async function main() {
  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log('Connected to DB. Running migration...');

    const sql = `
      ALTER TABLE public.companies 
      ADD COLUMN IF NOT EXISTS address_street TEXT,
      ADD COLUMN IF NOT EXISTS address_zip TEXT,
      ADD COLUMN IF NOT EXISTS address_city TEXT,
      ADD COLUMN IF NOT EXISTS latitude DECIMAL,
      ADD COLUMN IF NOT EXISTS longitude DECIMAL,
      ADD COLUMN IF NOT EXISTS geofence_radius_meters INTEGER DEFAULT 150;
    `;

    await client.query(sql);
    console.log('Migration successful: Added address and geofence columns to companies table.');
  } catch (err) {
    console.error('Error running migration:', err);
  } finally {
    await client.end();
  }
}

main();
