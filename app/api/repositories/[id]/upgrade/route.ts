// dashboard/app/api/repositories/[id]/upgrade/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exec, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import os from 'os';
import { jobStore, LogEntry, UpgradeStatus, updateJobStatus, getJobStatus, appendToOutput, addLogEntry } from '@/lib/job-utils';

// POST: Start a new package upgrade process
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const repoId = parseInt((await context.params).id);
    const { packageName, newVersion } = await request.json();

    // Validate input
    if (!packageName || !newVersion) {
      return NextResponse.json(
        { error: 'Package name and new version are required' },
        { status: 400 }
      );
    }

    // Get repository from database
    const repository = await prisma.repository.findUnique({
      where: { id: repoId },
      include: {
        organization: true
      }
    });

    if (!repository) {
      return NextResponse.json(
        { error: 'Repository not found' }, 
        { status: 404 }
      );
    }

    if (!repository.organization) {
      return NextResponse.json(
        { error: 'Repository organization not found' }, 
        { status: 404 }
      );
    }

    // Generate unique job ID for this upgrade task
    const jobId = `upgrade-${repoId}-${Date.now()}`;

    // Initialize job status with only a single log entry for CLI output
    const cliOutputLogId = uuidv4();
    const initialEntry: LogEntry = {
      id: cliOutputLogId,
      timestamp: new Date().toISOString(),
      type: 'info',
      message: 'Upgrade',
      details: `Starting upgrade process for ${packageName} to version ${newVersion}\n`
    };

    // Store initial status with just the CLI output entry
    const initialStatus: UpgradeStatus = {
      jobId,
      status: 'pending',
      logs: [initialEntry],
    };
    jobStore.set(jobId, initialStatus);

    // Create a temporary directory for the repository
    let tempDir = '';
    try {
      // Create a temporary directory
      tempDir = path.join(os.tmpdir(), `codefend-upgrade-${jobId}`);
      
      // Make sure it doesn't exist
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });
      
      // Store temp directory in job status for later cleanup
      updateJobStatus(jobId, { tempDir });
      
      // Add to CLI output instead of creating separate entries
      appendToOutput(jobId, cliOutputLogId, `Created temporary directory at ${tempDir}\n`);

      // Get GitHub App name based on environment
      const githubAppName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'codefend-ai';
      
      // Initialize Octokit with GitHub App credentials
      const octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: process.env.GITHUB_APP_ID,
          privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
          installationId: repository.organization.githubInstallationId
        }
      });

      // Get installation token for the organization
      const { token } = (await octokit.auth({
        type: 'installation',
        installationId: repository.organization.githubInstallationId
      })) as { token: string };

      // Clone the repository
      const owner = repository.organization.name;
      const repoName = repository.name;
      
      appendToOutput(jobId, cliOutputLogId, `Cloning ${owner}/${repoName} into temporary directory\n`);
      
      execSync(`git clone https://x-access-token:${token}@github.com/${owner}/${repoName}.git .`, 
        { cwd: tempDir });
        
      appendToOutput(jobId, cliOutputLogId, `Repository ${owner}/${repoName} has been cloned successfully\n\n`);

    } catch (error) {
      console.error('Error cloning repository:', error);
      
      // Mark job as failed
      updateJobStatus(jobId, {
        status: 'failed',
        error: 'Failed to clone repository',
        completedAt: new Date().toISOString(),
      });
      
      appendToOutput(jobId, cliOutputLogId, `ERROR: Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error occurred'}\n`);
      
      return NextResponse.json({ 
        jobId,
        error: 'Failed to clone repository',
        message: 'Package upgrade failed during repository clone' 
      }, { status: 500 });
    }

    // Start the CLI process in the background - pass the temporary directory
    startUpgradeProcess(jobId, cliOutputLogId, packageName, newVersion, tempDir);

    // Return the job ID which can be used for SSE
    return NextResponse.json({ 
      jobId,
      message: 'Package upgrade started successfully' 
    });
  } catch (error) {
    console.error('Error starting package upgrade:', error);
    return NextResponse.json(
      { error: 'Failed to start package upgrade' },
      { status: 500 }
    );
  }
}

// GET: Stream status updates using SSE
export async function GET(
  request: NextRequest,
  {params}: {params: Promise<{ id: string }>}
) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json(
      { error: 'Job ID is required' },
      { status: 400 }
    );
  }

  // Get initial status
  const initialStatus = getJobStatus(jobId);
  
  if (!initialStatus) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 }
    );
  }

  // For non-streaming requests, return current status
  if (searchParams.get('stream') !== 'true') {
    return NextResponse.json(initialStatus);
  }

  // Set up SSE headers
  const encoder = new TextEncoder();
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  };

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Send initial status
      const data = `data: ${JSON.stringify(initialStatus)}\n\n`;
      controller.enqueue(encoder.encode(data));
      
      // Set up interval to check for updates
      const intervalId = setInterval(() => {
        const status = getJobStatus(jobId);
        
        if (!status) {
          clearInterval(intervalId);
          controller.close();
          return;
        }
        
        // Send current status
        const data = `data: ${JSON.stringify(status)}\n\n`;
        controller.enqueue(encoder.encode(data));
        
        // If job is completed or failed, end the stream
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(intervalId);
          controller.close();
        }
      }, 1000);
      
      // Store the interval ID to clear it when the client disconnects
      // @ts-ignore - Adding a custom property to the controller
      controller.intervalId = intervalId;
    },
    cancel(reason) {
      // @ts-ignore - Accessing the custom property
      clearInterval(this.intervalId);
    },
  });

  return new Response(stream, { headers });
}

// Helper function to start the upgrade process
async function startUpgradeProcess(jobId: string, cliOutputLogId: string, packageName: string, newVersion: string, directory: string) {
  try {
    // Update status to running
    updateJobStatus(jobId, {
      status: 'running',
    });
    
    // Build CLI command - assumes CLI is in the project root
    const cliPath = path.resolve(process.cwd(), 'cli/src/index.ts');
    const command = `npx ts-node ${cliPath} --package ${packageName} --new-version ${newVersion} --directory ${directory} --ai-provider gemini --max-fix-attempts 5`;
    
    // Execute the command
    const childProcess = exec(command);
    
    // Capture stdout
    childProcess.stdout?.on('data', (data) => {
      const newData = data.toString();
      appendToOutput(jobId, cliOutputLogId, newData);
    });
    
    // Capture stderr
    childProcess.stderr?.on('data', (data) => {
      const newData = data.toString();
      appendToOutput(jobId, cliOutputLogId, `[ERROR] ${newData}`);
    });
    
    // Handle process completion
    childProcess.on('close', (code) => {
      try {
        if (code === 0) {
          // Mark job as completed but keep the temporary directory
          updateJobStatus(jobId, {
            status: 'completed',
            completedAt: new Date().toISOString(),
          });
          
          appendToOutput(jobId, cliOutputLogId, `\n✅ Process completed successfully with exit code ${code}`);
        } else {
          // Mark job as failed and clean up the temporary directory
          updateJobStatus(jobId, {
            status: 'failed',
            error: `Process exited with code ${code}`,
            completedAt: new Date().toISOString(),
          });
          
          appendToOutput(jobId, cliOutputLogId, `\n❌ Process failed with exit code ${code}`);
          
          // Clean up the temporary directory if it exists since we failed
          const status = getJobStatus(jobId);
          if (status?.tempDir && fs.existsSync(status.tempDir)) {
            appendToOutput(jobId, cliOutputLogId, `\nCleaning up temporary directory: ${status.tempDir}`);
              
            try {
              fs.rmSync(status.tempDir, { recursive: true, force: true });
              appendToOutput(jobId, cliOutputLogId, `Cleanup successful`);
            } catch (error) {
              console.error('Error during cleanup:', error);
              appendToOutput(jobId, cliOutputLogId, `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
      } catch (error) {
        console.error('Error in process completion handler:', error);
      }
    });
  } catch (error) {
    console.error('Error running CLI upgrade:', error);
    updateJobStatus(jobId, {
      status: 'failed',
      error: String(error),
      completedAt: new Date().toISOString(),
    });
    
    appendToOutput(jobId, cliOutputLogId, `\n❌ Fatal error in upgrade process: ${error instanceof Error ? error.message : String(error)}`);
  }
}
