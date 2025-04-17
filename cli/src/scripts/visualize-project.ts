#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { program } from "commander";
import { 
  analyzeProjectStructure, 
  getProjectSummary,
  ProjectStructure
} from "../utils/code-analysis";

// Configure the command-line interface
program
  .name("visualize-project")
  .description("Visualize the project structure and key files")
  .version("1.0.0")
  .option("-d, --dir <path>", "Path to the project directory to analyze")
  .option("--summary", "Show only summary information (faster)")
  .option("-o, --output <path>", "Output file path (default: stdout)")
  .option("--format <format>", "Output format (json, text)", "text")
  .option("--no-color", "Disable colored output")
  .option("--file-limit <number>", "Maximum number of files to include in full analysis", "10")
  .parse(process.argv);

const options = program.opts();

// Ensure directory is provided
if (!options.dir) {
  console.error("Error: Project directory (-d, --dir) must be specified");
  process.exit(1);
}

/**
 * Format the project structure as text
 */
function formatProjectStructure(project: ProjectStructure): string {
  const colors = {
    reset: options.color ? "\x1b[0m" : "",
    bright: options.color ? "\x1b[1m" : "",
    dim: options.color ? "\x1b[2m" : "",
    green: options.color ? "\x1b[32m" : "",
    blue: options.color ? "\x1b[34m" : "",
    yellow: options.color ? "\x1b[33m" : "",
  };

  let output = `${colors.bright}Project Structure Analysis for ${colors.blue}${project.rootDir}${colors.reset}\n\n`;
  
  // Package.json information
  if (project.packageJson) {
    output += `${colors.bright}Package Dependencies:${colors.reset}\n`;
    
    const deps = project.packageJson.dependencies || {};
    const devDeps = project.packageJson.devDependencies || {};
    
    output += `${colors.yellow}Dependencies:${colors.reset}\n`;
    Object.entries(deps).forEach(([name, version]) => {
      output += `  ${name}: ${version}\n`;
    });
    
    output += `\n${colors.yellow}Dev Dependencies:${colors.reset}\n`;
    Object.entries(devDeps).forEach(([name, version]) => {
      output += `  ${name}: ${version}\n`;
    });
    
    output += "\n";
  }
  
  // Files information
  output += `${colors.bright}Files (${project.files.length}):${colors.reset}\n`;
  project.files.forEach(file => {
    output += `${colors.green}${file.path}${colors.reset}\n`;
    
    if (file.error) {
      output += `  ${colors.dim}Error: ${file.error}${colors.reset}\n`;
    } else if (file.content && !file.content.startsWith('[File too large')) {
      // Only show a preview of the file content
      const contentPreview = file.content.split('\n').slice(0, 3).join('\n');
      output += `  ${colors.dim}${contentPreview}${file.content.split('\n').length > 3 ? '\n  ...' : ''}${colors.reset}\n`;
    } else if (file.content) {
      output += `  ${colors.dim}${file.content}${colors.reset}\n`;
    }
  });
  
  return output;
}

/**
 * Format project summary as text
 */
function formatProjectSummary(summary: any): string {
  const colors = {
    reset: options.color ? "\x1b[0m" : "",
    bright: options.color ? "\x1b[1m" : "",
    blue: options.color ? "\x1b[34m" : "",
    green: options.color ? "\x1b[32m" : "",
    yellow: options.color ? "\x1b[33m" : "",
  };

  let output = `${colors.bright}Project Summary for ${colors.blue}${summary.rootDir}${colors.reset}\n\n`;
  
  // File statistics
  output += `${colors.bright}File Statistics:${colors.reset}\n`;
  output += `Total Files: ${summary.fileCount}\n\n`;
  
  output += `${colors.bright}File Types:${colors.reset}\n`;
  Object.entries(summary.fileTypes).forEach(([ext, count]) => {
    output += `  ${ext}: ${count}\n`;
  });
  
  // Key Files
  output += `\n${colors.bright}Key Files:${colors.reset}\n`;
  summary.keyFiles.forEach((file: string) => {
    output += `  ${colors.green}${file}${colors.reset}\n`;
  });
  
  // Package.json overview
  if (summary.packageJson) {
    output += `\n${colors.bright}Package Information:${colors.reset}\n`;
    output += `  Name: ${summary.packageJson.name || 'Unknown'}\n`;
    output += `  Version: ${summary.packageJson.version || 'Unknown'}\n`;
    
    const depCount = Object.keys(summary.packageJson.dependencies || {}).length;
    const devDepCount = Object.keys(summary.packageJson.devDependencies || {}).length;
    
    output += `  Dependencies: ${depCount}\n`;
    output += `  Dev Dependencies: ${devDepCount}\n`;
  }
  
  return output;
}

/**
 * Main function to visualize the project structure
 */
async function visualizeProject() {
  try {
    console.log(`Analyzing project structure in ${options.dir}...`);
    
    let output = "";
    
    if (options.summary) {
      // Get only project summary (faster)
      const summary = await getProjectSummary(options.dir);
      
      if (options.format === "json") {
        output = JSON.stringify(summary, null, 2);
      } else {
        output = formatProjectSummary(summary);
      }
    } else {
      // Get full project structure
      const fileLimit = parseInt(options.fileLimit || "10", 10);
      const project = await analyzeProjectStructure(options.dir);
      
      if (options.format === "json") {
        output = JSON.stringify(project, null, 2);
      } else {
        output = formatProjectStructure(project);
      }
    }
    
    // Output the results
    if (options.output) {
      fs.writeFileSync(options.output, output);
      console.log(`Output written to ${options.output}`);
    } else {
      console.log(output);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run the visualization
visualizeProject();
