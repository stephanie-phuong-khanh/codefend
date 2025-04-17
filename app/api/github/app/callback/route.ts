// dashboard/app/api/github/app/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const installationId = request.nextUrl.searchParams.get('installation_id');
  const setupAction = request.nextUrl.searchParams.get('setup_action');
  const state = request.nextUrl.searchParams.get('state'); // This could contain the org ID from GitHub
  
  console.log('[DEBUG] GitHub App callback received:', {
    installationId,
    setupAction,
    state
  });
  
  if (!installationId) {
    return NextResponse.redirect(new URL('/dashboard?error=missing_installation', request.url));
  }
  
  try {
    // Get the current user from session
    const sessionCookie = request.cookies.get('session_token');
    if (!sessionCookie?.value) {
      return NextResponse.redirect(new URL('/?error=not_authenticated', request.url));
    }
    
    const payload = jwt.verify(
      sessionCookie.value,
      process.env.JWT_SECRET || 'development-secret'
    ) as { userId: string };

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID!,
        privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
        installationId: Number(installationId)
      }
    });

    // Get installation details
    const { data: installation } = await octokit.apps.getInstallation({
      installation_id: Number(installationId)
    });

    // If installation is null, redirect to error page
    if (!installation || !installation.account) {
      return NextResponse.redirect(new URL('/dashboard?error=installation_error', request.url));
    }
    console.log('[DEBUG] Installation details:', installation);
    
    // Get account name - handle both user and organization account types
    const accountName = 'login' in installation.account 
      ? installation.account.login 
      : installation.account.name || 'Unknown Organization';
    
    // Create or update organization record
    const organization = await prisma.organization.upsert({
      where: { 
        githubOrgId: installation.account.id.toString() 
      },
      update: {
        githubInstallationId: installationId,
        updatedAt: new Date()
      },
      create: {
        name: accountName,
        githubOrgId: installation.account.id.toString(),
        githubInstallationId: installationId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // Connect user to organization if not already
    await prisma.orgMembership.upsert({
      where: {
        userId_organizationId: {
          userId: parseInt(payload.userId),
          organizationId: organization.id
        }
      },
      update: {
        updatedAt: new Date()
      },
      create: {
        userId: parseInt(payload.userId),
        organizationId: organization.id,
        role: 'ADMIN', // First user is admin
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // TODO: Do not automatically create Repository database entries for all repositories
    // that are fetched from GitHub. The user will need to manually select repositories and
    // set up scan configurations, including setup, compile, test commands and scan cadence.
    // Fetch repositories for analysis
    // const { data: repos } = await octokit.rest.repos.listForOrg({
    //   org: installation.account.login,
    //   per_page: 100
    // });
    
    // // Register repositories in database (could be done asynchronously)
    // for (const repo of repos) {
    //   await prisma.repository.upsert({
    //     where: { githubRepoId: repo.id.toString() },
    //     update: { updatedAt: new Date() },
    //     create: {
    //       name: repo.name,
    //       githubRepoId: repo.id.toString(),
    //       organizationId: organization.id,
    //       createdAt: new Date(),
    //       updatedAt: new Date()
    //     }
    //   });
    // }

    // Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));

  } catch (error) {
    console.error('[ERROR] GitHub App callback error:', error);
    return NextResponse.redirect(new URL('/dashboard?error=installation_error', request.url));
  }
}
