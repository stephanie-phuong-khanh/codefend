// app/api/user/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { Octokit } from '@octokit/rest';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Get the session token from cookies
    const sessionCookie = request.cookies.get('session_token');
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Verify the JWT token
    const payload = jwt.verify(
      sessionCookie.value,
      process.env.JWT_SECRET || 'development-secret'
    ) as { userId: string };
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: parseInt(payload.userId) }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Use GitHub OAuth token to fetch additional user info from GitHub API
    const octokit = new Octokit({
      auth: user.githubOauthToken
    });
    
    // Get GitHub user information
    const githubUserResponse = await octokit.users.getAuthenticated();
    const githubUser = githubUserResponse.data;
    
    // Return user profile with GitHub information
    return NextResponse.json({
      id: user.id,
      email: user.email,
      github: {
        id: githubUser.id,
        login: githubUser.login,
        name: githubUser.name,
        avatarUrl: githubUser.avatar_url
      }
    });
    
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' }, 
      { status: 500 }
    );
  }
}
