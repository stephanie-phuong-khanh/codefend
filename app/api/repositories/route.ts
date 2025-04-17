// app/api/repositories/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      name, 
      githubRepoId, 
      organizationId, 
      dependenciesPath, 
      setupCommand, 
      compileCommand, 
      testCommand 
    } = body;
    
    // Validate required fields
    if (!name || !githubRepoId || !organizationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Create repository record
    const repository = await prisma.repository.create({
      data: {
        name,
        githubRepoId,
        organizationId,
        dependenciesPath,
        setupCommand,
        compileCommand,
        testCommand,
        isConfigured: true,
      },
    });

    return NextResponse.json({ repository });
  } catch (error) {
    console.error('Error creating repository:', error);
    return NextResponse.json({ error: 'Failed to create repository' }, { status: 500 });
  }
}
