#!/usr/bin/env node

import { Command } from 'commander';
import { generatePackageUpgradeChanges, generateCodeFixes } from './generators';
import { applyFileChanges } from './transformers';
import { runTests, installPackages } from './testers';
import { FileChange } from './models/code-change'


if (process.env.VERBOSE !== 'true') {
  console.debug = () => {};
}


/**
 * Configure Commander for command line parsing
 */
function setupProgram(): Command {
  const program = new Command();
  
  program
    .name('codefend')
    .description('SmartUpgrade - Intelligently upgrade package versions')
    .version('1.0.0')
    .requiredOption('-p, --package <n>', 'The package to upgrade (required)')
    .requiredOption('-d, --directory <path>', 'Target directory to search for package files (required)')
    .requiredOption('-n, --new-version <version>', 'The new version to upgrade to (required)')
    .option('--ai-provider <provider>', 'AI provider to use for code fixes (openai or gemini)', 'gemini')
    .option('--max-fix-attempts <number>', 'Maximum number of fix attempts', '5');
    
  return program;
}


function printErrorDetails(error: string) {
  // Check if the error needs to be truncated
  const isErrorTruncated = error && error.length > 150;
  const truncatedError = isErrorTruncated
    ? error.substring(0, 800) + '...'
    : error || 'Unknown error';

  console.log('````````````````````````' + ' Error details ' + (isErrorTruncated ? '(truncated) ' : '') + '``````````````````````````````````');
  console.log(truncatedError);
  console.log('`````````````````````````````````````````````````````````````````````````````````````');
}


/**
 * Main function that executes when the script runs
 */
async function main() {
  try {
    // Parse command line arguments with Commander
    const program = setupProgram();
    program.parse();
    const options = program.opts();
    
    console.debug(`Upgrading package ${options.package} to version ${options.newVersion}`);

    // Step 1: Generate changes to package.json and yarn.lock
    const changes: FileChange[] = generatePackageUpgradeChanges(options.package, options.newVersion, options.directory);

    // Step 2: Apply the package.json and yarn.lock changes
    const stats = await applyFileChanges(changes, false);
    if (stats.failed > 0) {
      console.error(`🛑 Failed to apply ${stats.failed} file changes`);
      process.exit(1);
    }

    // Step 3: Install packages with the new version
    const installResult = await installPackages(options.directory);

    if (!installResult.success) {
      console.error('🛑 Package installation failed', installResult.error);
      process.exit(1);
    }
    
    console.log('\n');
    console.log(`Upgraded package ${options.package} to version ${options.newVersion}`);
    console.log('');

    // Step 4: Run tests to see if everything still works
    console.log('Testing for breaking changes...');
    const initialTestResult = await runTests(options.directory);

    // If tests pass, we're done!
    if (initialTestResult.success) {
      console.log('✅ Tests passed without needing any code changes');
      process.exit(0);
    }

    console.log(`❌ Breaking changes detected.`);
    if (initialTestResult.error) {
      console.log('');
      printErrorDetails(initialTestResult.error);
    }

    // Step 5: If tests fail, try to generate code fixes
    const maxFixAttempts = parseInt(options.maxFixAttempts);
    console.log('\n');
    console.log(`👷‍♀️ Attempting to fix breaking changes...`);


    let fixAttempt = 0;
    let testsPassed = false;
    
    while (fixAttempt < maxFixAttempts && !testsPassed) {
      fixAttempt++;
      console.log('\n');
      console.log('--------------------------------------------------------------------------------------');
      console.log(`🛠️  Fix attempt ${fixAttempt}/${maxFixAttempts}`);
      console.log('--------------------------------------------------------------------------------------');

      // Generate code fixes using AI
      const codeChanges = await generateCodeFixes(
        initialTestResult.output, 
        options.directory, 
        options.package,
        options.aiProvider as 'openai' | 'gemini'
      );
      
      if (codeChanges.length === 0) {
        console.error('❌ No code fixes generated');
        continue;
      }

      // Apply the generated code fixes
      const codeChangeStats = await applyFileChanges(codeChanges, true);
      console.debug(`Applied ${codeChangeStats.successful} code changes`);

      // Run tests again to see if our changes fixed the issues
      console.log('\n');
      console.log('Testing code changes...');
      const fixedTestResult = await runTests(options.directory);
      
      if (fixedTestResult.success) {
        console.log('✅ Tests pass!');
        testsPassed = true;
        break;
      } else {
        console.log('❌ Tests still failing after code changes');
        if (fixedTestResult.error) {
          console.log('');
          printErrorDetails(fixedTestResult.error);
        }
      }
    }

    console.log('--------------------------------------------------------------------------------------');

    if (!testsPassed) {
      console.log('');
      console.error(`🛑 Tests failed after ${maxFixAttempts} fix attempts`);
      process.exit(1);
    }

    console.log('');
    console.log('🚀 Successfully upgraded package and fixed breaking changes.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Execute the script if it's run directly
if (require.main === module) {
  main();
}

export { generatePackageUpgradeChanges, generateCodeFixes, applyFileChanges, runTests, installPackages };
