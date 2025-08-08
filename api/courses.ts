import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    const { courses, insertCourseSchema } = await import('../shared/schema');

    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);

    if (req.method === 'GET') {
      const allCourses = await db.select().from(courses);
      return res.status(200).json(allCourses);
    }

    if (req.method === 'POST') {
      const validatedData = insertCourseSchema.parse(req.body);
      const [course] = await db.insert(courses).values(validatedData).returning();
      return res.status(201).json(course);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    console.error('Courses API Error:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    return res.status(500).json({ 
      error: 'Database operation failed',
      message: error?.message || 'Unknown error',
      code: 'COURSES_ERROR'
    });
  }
}