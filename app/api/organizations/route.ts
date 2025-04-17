// app/api/organizations/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    // Get session cookie and verify authentication
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session_token');
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const payload = jwt.verify(
      sessionCookie.value, 
      process.env.JWT_SECRET || 'development-secret'
    ) as { userId: string };
    
    // Get user's organizations with repositories
    const organizations = await prisma.organization.findMany({
      where: {
        members: {
          some: {
            userId: parseInt(payload.userId)
          }
        }
      },
      include: {
        repositories: true
      }
    });

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' }, 
      { status: 500 }
    );
  }
}
