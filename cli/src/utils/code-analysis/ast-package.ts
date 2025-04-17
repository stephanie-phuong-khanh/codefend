import { generateDirectoryAST, ASTNode, FileAST, ASTGenerationResult } from "./ast-generator";

export type PackageUsageLocation = {
    filePath: string;
    imports: ASTNode[];
    methodCalls: ASTNode[];
    variableNames: string[];
};


/**
 * Finds all locations where a specific package is used in a codebase
 * @param ast The AST to analyze
 * @param packageName Name of the package to find usages of
 * @returns Information about where and how the package is used
 */
export function findPackageUsage(ast: ASTNode, packageName: string): {
    imports: ASTNode[];
    methodCalls: ASTNode[];
    variableNames: string[];
  } {
    const result = {
      imports: [] as ASTNode[],
      methodCalls: [] as ASTNode[],
      variableNames: [] as string[]
    };

    // Track variables that might be aliases for the package
    const packageAliases = new Set<string>();
    
    // Step 1: Find all imports/requires of the package
    function findImports(node: ASTNode) {
      // ES6 import statements
      if (node.type === 'import_statement' || node.type === 'import_declaration') {
        // Check if this import references our target package
        if (node.text.includes(`from '${packageName}'`) || 
            node.text.includes(`from "${packageName}"`)) {
          result.imports.push(node);
          
          // Find the variable names it's imported as (improved regex)
          // Handle default imports: import React from "react"
          const defaultImportMatch = node.text.match(/import\s+(\w+)\s+from\s+['"].*['"]/);
          if (defaultImportMatch && defaultImportMatch[1]) {
            packageAliases.add(defaultImportMatch[1]);
            result.variableNames.push(defaultImportMatch[1]);
          }
          
          // Handle destructured imports: import { Route, Switch } from "react-router-dom"
          const destructuredImportMatch = node.text.match(/import\s+{([^}]+)}\s+from\s+['"].*['"]/);
          if (destructuredImportMatch && destructuredImportMatch[1]) {
            // Split the imports and trim whitespace
            const imports = destructuredImportMatch[1].split(',').map(name => {
              // Handle aliased imports: import { BrowserRouter as Router }
              const aliasMatch = name.trim().match(/(\w+)(?:\s+as\s+(\w+))?/);
              if (aliasMatch) {
                const originalName = aliasMatch[1];
                const aliasName = aliasMatch[2] || originalName;
                
                packageAliases.add(aliasName);
                return aliasName;
              }
              return name.trim();
            });
            
            result.variableNames.push(...imports);
          }
          
          // Handle namespace imports: import * as React from "react"
          const namespaceImportMatch = node.text.match(/import\s+\*\s+as\s+(\w+)\s+from\s+['"].*['"]/);
          if (namespaceImportMatch && namespaceImportMatch[1]) {
            packageAliases.add(namespaceImportMatch[1]);
            result.variableNames.push(namespaceImportMatch[1]);
          }
        }
      }
      
      // CommonJS require statements
      if (node.type === 'call_expression' && 
          node.text.startsWith('require') && 
          (node.text.includes(`'${packageName}'`) || 
           node.text.includes(`"${packageName}"`))) {
        result.imports.push(node);
        
        // Find the variable name this require might be assigned to
        if (node.parent && node.parent.type === 'variable_declarator') {
          const variableName = node.parent.children?.[0]?.text;
          if (variableName) {
            packageAliases.add(variableName);
            result.variableNames.push(variableName);
          }
        }
      }
    }
    
    // Step 2: Find all method calls using the package or its aliases
    function findMethodCalls(node: ASTNode) {
        if (node.type === 'member_expression' || node.type === 'call_expression') {
            const objectName = node.children?.[0]?.text;
            
            // Check if this is using our package directly or via an alias
            if (objectName && packageAliases.has(objectName)) {
                result.methodCalls.push(node);
            }
        }
    }
    
    // Step 3: Find all JSX elements using the package's components
    function findJsxUsage(node: ASTNode) {
        // Debug node types to understand JSX structure
        const debugNodeType = (node: ASTNode, depth = 0): void => {
            if (depth > 3) return; // Limit recursion depth for debugging
            
            // Log JSX-related nodes for debugging
            if (node.type.includes('jsx') || node.type.includes('element')) {
                console.debug(`${' '.repeat(depth * 2)}${node.type}: ${node.text.substring(0, 30)}${node.text.length > 30 ? '...' : ''}`);
            }
            
            if (node.children) {
                node.children.forEach(child => debugNodeType(child, depth + 1));
            }
        };
        
        // UNCOMMENT for debugging - this will log all JSX structures
        if (node.type.includes('jsx') || node.type.includes('element')) {
            console.debug(`Found JSX node: ${node.type} with text: ${node.text.substring(0, 50)}${node.text.length > 50 ? '...' : ''}`);
            
            // Also log the component names we're looking for
            console.debug(`Package aliases we're looking for:`, Array.from(packageAliases));
            
            // If the node has a tagName that might be related
            const possibleTagNames = [];
            if (node.children) {
                for (const child of node.children) {
                    if (child.type === 'identifier' || child.type.includes('jsx')) {
                        possibleTagNames.push(child.text);
                    }
                }
            }
            if (possibleTagNames.length > 0) {
                console.debug(`Possible tag names:`, possibleTagNames);
            }
        }
        
        // More comprehensive detection of JSX elements
        if (node.type.includes('jsx')) {
            // Extract component name from different JSX node types
            let tagName: string | undefined;
            
            if (node.type === 'jsx_element') {
                // For standard JSX elements: <Tag>...</Tag>
                const openingTag = node.children?.find(child => 
                    child.type === 'jsx_opening_element');
                
                if (openingTag) {
                    // Get the tag name (first child of opening element)
                    tagName = openingTag.children?.[0]?.text;
                }
            } 
            else if (node.type === 'jsx_self_closing_element') {
                // For self-closing elements: <Tag />
                tagName = node.children?.[0]?.text;
            }
            else if (node.type === 'jsx_opening_element') {
                // Direct opening element
                tagName = node.children?.[0]?.text;
            }
            
            // Check if this component is from our package
            if (tagName && packageAliases.has(tagName)) {
                result.methodCalls.push(node);
            }
            
            // Also check for JSX attributes that might use imported components
            const attributes = node.children?.filter(child => 
                child.type === 'jsx_attribute');
            
            if (attributes && attributes.length > 0) {
                attributes.forEach(attr => {
                    // Check for component={ImportedComponent} pattern
                    const attrValue = attr.children?.[1]; // Usually the value is the second child
                    
                    if (attrValue && attrValue.type.includes('jsx_expression')) {
                        // Extract component name from JSX expression
                        const expression = attrValue.children?.[0]; // Get inside the curly braces
                        
                        if (expression && packageAliases.has(expression.text)) {
                            result.methodCalls.push(attrValue);
                        }
                    }
                });
            }
        }
        
        // Additional JSX expression handling (e.g., {Route && <Route />})
        if (node.type === 'identifier' && packageAliases.has(node.text)) {
            // This might be a component reference in JSX expressions
            const parent = node.parent;
            
            if (parent && 
                (parent.type.includes('jsx') ||
                 parent.type.includes('element') ||
                 parent.type.includes('expression'))) {
                result.methodCalls.push(node);
            }
        }
        
        // Additional direct identifier detection (more aggressive)
        // This will catch any references to imported components, even outside JSX
        if (node.type === 'identifier') {
            // If this identifier is one of our imported components
            if (packageAliases.has(node.text)) {
                // Add it as a method call - this is very liberal but will ensure we catch all usages
                result.methodCalls.push(node);
                console.debug(`Found direct identifier match for: ${node.text}`);
            }
        }
        
        // Detect hook usage (useParams(), useHistory(), etc.)
        if (node.type === 'call_expression') {
            const hookName = node.children?.[0]?.text;
            
            // Check if this hook is from our package
            if (hookName && packageAliases.has(hookName)) {
                result.methodCalls.push(node);
            }
        }
    }
    
    // Traverse the AST to find all occurrences
    function traverse(node: ASTNode) {
      // Try to find imports first
      findImports(node);
      
      // Then look for method calls
      findMethodCalls(node);
      
      // Check for JSX usage
      findJsxUsage(node);
      
      // Continue traversing
      if (node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    }
    
    traverse(ast);
    return result;
}


export async function findPackageUsageInDirectory(
    directoryPath: string,
    packageName: string
): Promise<{
    fileCount: number;
    usageLocations: PackageUsageLocation[];
}> {
    // First, generate ASTs for all matching files
    const astResult = await generateDirectoryAST(directoryPath);
    
    const result = {
      fileCount: astResult.files.length,
      usageLocations: [] as PackageUsageLocation[]
    };
    
    // Then analyze each file for package usage
    for (const file of astResult.files) {
      const usage = findPackageUsage(file.ast, packageName);
      
      // Only include files that actually use the package
      if (usage.imports.length > 0 || usage.methodCalls.length > 0) {
        result.usageLocations.push({
          filePath: file.filePath,
          ...usage
        });
      }
    }
    
    return result;
}
