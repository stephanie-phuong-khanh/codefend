// dashboard/app/api/github/organizations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

export async function GET(request: NextRequest) {
  try {
    // Get the user from the session
    const sessionCookie = request.cookies.get('session_token');
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const payload = jwt.verify(
      sessionCookie.value,
      process.env.JWT_SECRET || 'development-secret'
    ) as { userId: string };
    
    // Get the user with their GitHub token
    const user = await prisma.user.findUnique({
      where: { id: parseInt(payload.userId) }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Fetch organizations from GitHub
    const orgsResponse = await fetch('https://api.github.com/user/orgs', {
      headers: {
        'Authorization': `token ${user.githubOauthToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!orgsResponse.ok) {
      return NextResponse.json({ 
        error: 'Failed to fetch organizations from GitHub',
        details: await orgsResponse.text()
      }, { status: orgsResponse.status });
    }
    
    const orgs = await orgsResponse.json();
    
    // Get all connected organizations for this user from the database
    const connectedOrgs = await prisma.organization.findMany({
      where: {
        githubInstallationId: { not: null },
        members: {
          some: {
            userId: parseInt(payload.userId)
          }
        }
      }
    });
    
    // Create a map of GitHub org IDs to connected status from database
    const connectedOrgMap = new Map<string, { isConnected: boolean; organizationId: number }>();
    connectedOrgs.forEach((org: { id: number; githubOrgId: string }) => {
      connectedOrgMap.set(org.githubOrgId, {
        isConnected: true,
        organizationId: org.id
      });
    });
    
    // Create GitHub App Octokit instance to check for installations
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID!,
        privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
      }
    });
    
    // Get all installations for the GitHub App
    const { data: installations } = await appOctokit.apps.listInstallations();
    
    // Create a map of GitHub account IDs to installation IDs
    const installationMap = new Map<number, string>();
    installations.forEach((installation) => {
      if (installation.account && 'id' in installation.account) {
        installationMap.set(installation.account.id, installation.id.toString());
      }
    });
    
    // Add connection status to each organization, checking both database and GitHub API
    const orgsWithConnectionStatus = await Promise.all(orgs.map(async (org: { id: number; login: string; [key: string]: any }) => {
      // Check if we have it in our database
      const dbConnection = connectedOrgMap.get(org.id.toString());
      
      // Check if it's installed on GitHub
      const installationId = installationMap.get(org.id);
      
      // If it's in our database, use that info
      if (dbConnection) {
        return {
          ...org,
          connectionStatus: dbConnection
        };
      }
      
      // If it's installed on GitHub but not in our database, we need to create the record
      if (installationId) {
        try {
          // Create organization record in database
          const newOrg = await prisma.organization.create({
            data: {
              name: org.login,
              githubOrgId: org.id.toString(),
              githubInstallationId: installationId,
              createdAt: new Date(),
              updatedAt: new Date(),
              members: {
                create: {
                  userId: parseInt(payload.userId),
                  role: 'ADMIN',
                  createdAt: new Date(),
                  updatedAt: new Date()
                }
              }
            },
            include: {
              members: true
            }
          });
          
          return {
            ...org,
            connectionStatus: {
              isConnected: true,
              organizationId: newOrg.id
            }
          };
        } catch (error) {
          console.error('Error creating organization record:', error);
        }
      }
      
      // If not connected in either place
      return {
        ...org,
        connectionStatus: { isConnected: false }
      };
    }));
    
    return NextResponse.json({
      organizations: orgsWithConnectionStatus
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}
