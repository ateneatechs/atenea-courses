import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://lumiere:lumiere_pass@localhost:5432/atenea_courses',
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');

    const tenantResult = await client.query("SELECT id FROM tenants WHERE slug = 'naza-barber'");
    const tenantId = tenantResult.rows[0]?.id;

    const adminHash = await bcrypt.hash('Admin123!', 12);
    const userHash = await bcrypt.hash('User123!', 12);

    await client.query(`
      INSERT INTO users (email, password_hash, name, role, tenant_id) VALUES
        ('admin@atenea.com', $1, 'Atenea Admin', 'admin', $3),
        ('user@atenea.com', $2, 'Usuario Demo', 'user', $3)
      ON CONFLICT (email) DO NOTHING
    `, [adminHash, userHash, tenantId]);

    // Super-admin (no tenant, controla TODOS los tenants) — nunca sembrarlo con una
    // contraseña hardcodeada en el código fuente cuando es un despliegue de producción.
    const isProduction = process.env.NODE_ENV === 'production';
    const superadminPassword = process.env.SEED_SUPERADMIN_PASSWORD;

    if (isProduction && !superadminPassword) {
      console.log('');
      console.log('Saltando creación de superadmin@atenea.com: NODE_ENV=production y no se');
      console.log('definió SEED_SUPERADMIN_PASSWORD. Para crearla (una sola vez), corré:');
      console.log('  SEED_SUPERADMIN_PASSWORD="<password-fuerte>" npx ts-node --transpile-only src/seed.ts');
    } else {
      const superHash = await bcrypt.hash(superadminPassword || 'SuperAdmin123!', 12);
      await client.query(`
        INSERT INTO users (email, password_hash, name, role, tenant_id)
        VALUES ('superadmin@atenea.com', $1, 'Super Admin', 'super_admin', NULL)
        ON CONFLICT (email) DO NOTHING
      `, [superHash]);
    }

    console.log('Database seeded successfully!');
    console.log('');
    console.log('Credenciales:');
    console.log('  Admin:      admin@atenea.com      / Admin123!');
    console.log('  User:       user@atenea.com       / User123!');
    if (!isProduction || superadminPassword) {
      console.log(`  SuperAdmin: superadmin@atenea.com / ${superadminPassword || 'SuperAdmin123!'}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
