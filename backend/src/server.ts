import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { pool } from './config/database';

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connected');
    app.listen(PORT, () => {
      console.log(`🚀 Lumière Academy API running on http://localhost:${PORT}`);
      console.log(`   Admin: admin@lumiere.com / Admin123!`);
      console.log(`   User:  user@lumiere.com  / User123!`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
