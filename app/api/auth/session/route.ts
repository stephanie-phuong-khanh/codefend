// app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Get the session token from cookies
    const sessionCookie = request.cookies.get('session_token');
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }
    
    // Verify the JWT token
    const payload = jwt.verify(
      sessionCookie.value,
      process.env.JWT_SECRET || 'development-secret'
    ) as { userId: string };
    
    // Check if the user exists in the database
    const user = await prisma.user.findUnique({
      where: { id: parseInt(payload.userId) }
    });
    
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }
    
    // User is authenticated
    return NextResponse.json({ 
      authenticated: true,
      userId: user.id
    }, { status: 200 });
    
  } catch (error) {
    // JWT verification failed or other error
    console.error('Session verification error:', error);
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}
