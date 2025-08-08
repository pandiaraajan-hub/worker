import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set headers first - this is critical for JSON responses
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Import database modules inside try block to catch import errors
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    const { workers, courses, certifications } = await import('../shared/schema');

    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);

    const [allWorkers, allCourses, allCertifications] = await Promise.all([
      db.select().from(workers),
      db.select().from(courses), 
      db.select().from(certifications)
    ]);

    const expiringSoon = allCertifications.filter(cert => {
      if (!cert.expiryDate) return false;
      const expiry = new Date(cert.expiryDate);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return expiry <= thirtyDaysFromNow;
    });

    const stats = {
      totalWorkers: allWorkers.length,
      activeCourses: allCourses.filter(c => c.isActive).length,
      totalCertifications: allCertifications.length,
      expiringSoon: expiringSoon.length
    };

    return res.status(200).json(stats);

  } catch (error: any) {
    console.error('Stats API Error:', error);
    
    // Return JSON error response, never HTML
    return res.status(500).json({
      error: 'Database connection failed',
      message: error?.message || 'Unknown error',
      code: 'STATS_ERROR'
    });
  }
}