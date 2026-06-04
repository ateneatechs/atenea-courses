import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://lumiere:lumiere_pass@localhost:5432/atenea_courses',
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');

    const adminHash = await bcrypt.hash('Admin123!', 12);
    const userHash = await bcrypt.hash('User123!', 12);

    await client.query(`
      INSERT INTO users (email, password_hash, name, role) VALUES
        ('admin@atenea.com', $1, 'Atenea Admin', 'admin'),
        ('user@atenea.com', $2, 'Usuario Demo', 'user')
      ON CONFLICT (email) DO NOTHING
    `, [adminHash, userHash]);

    const catResult = await client.query('SELECT id, slug FROM categories');
    const cats: Record<string, string> = {};
    catResult.rows.forEach((r: { slug: string; id: string }) => { cats[r.slug] = r.id; });

    await client.query(`
      INSERT INTO courses (title, description, instructor_name, thumbnail_url, price, category_id, badge, total_lessons, total_duration, is_membership_exclusive, is_published)
      VALUES
        ('El Arte del Fade Perfecto', 'Domina todas las variaciones del fade desde cero hasta el nivel más avanzado. Técnicas de transición suave, skin fade y high fade explicadas paso a paso por un maestro barbero con más de 10 años de experiencia en competencias internacionales.', 'Marcos Delgado', 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80', 199.00, $1, 'Masterclass', 10, '3h 45m', false, true),
        ('Diseño y Perfilado de Barba', 'Aprende a diseñar, perfilar y dar forma a cualquier tipo de barba. Desde barba corta de oficina hasta full beard artística. Incluye técnica de navaja para líneas perfectas y mantenimiento profesional.', 'Rodrigo Fuentes', 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80', null, $2, 'Exclusivo Miembros', 8, '2h 50m', true, true),
        ('Corte Clásico con Tijera', 'Técnicas de tijera para cortes masculinos clásicos y modernos. Corte wet, texturizado, capas y acabado perfecto. El curso favorito de barberos que buscan diferenciarse con técnica de tijera premium.', 'Carlos Ibarra', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80', 149.00, $3, 'Trending', 9, '3h 10m', false, true),
        ('Colorimetría Masculina', 'Decoloración, matizado y coloración en cabello masculino. Aprende las bases del color, corrección de tono y las técnicas más demandadas en barberias premium: babylights, bleach & tone y gris platinado.', 'Valentina Cruz', 'https://images.unsplash.com/photo-1512690459411-b9245aed614d?w=800&q=80', 179.00, $4, 'Nuevo', 11, '4h 20m', false, true),
        ('Gestión de Barbería Exitosa', 'Transforma tu barbería en un negocio rentable. Precios, redes sociales, fidelización de clientes, gestión del tiempo y cómo armar un equipo de trabajo. Para barberos que quieren crecer más allá del sillón.', 'Diego Pereira', 'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?w=800&q=80', null, $5, 'Exclusivo Miembros', 14, '5h 30m', true, true),
        ('Styling y Acabados Masculinos', 'Productos, técnicas de secado y acabados profesionales para el cabello masculino. Desde el look natural hasta el peinado de red carpet. Aprende a recomendar y aplicar productos como un experto.', 'Tomás Ríos', 'https://images.unsplash.com/photo-1596728325488-58c87691e9af?w=800&q=80', 129.00, $1, null, 7, '2h 15m', false, true)
    `, [cats['fade'], cats['beard'], cats['clasico'], cats['colorimetria'], cats['negocio']]);

    const coursesResult = await client.query('SELECT id, title FROM courses LIMIT 6');
    for (const course of coursesResult.rows) {
      await client.query(`
        INSERT INTO lessons (course_id, title, description, duration, order_index, section_number, section_title, lesson_type)
        VALUES
          ($1, 'Introducción y materiales', 'Bienvenida al curso. Herramientas necesarias y preparación del puesto de trabajo.', '08 MIN', 1, 1, 'Fundamentos', 'video'),
          ($1, 'Análisis del cliente', 'Cómo leer la morfología del rostro y recomendar el corte ideal.', '12 MIN', 2, 1, 'Fundamentos', 'video'),
          ($1, 'Técnica principal - Parte 1', 'Desarrollo paso a paso de la técnica central del curso.', '22 MIN', 1, 2, 'Técnica', 'video'),
          ($1, 'Técnica principal - Parte 2', 'Aplicación avanzada y refinamiento de la técnica.', '28 MIN', 2, 2, 'Técnica', 'video'),
          ($1, 'Control de conocimiento', 'Evaluación de los conceptos aprendidos hasta el momento.', '5 PREGUNTAS', 3, 2, 'Técnica', 'quiz'),
          ($1, 'Acabados y presentación final', 'Técnicas de acabado profesional y presentación del resultado.', '18 MIN', 1, 3, 'Acabados', 'video')
        ON CONFLICT DO NOTHING
      `, [course.id]);

      await client.query(
        'UPDATE courses SET total_lessons = (SELECT COUNT(*) FROM lessons WHERE course_id = $1) WHERE id = $1',
        [course.id]
      );
    }

    console.log('Database seeded successfully!');
    console.log('');
    console.log('Credenciales:');
    console.log('  Admin: admin@atenea.com / Admin123!');
    console.log('  User:  user@atenea.com  / User123!');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
