// dashboard/app/api/repositories/[id]/pull-request/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { getJobStatus } from '@/lib/job-utils';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const repoId = parseInt((await context.params).id);
    const { jobId, packageName, newVersion, branchName, title, description } = await request.json();
    
    console.log(`[PR:${repoId}] Starting PR creation for upgrade job ${jobId}`);
    
    // Get repository from database
    const repository = await prisma.repository.findUnique({
      where: { id: repoId },
      include: { organization: true }
    });
    
    if (!repository) {
      console.log(`[PR:${repoId}] Repository not found`);
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }
    
    // Get the job data
    const upgradeStatus = getJobStatus(jobId);
    if (!upgradeStatus?.tempDir) {
      console.log(`[PR:${repoId}] Job ${jobId} not found or no temporary directory available`);
      return NextResponse.json({ 
        error: 'Upgrade job not found or no temporary directory available' 
      }, { status: 404 });
    }
    
    console.log(`[PR:${repoId}] Found temp directory: ${upgradeStatus.tempDir}`);
    
    // Check if the temporary directory exists
    if (!fs.existsSync(upgradeStatus.tempDir)) {
      console.log(`[PR:${repoId}] Temporary directory not found`);
      return NextResponse.json({ 
        error: 'Temporary directory does not exist' 
      }, { status: 404 });
    }

    if (!repository.organization.githubInstallationId) {
      console.log(`[PR:${repoId}] GitHub installation ID missing for organization`);
      return NextResponse.json({ 
        error: 'GitHub installation ID not found for this organization' 
      }, { status: 400 });
    }

    const installationId = Number(repository.organization.githubInstallationId);
    
    // Setup GitHub App API client
    console.log(`[PR:${repoId}] Setting up GitHub App authentication`);
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID,
        privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
      }
    });
    
    // Get installation token with proper permissions
    console.log(`[PR:${repoId}] Requesting installation token for ID: ${installationId}`);
    const { data: { token } } = await appOctokit.apps.createInstallationAccessToken({
      installation_id: installationId,
      permissions: {
        contents: 'write',
        pull_requests: 'write'
      }
    });
    
    // Create Octokit instance with the installation token
    const octokit = new Octokit({ auth: token });
    
    // Create a unique branch name if not provided
    const uniqueBranchName = branchName || `codefend-upgrade-${packageName}-${newVersion}-${Date.now()}`;
    console.log(`[PR:${repoId}] Will create branch: ${uniqueBranchName}`);
    
    // Get information about the repository
    const { data: repoData } = await octokit.repos.get({
      owner: repository.organization.name,
      repo: repository.name
    });
    
    const defaultBranch = repoData.default_branch;
    console.log(`[PR:${repoId}] Repository default branch: ${defaultBranch}`);
    
    // Get the reference for the default branch
    const { data: refData } = await octokit.git.getRef({
      owner: repository.organization.name,
      repo: repository.name,
      ref: `heads/${defaultBranch}`
    });
    
    // Create a new branch based on the default branch
    console.log(`[PR:${repoId}] Creating new branch from reference: ${refData.object.sha}`);
    await octokit.git.createRef({
      owner: repository.organization.name,
      repo: repository.name,
      ref: `refs/heads/${uniqueBranchName}`,
      sha: refData.object.sha
    });
    
    // Find all modified files in the temporary directory (excluding git files)
    const tempDir = upgradeStatus.tempDir;
    
    // Walk through the directory recursively to find all files
    function getAllFiles(dir: string, baseDir: string = ''): string[] {
      const files: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.join(baseDir, entry.name);
        
        // Skip node_modules, .git directories and any dot directories
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            files.push(...getAllFiles(fullPath, relativePath));
          }
        } else {
          // Only include regular files (not symlinks, etc.)
          if (entry.isFile()) {
            files.push(relativePath);
          }
        }
      }
      
      return files;
    }
    
    console.log(`[PR:${repoId}] Finding all files in ${tempDir}`);
    const allFiles = getAllFiles(tempDir);
    console.log(`[PR:${repoId}] Found ${allFiles.length} total files`);
    
    // Set of files we know we need to check (from package upgrade)
    const baseChangedFiles = ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].filter(
      file => fs.existsSync(path.join(tempDir, file))
    );
    
    // Now we need to figure out which other files might have been modified
    // We'll check each file to see if it exists in the target repo and compare contents where possible
    
    // Get all existing files in the repository first (to use for comparison)
    console.log(`[PR:${repoId}] Fetching repository file list for comparison`);
    
    // A function to detect if a file has been modified by comparing with repository
    async function isFileModified(filePath: string): Promise<boolean> {
      // Safety check - if repository is null, we can't check
      if (!repository) return false;
      
      // First check if it's a binary file (using a simple heuristic)
      const fullPath = path.join(tempDir, filePath);
      const stats = fs.statSync(fullPath);
      
      // Skip very large files or empty files
      if (stats.size > 10 * 1024 * 1024 || stats.size === 0) {
        return false;
      }
      
      try {
        // Check if the file exists in the repository
        const { data: fileData } = await octokit.repos.getContent({
          owner: repository.organization.name,
          repo: repository.name,
          path: filePath
        });
        
        // For binary files, we have to assume they're different
        // For text files, we can compare contents
        if (typeof fileData === 'object' && !Array.isArray(fileData) && fileData.type === 'file') {
          try {
            // Try to read as text
            const localContent = fs.readFileSync(fullPath, 'utf8');
            const repoContent = Buffer.from(fileData.content, 'base64').toString('utf8');
            
            // If they're different, file was modified
            return localContent !== repoContent;
          } catch (err) {
            // If we can't read as text, assume it's binary and hasn't changed
            return false;
          }
        }
        // If we get here, file exists but we couldn't determine if it changed
        return false;
      } catch (error: any) {
        // If file doesn't exist in the repo, it's new
        if (error.status === 404) {
          return true;
        }
        // For any other errors, let's be cautious and not include the file
        return false;
      }
    }
    
    // First add all known changed files
    let changedFiles = [...baseChangedFiles];
    
    // Now check source code files that might have been modified to fix breaking changes
    // Since checking every file would be expensive, focus on likely candidates
    const sourceExtensions = ['.js', '.jsx', '.ts', '.tsx'];
    const potentiallyModifiedFiles = allFiles.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return sourceExtensions.includes(ext) && !file.includes('node_modules');
    });
    
    // Check a reasonable batch of files (limit to avoid too many API calls)
    console.log(`[PR:${repoId}] Checking ${Math.min(potentiallyModifiedFiles.length, 20)} source files for changes`);
    const filesToCheck = potentiallyModifiedFiles.slice(0, 20); // Limit to 20 files
    
    // For source files, do a simple file content check
    for (const file of filesToCheck) {
      try {
        const isModified = await isFileModified(file);
        if (isModified) {
          console.log(`[PR:${repoId}] Detected modified file: ${file}`);
          changedFiles.push(file);
        }
      } catch (error) {
        console.error(`[PR:${repoId}] Error checking file ${file}:`, error);
      }
    }
    
    console.log(`[PR:${repoId}] Detected ${changedFiles.length} changed files to include in PR`);
    
    // Update or create each changed file
    for (const filePath of changedFiles) {
      const fullPath = path.join(tempDir, filePath);
      
      if (fs.existsSync(fullPath)) {
        console.log(`[PR:${repoId}] Updating file: ${filePath}`);
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        
        try {
          // First try to get the file to check if it exists
          await octokit.repos.getContent({
            owner: repository.organization.name,
            repo: repository.name,
            path: filePath,
            ref: uniqueBranchName
          });
          
          // If we got here, the file exists and we need to get its SHA
          const { data: fileData } = await octokit.repos.getContent({
            owner: repository.organization.name,
            repo: repository.name,
            path: filePath,
            ref: uniqueBranchName
          });
          
          // Update the file with the new content
          const fileSha = Array.isArray(fileData) ? undefined : fileData.sha;
          
          await octokit.repos.createOrUpdateFileContents({
            owner: repository.organization.name,
            repo: repository.name,
            path: filePath,
            message: `Update ${filePath} for ${packageName}@${newVersion}`,
            content: Buffer.from(fileContent).toString('base64'),
            branch: uniqueBranchName,
            sha: fileSha
          });
        } catch (error: any) {
          if (error.status === 404) {
            // File doesn't exist, create it
            await octokit.repos.createOrUpdateFileContents({
              owner: repository.organization.name,
              repo: repository.name,
              path: filePath,
              message: `Create ${filePath} for ${packageName}@${newVersion}`,
              content: Buffer.from(fileContent).toString('base64'),
              branch: uniqueBranchName
            });
          } else {
            throw error; // Re-throw if it's another type of error
          }
        }
      }
    }
    
    // Create the Pull Request
    const prTitle = title || `Upgrade ${packageName} to version ${newVersion}`;
    const prDescription = description || 
      `This PR upgrades ${packageName} to version ${newVersion}.\n\n` +
      `All breaking changes have been automatically fixed by codefend-ai.`;
    
    console.log(`[PR:${repoId}] Creating pull request: ${prTitle}`);
    const { data: pullRequest } = await octokit.pulls.create({
      owner: repository.organization.name,
      repo: repository.name,
      title: prTitle,
      body: prDescription,
      head: uniqueBranchName,
      base: defaultBranch
    });
    
    console.log(`[PR:${repoId}] Successfully created PR #${pullRequest.number}: ${pullRequest.html_url}`);
    
    // Return the pull request URL and details
    return NextResponse.json({ 
      success: true,
      prNumber: pullRequest.number,
      prUrl: pullRequest.html_url,
      branch: uniqueBranchName
    });
    
  } catch (error: any) {
    console.error('Error creating PR:', error);
    return NextResponse.json({ 
      error: 'Failed to create pull request', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}