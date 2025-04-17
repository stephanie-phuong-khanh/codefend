import { exec } from 'child_process';
import { promisify } from 'util';
import { TestResult } from '../models/test-result';
import * as fs from 'fs';
import * as path from 'path';


const execAsync = promisify(exec);

/**
 * Runs tests in the specified directory.
 * 
 * Attempts to run tests using npm test or falls back to alternative methods
 * if no test script is found in package.json.
 * 
 * @param directory Directory where the tests should be run
 * @returns TestResult object with success status and output
 */
export async function runTests(directory: string): Promise<TestResult> {
    // Determine test command based on package.json
    let testCommand = "npm test";
    const packageJsonPath = path.join(directory, 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
        try {
            const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (!packageData.scripts || !packageData.scripts.test) {
                // If no test script, try to run the main file if available
                if (packageData.main) {
                    testCommand = `node ${packageData.main}`;
                }
            }
        } catch (e) {
            console.error(`Error reading package.json: ${e}`);
        }
    }
    
    try {
        // The execAsync will throw an error if the command exits with non-zero code
        const { stdout, stderr } = await execAsync(testCommand, { cwd: directory });
        
        console.debug("Tests passed successfully!");
        return {
            success: true,
            output: stdout,
            error: stderr || undefined // Include stderr for informational purposes
        };
    } catch (error: any) {
        // Command failed with non-zero exit code
        const errorLog = `Command '${testCommand}' failed\n`;
        const stdoutLog = error.stdout ? `STDOUT:\n${error.stdout}\n` : '';
        const stderrLog = error.stderr ? `STDERR:\n${error.stderr}\n` : '';
        
        return {
            success: false,
            output: error.stdout || '',
            error: `${errorLog}${stdoutLog}${stderrLog}`
        };
    }
}


export async function installPackages(directory: string): Promise<TestResult> {
    try {
        console.debug(`Running npm install in ${directory}...`);
        const { stdout, stderr } = await execAsync('npm install', { cwd: directory });
        
        // npm sometimes outputs warnings to stderr but still succeeds
        // We'll check for specific error patterns or rely on the exit code (caught by execAsync)
        if (stderr && (
            stderr.includes('ERR!') || 
            stderr.includes('Error:') ||
            stderr.includes('ENOENT')
        )) {
            return {
                success: false,
                output: stderr
            };
        }
        
        return {
            success: true,
            output: stdout
        };
    } catch (error: any) {
        return {
            success: false,
            output: error.stdout || '',
            error: error.message || 'Unknown error occurred during package installation'
        };
    }
}
