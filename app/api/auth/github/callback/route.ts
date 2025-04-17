// app/api/auth/github/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
        return NextResponse.redirect(new URL('/?error=token_error', request.url));
    }

    // Get user data
    const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${tokenData.access_token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
    });
      
    const userData = await userResponse.json();

    // Get user's email
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `token ${tokenData.access_token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
    });
      
    const emails = await emailsResponse.json();
    const primaryEmail = emails.find((email: { primary: any; }) => email.primary)?.email || emails[0]?.email;

    // Create or update user
    const user = await prisma.user.upsert({
        where: { githubUserId: userData.id.toString() },
        update: {
          githubOauthToken: tokenData.access_token,
          updatedAt: new Date()
        },
        create: {
          email: primaryEmail,
          githubUserId: userData.id.toString(),
          githubOauthToken: tokenData.access_token,
          createdAt: new Date(),
          updatedAt: new Date()
        }
    });
    console.log('[DEBUG] User:', user);

    // Create JWT session
    const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET || 'development-secret',
        { expiresIn: '7d' }
    );

    // Set cookie
    (await cookies()).set({
        name: 'session_token',
        value: token,
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    });

    // Redirect to org selection for new users or dashboard for returning users
    if (user.createdAt.getTime() === user.updatedAt.getTime()) {
        return NextResponse.redirect(new URL('/onboarding', request.url));
    } else {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  } catch (error) {
    console.error('Error during GitHub user authentication:', error);
    return NextResponse.redirect(new URL('/?error=oauth_error', request.url));
  }
}
