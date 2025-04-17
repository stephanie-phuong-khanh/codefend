// app/api/repositories/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  {params}: {params: Promise<{ id: string }>}
) {
  try {
    const repoId = parseInt((await params).id);
    
    if (isNaN(repoId)) {
      return NextResponse.json({ error: 'Invalid repository ID' }, { status: 400 });
    }
    
    const repository = await prisma.repository.findUnique({
      where: {
        id: repoId,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    if (!repository) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }
    
    return NextResponse.json(repository);
  } catch (error) {
    console.error('Error fetching repository:', error);
    return NextResponse.json({ error: 'Failed to fetch repository' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  {params}: {params: Promise<{ id: string }>}
) {
  try {
    const repoId = parseInt((await params).id);
    
    if (isNaN(repoId)) {
      return NextResponse.json({ error: 'Invalid repository ID' }, { status: 400 });
    }
    
    const body = await request.json();
    const { dependenciesPath, setupCommand, compileCommand, testCommand, isConfigured } = body;
    
    const repository = await prisma.repository.update({
      where: {
        id: repoId,
      },
      data: {
        dependenciesPath,
        setupCommand,
        compileCommand,
        testCommand,
        isConfigured: isConfigured ?? true,
      },
    });
    
    return NextResponse.json(repository);
  } catch (error) {
    console.error('Error updating repository:', error);
    return NextResponse.json({ error: 'Failed to update repository' }, { status: 500 });
  }
}
