import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://lumiere:lumiere_pass@localhost:5432/lumiere_academy',
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database...');

    const adminHash = await bcrypt.hash('Admin123!', 12);
    const userHash = await bcrypt.hash('User123!', 12);

    await client.query(`
      INSERT INTO users (email, password_hash, name, role) VALUES
        ('admin@lumiere.com', $1, 'Lumière Admin', 'admin'),
        ('user@lumiere.com', $2, 'Test User', 'user')
      ON CONFLICT (email) DO NOTHING
    `, [adminHash, userHash]);

    const catResult = await client.query('SELECT id, slug FROM categories');
    const cats: Record<string, string> = {};
    catResult.rows.forEach(r => { cats[r.slug] = r.id; });

    await client.query(`
      INSERT INTO courses (title, description, instructor_name, thumbnail_url, price, category_id, badge, total_lessons, total_duration, is_membership_exclusive, is_published)
      VALUES
        ('The Art of Editorial Precision', 'Master the art of editorial cutting with world-class techniques used on international runways. This comprehensive course covers everything from consultation to finishing touches.', 'Julianne Voss', 'https://lh3.googleusercontent.com/aida-public/AB6AXuB5HKWE2OaSn5SYEGQTs4J3yS_Evj9mOcXvzjM42wKOskXVEh7-X8MJx5xRXajQjY2TvJUw4Cgm_WHVVOixi352npq7Q0Oer8YAjfUpa-vIPMcwpkx6hagSEJg9wa3Aufnwrw5R93rUBtYPnC2QvJRNVAykYJ6Hmy6BT_e0ouqk1CrFHhyUtnLskWnhz1IreQCJ8h4vYs1UsJennljTGws06OtI9f9dTCcHEi27vWPSTJ7CgdeFDU4Cdg5VaeBPtHtcM8vSMSy2IM9h', 249.00, $1, 'Masterclass', 12, '4h 20m', false, true),
        ('Modern Bridal Architecture', 'From soft romantic waves to structured upswept masterpieces, this course teaches every bridal style a modern stylist needs to command premium bridal bookings.', 'Elena Moretti', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCKDtyEDow1qeLz9ywHV6hwUffPCtYUmkcXYvz4qdkXXJ8tm2zCB9WzBUXg-vpcODAOI9zbjiBt_MdDOvQmu_3hOp4Fno5Ib0kA7FE-jJXDLDhXJIzFeyraFiFhtZmFwKH16Q-mkFtIG6uwd9HA5ds9FSfDPIJQmCUhxkBj3nI4-d3gV7PmpoyUXIuI_kmWQU9GmBcoDHrkh-WHkFUze3nh-G7tuJD3T7FsIvU5e1nyNhCh42eGPPV6g178WXtN427MtFccbDS4dDlm', null, $2, 'Membership Exclusive', 8, '3h 15m', true, true),
        ('Sculpting with Color & Light', 'Advanced balayage and color techniques for the modern colorist. Learn seamless dimension, tonal placement, and corrective color with precision.', 'Marcus Thorne', 'https://lh3.googleusercontent.com/aida-public/AB6AXuDJ9LVfqRBexVqy9ulvxXY-fq665IybrDg768RRFCXQjM2d8fb-nEyNSSHCIlv8GQZ7y-uLmC29ZmG43N76sU8yCgmVFUyfqIn1colxi6TMAGddwgBCXle_dTX-t0eEzTru2sjviIdH1n6IGxNNoXwUBS0ljPPO6EwoCvQSj7zpAlwmwjHPal3BNtMmuocJ-c04EthK2zhFLdiIgtzvHfJllXcEWMpK77fdP4yNH_rbFfhCSKc4GZl50MWJGlqUVXsNKPoKZR8C8rp-', 189.00, $3, 'Trending', 10, '5h 05m', false, true),
        ('Geometric Form & Fluidity', 'Explore the intersection of architecture and movement in modern haircuts. From sharp bobs to layered movement, this course redefines precision cutting.', 'Sarah Jenkins', 'https://lh3.googleusercontent.com/aida-public/AB6AXuD7HExmwfaYMPFzJAmRw6W17Ni-axSZqjoIKF9JhghClfQwVtkZk3DZYLUKqTe1tyMhf2N-pNnguw-hWqBdYF0eULUUPRVYq5m4Owe5P-7yFIqSdnDpmCBbKM0bRIFNR8v_n-cgPHlKDxf7jmvYr40QUMPNDm9zSDoeNtD9TpdXjZHX5rxPmX9Kl8sbpDHEJqkNb2JOzVwx1QgbutiDql_YxraoChWO-958W9cwpyidzrTQ8kfzIQuwZysHUy9m_RM1MAp3ET0uhbwd', 159.00, $1, null, 7, '2h 45m', false, true),
        ('Branding Your Artistry', 'Turn your craft into a thriving business. Learn salon management, personal branding, social media strategy and client retention from industry leaders.', 'David Lumière', 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmogIIjsBNsZ1SgtKXcuX0NGhCOcAvOK0fLMm579iTeKG1dk_ptojBEukRVoC4Yl1aqfRJRos6-duYv4_rYwDS727dBAGTaeqnJc03Tk4QOzROJhGgAVjW4ws5U-ZtuzbZnvrHsLlQ9Z_gbK0unel0vUF7BpjctlNWnCn5Uq79SIXowu4TC0G5zKVmvntBlZOuBp5as9_qQ5RDihTn0ivO-8LPAsUINQQP3oJurPegsLBSgOjrMxx_CHTMRzD-aqREthE96I0anMPJ', null, $4, 'Membership Exclusive', 15, '6h 30m', true, true),
        ('Mastering the Session Workflow', 'Go behind the scenes of top fashion shoots. Learn time management, kit preparation, mood board execution and real-time problem solving.', 'Clara Dubois', 'https://lh3.googleusercontent.com/aida-public/AB6AXuACvTlDQvWTfnB9GF7ORRSYVD-aMyFt3TU3_vRfVh1LY0AhMjb5YwuMz1XRhmh3qDlQKMsCNoaAlsTjYbTVKU8dVvuHFfOdCOBmP1W8R0BShU_vKdnUAltzqW_JimHi2M2itMJIAn-ey6ET-z0ntGel7ewRT2Q3xtKdnKepuxB5OLSYMWeTL0Y8_tKtT7RuBBgwmsaji3M5S093agdHnk72y2cEsc2UaQfm0A9eTm6JiR4Mlgk6XL7R_P8nGSYqSoAapm3JgUscEpyG', 299.00, $5, 'New Release', 9, '4h 50m', false, true)
    `, [cats['cut'], cats['bridal'], cats['color'], cats['business'], cats['styling']]);

    const coursesResult = await client.query('SELECT id, title FROM courses LIMIT 6');
    for (const course of coursesResult.rows) {
      await client.query(`
        INSERT INTO lessons (course_id, title, description, duration, order_index, section_number, section_title, lesson_type)
        VALUES
          ($1, 'Introduction & Overview', 'Welcome to the course. In this lesson we set the foundation for everything to come.', '08 MIN', 1, 1, 'Foundations', 'video'),
          ($1, 'Tools & Materials', 'Essential tools and how to maintain them for peak performance.', '12 MIN', 2, 1, 'Foundations', 'video'),
          ($1, 'Core Technique Part 1', 'Dive into the primary technique with step-by-step guidance.', '20 MIN', 1, 2, 'Core Techniques', 'video'),
          ($1, 'Core Technique Part 2', 'Advanced application and refinement of the core technique.', '25 MIN', 2, 2, 'Core Techniques', 'video'),
          ($1, 'Knowledge Check', 'Test your understanding with a quick quiz.', '5 QUESTIONS', 3, 2, 'Core Techniques', 'quiz'),
          ($1, 'Finishing & Styling', 'Professional finishing techniques for a polished result.', '18 MIN', 1, 3, 'Finishing', 'video')
        ON CONFLICT DO NOTHING
      `, [course.id]);

      await client.query(
        'UPDATE courses SET total_lessons = (SELECT COUNT(*) FROM lessons WHERE course_id = $1) WHERE id = $1',
        [course.id]
      );
    }

    console.log('✅ Database seeded successfully!');
    console.log('');
    console.log('Default credentials:');
    console.log('  Admin: admin@lumiere.com / Admin123!');
    console.log('  User:  user@lumiere.com  / User123!');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
