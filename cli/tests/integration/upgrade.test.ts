import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

function copyDirectory(source: string, destination: string): void {
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }
  
    const files = fs.readdirSync(source);
    
    for (const file of files) {
      const sourcePath = path.join(source, file);
      const destPath = path.join(destination, file);
      
      const stat = fs.statSync(sourcePath);
      
      if (stat.isDirectory()) {
        copyDirectory(sourcePath, destPath);
      } else {
        fs.copyFileSync(sourcePath, destPath);
      }
    }
}

function deleteDirectory(path: string): void {
    if (fs.existsSync(path)) {
      fs.rmSync(path, { recursive: true, force: true });
    }
}

// Helper to run the CLI tool
function runUpgradeTool(params: { package: string, newVersion: string, directory: string }): { exitCode: number, output: string } {
    try {
      // Get the absolute path to the source code CLI entry point
      const projectRoot = process.cwd();
      const srcPath = path.join(projectRoot, 'src/index.ts');
      
      // Check if the file exists
      if (!fs.existsSync(srcPath)) {
        console.error(`CLI source not found at ${srcPath}`);
        return { exitCode: 1, output: `Error: CLI source not found at ${srcPath}` };
      }
      
      // Use ts-node directly to run the TypeScript code without compilation
      const command = `npx ts-node ${srcPath} --package ${params.package} --new-version ${params.newVersion} --directory ${params.directory}`;
      console.log(`Executing: ${command}`);
      
      const output = execSync(command, { encoding: 'utf8' });
      return { exitCode: 0, output };
    } catch (error: any) {
      console.error('Error executing upgrade tool:', error.message);
      return {
        exitCode: error.status || 1,
        output: error.stdout || String(error)
      };
    }
}

// Only run when specifically requested
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

(runIntegrationTests ? describe : describe.skip)('End-to-end package upgrade workflow', () => {
    const tempDir = path.join(__dirname, '../../../temp-test-' + uuidv4());
    
    // Setup and teardown for each test
    afterEach(() => {
      deleteDirectory(tempDir);
    });

    test('Lodash example: upgrading lodash from 3.10.1 to 4.17.21', async () => {
      // Copy test fixture to temp directory
      const sourceDir = path.join(__dirname, '../../lodash-example');
      const targetDir = path.join(tempDir, 'lodash-test');
      copyDirectory(sourceDir, targetDir);
      
      // Run the upgrade
      const result = runUpgradeTool({
        package: 'lodash',
        newVersion: '4.17.21',
        directory: targetDir
      });
      
      // Assertions
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('✅ Tests passed');
      
      // Verify package.json was updated
      const packageJson = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
      expect(packageJson.dependencies.lodash).toBe('^4.17.21');
      
      // TODO: Additional checks could verify the actual code changes
    }, 120000); // Allow 120 seconds for this test


    test('Router example: upgrading react-router-dom from 5.3.0 to 6.0.0', async () => {
      const testId = uuidv4();
      const targetDir = path.join(os.tmpdir(), `temp-test-${testId}/router-test`);
      
      // Copy the router example to a temporary directory
      copyDirectory(path.join(__dirname, '../../router-example'), targetDir);
      
      // Run the upgrade
      const result = runUpgradeTool({
        package: 'react-router-dom',
        newVersion: '6.0.0', // Version 6.0.0 is compatible with React 17
        directory: targetDir
      });
      
      // Assertions
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('✅ Tests passed');
      
      // Verify package.json was updated
      const packageJson = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
      expect(packageJson.dependencies['react-router-dom']).toBe('^6.0.0');

      // TODO: Additional checks could verify the actual code changes
    }, 120000); // Allow 120 seconds for this test
});
