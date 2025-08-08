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
    const { lte } = await import('drizzle-orm');
    const { certifications, insertCertificationSchema } = await import('../shared/schema');

    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);

    if (req.method === 'GET') {
      const url = req.url || '';
      const expiringMatch = url.match(/\/expiring\/(\d+)$/);
      
      if (expiringMatch) {
        const days = parseInt(expiringMatch[1]);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() + days);
        
        const expiringCerts = await db
          .select()
          .from(certifications)
          .where(lte(certifications.expiryDate, cutoffDate));
        
        return res.status(200).json(expiringCerts);
      } else {
        const allCertifications = await db.select().from(certifications);
        return res.status(200).json(allCertifications);
      }
    }

    if (req.method === 'POST') {
      const validatedData = insertCertificationSchema.parse(req.body);
      const processedData = {
        ...validatedData,
        issuedDate: validatedData.issuedDate ? new Date(validatedData.issuedDate) : new Date(),
        expiryDate: validatedData.expiryDate ? new Date(validatedData.expiryDate) : null,
      };
      const [certification] = await db.insert(certifications).values(processedData).returning();
      return res.status(201).json(certification);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    console.error('Certifications API Error:', error);
    
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
      code: 'CERTIFICATIONS_ERROR'
    });
  }
}