import * as fs from "fs";
import * as glob from "glob";
import * as path from "path";
import Parser from "tree-sitter";

// Import tree-sitter-typescript with require to avoid TypeScript import issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TypeScript = require("tree-sitter-typescript");

// Define types for AST nodes and results
export interface ASTNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children?: ASTNode[];
  parent?: ASTNode; // Add parent reference for AST traversal
}

export interface FileAST {
  filePath: string;
  ast: ASTNode;
}

export interface ASTGenerationResult {
  files: FileAST[];
  totalFiles: number;
  errors: { filePath: string; error: string }[];
}

/**
 * Recursively converts tree-sitter nodes to our AST format
 */
function convertToASTNode(node: Parser.SyntaxNode, parent?: ASTNode): ASTNode {
  const result: ASTNode = {
    type: node.type,
    text: node.text,
    startPosition: node.startPosition,
    endPosition: node.endPosition,
    children: [],
    parent,
  };

  // Process children if they exist
  if (node.childCount > 0) {
    result.children = [];
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        result.children.push(convertToASTNode(child, result));
      }
    }
  }

  return result;
}

/**
 * Generates an AST for a single file
 * @param filePath Path to the file to parse
 * @returns The AST representation of the file
 */
export async function generateFileAST(filePath: string): Promise<ASTNode> {
  // Read the file content
  const fileContent = fs.readFileSync(filePath, "utf8");

  // Initialize the parser
  const parser = new Parser();

  // Determine the language based on file extension
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".ts" || ext === ".tsx") {
    parser.setLanguage(ext === ".tsx" ? TypeScript.tsx : TypeScript.typescript);
  } else if (ext === ".js" || ext === ".jsx") {
    // For JS files, we still use the TypeScript parser as it's compatible
    parser.setLanguage(ext === ".jsx" ? TypeScript.tsx : TypeScript.typescript);
  } else {
    throw new Error(`Unsupported file extension: ${ext}`);
  }

  // Parse the file
  const tree = parser.parse(fileContent);

  // Convert to our AST format
  return convertToASTNode(tree.rootNode);
}

/**
 * Generates ASTs for all matching files in a directory
 * @param directoryPath Path to the directory to scan
 * @param filePattern Glob pattern to match files
 * @param options Additional options for directory scanning
 * @returns Object containing ASTs for all matching files and error information
 */
export async function generateDirectoryAST(
  directoryPath: string,
  filePattern = "**/*.{ts,tsx,js,jsx}",
  options: { ignoreNodeModules?: boolean } = { ignoreNodeModules: true }
): Promise<ASTGenerationResult> {
  // Ensure the directory exists
  if (!fs.existsSync(directoryPath)) {
    throw new Error(`Directory does not exist: ${directoryPath}`);
  }

  // Set up glob options
  const globOptions: glob.GlobOptions = {
    cwd: directoryPath,
    absolute: true,
  };
  
  // Add ignore patterns for node_modules if specified
  if (options.ignoreNodeModules) {
    globOptions.ignore = ["**/node_modules/**"];
  }

  // Find all matching files
  const files = await glob.glob(filePattern, globOptions);

  const result: ASTGenerationResult = {
    files: [],
    totalFiles: files.length,
    errors: [],
  };

  // Process each file
  for (const file of files) {
    try {
      const ast = await generateFileAST(String(file));
      result.files.push({
        filePath: String(file),
        ast,
      });
    } catch (error) {
      result.errors.push({
        filePath: String(file),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/**
 * Utility function to extract specific node types from an AST
 * @param ast The AST to search
 * @param nodeTypes Array of node types to extract
 * @returns Array of matching nodes
 */
export function extractNodesByType(
  ast: ASTNode,
  nodeTypes: string[]
): ASTNode[] {
  const result: ASTNode[] = [];

  function traverse(node: ASTNode) {
    if (nodeTypes.includes(node.type)) {
      result.push(node);
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(ast);
  return result;
}

/**
 * Extracts imports from an AST
 * @param ast The AST to extract imports from
 * @returns Array of import nodes
 */
export function extractImports(ast: ASTNode): ASTNode[] {
  return extractNodesByType(ast, ["import_statement", "import_declaration"]);
}

/**
 * Extracts exports from an AST
 * @param ast The AST to extract exports from
 * @returns Array of export nodes
 */
export function extractExports(ast: ASTNode): ASTNode[] {
  return extractNodesByType(ast, [
    "export_statement",
    "export_declaration",
    "export_default_declaration",
  ]);
}

/**
 * Extracts functions from an AST
 * @param ast The AST to extract functions from
 * @returns Array of function nodes
 */
export function extractFunctions(ast: ASTNode): ASTNode[] {
  return extractNodesByType(ast, [
    "function_declaration",
    "function",
    "arrow_function",
    "method_definition",
  ]);
}

/**
 * Extracts classes from an AST
 * @param ast The AST to extract classes from
 * @returns Array of class nodes
 */
export function extractClasses(ast: ASTNode): ASTNode[] {
  return extractNodesByType(ast, ["class_declaration", "class"]);
}

/**
 * Extracts interfaces from an AST
 * @param ast The AST to extract interfaces from
 * @returns Array of interface nodes
 */
export function extractInterfaces(ast: ASTNode): ASTNode[] {
  return extractNodesByType(ast, ["interface_declaration"]);
}
