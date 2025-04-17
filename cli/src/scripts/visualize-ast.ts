#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { program } from "commander";
import { 
  generateFileAST, 
  generateDirectoryAST, 
  ASTNode,
  findPackageUsageInDirectory,
  PackageUsageLocation
} from "../utils/code-analysis";

// Configure the command-line interface
program
  .name("visualize-ast")
  .description("Visualize the AST representation of files or directories")
  .version("1.0.0")
  .option("-f, --file <path>", "Path to the file to analyze")
  .option("-d, --dir <path>", "Path to the directory to analyze")
  .option("-p, --pattern <glob>", "File pattern to match when using directory mode", "**/*.{ts,tsx,js,jsx}")
  .option("--depth <number>", "Maximum depth of the AST to display", "Infinity")
  .option("-o, --output <path>", "Output file path (default: stdout)")
  .option("--format <format>", "Output format (json, tree)", "tree")
  .option("--no-color", "Disable colored output")
  .option("--summary", "Show only summary information for directory mode")
  .option("--package <name>", "Analyze usage of a specific package")
  .parse(process.argv);

const options = program.opts();

// Ensure at least one of file or directory is provided
if (!options.file && !options.dir) {
  console.error("Error: Either --file or --dir option must be provided");
  process.exit(1);
}

// If package is specified, ensure directory is also provided
if (options.package && !options.dir) {
  console.error("Error: Directory (-d, --dir) must be specified when using --package");
  process.exit(1);
}

/**
 * Format an AST node as a string with indentation
 */
function formatNode(
  node: ASTNode, 
  depth: number = 0, 
  maxDepth: number = Infinity, 
  isLast: boolean = true,
  prefix: string = ""
): string {
  // Color codes for terminal output
  const colors = {
    reset: options.color ? "\x1b[0m" : "",
    bright: options.color ? "\x1b[1m" : "",
    dim: options.color ? "\x1b[2m" : "",
    type: options.color ? "\x1b[36m" : "", // Cyan
    position: options.color ? "\x1b[33m" : "", // Yellow
    text: options.color ? "\x1b[32m" : "", // Green
  };

  // Skip if we've reached max depth
  if (depth > maxDepth) {
    return "";
  }

  // Create the branch characters for the tree view
  const branch = isLast ? "└── " : "├── ";
  const childPrefix = prefix + (isLast ? "    " : "│   ");

  // Format the node information
  let result = `${prefix}${branch}${colors.bright}${colors.type}${node.type}${colors.reset} `;
  
  // Add position information
  result += `${colors.dim}${colors.position}(${node.startPosition.row}:${node.startPosition.column}-${node.endPosition.row}:${node.endPosition.column})${colors.reset} `;
  
  // Add a preview of the text (truncated if too long)
  const textPreview = node.text.replace(/\n/g, "\\n").substring(0, 30);
  result += `${colors.text}"${textPreview}${textPreview.length < node.text.length ? "..." : ""}"${colors.reset}\n`;

  // Process children if they exist and we haven't reached max depth
  if (node.children && depth < maxDepth) {
    const childrenCount = node.children.length;
    node.children.forEach((child, index) => {
      result += formatNode(
        child,
        depth + 1,
        maxDepth,
        index === childrenCount - 1,
        childPrefix
      );
    });
  }

  return result;
}

/**
 * Format a summary of AST nodes for a file
 */
function formatFileSummary(filePath: string, ast: ASTNode): string {
  // Count node types
  const nodeTypes = new Map<string, number>();
  let totalNodes = 0;
  
  function countNodes(node: ASTNode) {
    totalNodes++;
    nodeTypes.set(node.type, (nodeTypes.get(node.type) || 0) + 1);
    
    if (node.children) {
      for (const child of node.children) {
        countNodes(child);
      }
    }
  }
  
  countNodes(ast);
  
  // Format the summary
  let result = `${path.relative(process.cwd(), filePath)}: ${totalNodes} nodes\n`;
  
  // Sort node types by count (descending)
  const sortedTypes = [...nodeTypes.entries()].sort((a, b) => b[1] - a[1]);
  
  // Show top 10 node types
  const topTypes = sortedTypes.slice(0, 10);
  for (const [type, count] of topTypes) {
    result += `  ${type}: ${count}\n`;
  }
  
  if (sortedTypes.length > 10) {
    result += `  ... and ${sortedTypes.length - 10} more node types\n`;
  }
  
  return result;
}

/**
 * Process a single file and generate its AST visualization
 */
async function processFile(filePath: string, maxDepth: number): Promise<string> {
  // Generate the AST
  console.log(`Generating AST for ${filePath}...`);
  const ast = await generateFileAST(filePath);
  
  // Format the output based on the selected format
  if (options.format === "json") {
    return JSON.stringify(ast, null, 2);
  } else if (options.summary) {
    return formatFileSummary(filePath, ast);
  } else {
    // Tree format (default)
    let output = `AST for ${filePath}:\n\n`;
    output += formatNode(ast, 0, maxDepth);
    return output;
  }
}

/**
 * Format package usage information
 */
function formatPackageUsage(packageName: string, usageInfo: {
  fileCount: number;
  usageLocations: PackageUsageLocation[];
}): string {
  const colors = {
    reset: options.color ? "\x1b[0m" : "",
    bright: options.color ? "\x1b[1m" : "",
    dim: options.color ? "\x1b[2m" : "",
    highlight: options.color ? "\x1b[35m" : "", // Purple
    file: options.color ? "\x1b[36m" : "", // Cyan
    import: options.color ? "\x1b[33m" : "", // Yellow
    method: options.color ? "\x1b[32m" : "", // Green
  };

  let output = `${colors.bright}Package Usage Analysis for ${colors.highlight}${packageName}${colors.reset}\n\n`;
  
  output += `Found ${usageInfo.usageLocations.length} files using this package out of ${usageInfo.fileCount} analyzed files.\n\n`;
  
  // For each file that uses the package
  for (const location of usageInfo.usageLocations) {
    output += `${colors.bright}${colors.file}${location.filePath}${colors.reset}\n`;
    
    // Show import statements
    if (location.imports.length > 0) {
      output += `  ${colors.import}Imports (${location.imports.length})${colors.reset}:\n`;
      for (const importNode of location.imports) {
        const lineInfo = `(${importNode.startPosition.row}:${importNode.startPosition.column})`;
        // Don't truncate import statements - show the full text
        output += `    ${lineInfo} ${importNode.text.replace(/\n/g, '\\n')}\n`;
      }
    }
    
    // Show method calls
    if (location.methodCalls.length > 0) {
      output += `  ${colors.method}Method Calls (${location.methodCalls.length})${colors.reset}:\n`;
      for (const methodCall of location.methodCalls) {
        const lineInfo = `(${methodCall.startPosition.row}:${methodCall.startPosition.column})`;
        // Don't truncate method calls either - show the full text
        output += `    ${lineInfo} ${methodCall.text.replace(/\n/g, '\\n')}\n`;
      }
    }
    
    // Show variable names used for the package
    if (location.variableNames.length > 0) {
      output += `  Variable Names: ${location.variableNames.join(', ')}\n`;
    }
    
    output += '\n';
  }
  
  return output;
}

/**
 * Main function to visualize the AST
 */
async function visualizeAST() {
  try {
    // Parse the max depth option
    const maxDepth = options.depth === "Infinity" 
      ? Infinity 
      : parseInt(options.depth, 10);
    
    let output = "";
    
    // Check if we're in package analysis mode
    if (options.package) {
      // Resolve the directory path
      const dirPath = path.resolve(options.dir);
      
      // Check if the directory exists
      if (!fs.existsSync(dirPath)) {
        console.error(`Error: Directory not found: ${dirPath}`);
        process.exit(1);
      }
      
      console.log(`Analyzing package usage for ${options.package} in ${dirPath}...`);
      const packageUsage = await findPackageUsageInDirectory(dirPath, options.package);
      
      if (options.format === "json") {
        output = JSON.stringify(packageUsage, null, 2);
      } else {
        output = formatPackageUsage(options.package, packageUsage);
      }
    }
    // Process file mode
    else if (options.file) {
      // Resolve the file path
      const filePath = path.resolve(options.file);
      
      // Check if the file exists
      if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        process.exit(1);
      }
      
      output = await processFile(filePath, maxDepth);
    }
    // Process directory mode
    else if (options.dir) {
      // Resolve the directory path
      const dirPath = path.resolve(options.dir);
      
      // Check if the directory exists
      if (!fs.existsSync(dirPath)) {
        console.error(`Error: Directory not found: ${dirPath}`);
        process.exit(1);
      }
      
      // Generate ASTs for all matching files
      console.log(`Generating ASTs for files in ${dirPath} matching pattern: ${options.pattern}...`);
      const result = await generateDirectoryAST(dirPath, options.pattern);
      
      if (result.files.length === 0) {
        console.log(`No matching files found in ${dirPath}`);
        process.exit(0);
      }
      
      console.log(`Found ${result.files.length} matching files`);
      
      if (options.format === "json") {
        // JSON format - output the entire result
        output = JSON.stringify(result, null, 2);
      } else {
        // Tree format - process each file
        if (result.files.length > 1) {
          output = `ASTs for ${result.files.length} files in ${dirPath}:\n\n`;
        }
        
        // Process each file
        for (let i = 0; i < result.files.length; i++) {
          const file = result.files[i];
          
          if (options.summary) {
            output += formatFileSummary(file.filePath, file.ast);
          } else {
            output += `AST for ${file.filePath}:\n\n`;
            output += formatNode(file.ast, 0, maxDepth);
          }
          
          // Add a separator between files
          if (i < result.files.length - 1) {
            output += "\n" + "-".repeat(80) + "\n\n";
          }
        }
        
        // Add error information if any
        if (result.errors.length > 0) {
          output += "\n\nErrors:\n";
          for (const error of result.errors) {
            output += `${error.filePath}: ${error.error}\n`;
          }
        }
      }
    }
    
    // Write the output to a file or stdout
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
visualizeAST();
