import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

export interface ProjectStructure {
    rootDir: string;
    packageJson?: {
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
    };
    files: Array<{
        path: string;
        content?: string;
        error?: string;
    }>;
    summary: string;
}

/**
 * Analyzes the project structure to provide context for the AI
 * @param directoryPath Path to the project directory
 * @returns Structured representation of the project and selected file contents
 */
export async function analyzeProjectStructure(
    directoryPath: string
): Promise<ProjectStructure> {
    const result: ProjectStructure = {
        rootDir: directoryPath,
        files: [],
        summary: ''
    };
    
    const structureElements: string[] = [];
    
    // Get package.json content
    const packageJsonPath = path.join(directoryPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        try {
            const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageJsonContent);
            result.packageJson = {
                dependencies: packageJson.dependencies || {},
                devDependencies: packageJson.devDependencies || {}
            };
            structureElements.push(`package.json: ${JSON.stringify(packageJson, null, 2)}`);
        } catch (error) {
            structureElements.push(`Error reading package.json: ${String(error)}`);
        }
    }
    
    // Find JavaScript/TypeScript files in the project
    try {
        const filePattern = "**/*.{js,jsx,ts,tsx}";
        const globOptions: glob.GlobOptions = {
            cwd: directoryPath,
            absolute: true,
            ignore: ["**/node_modules/**", "**/dist/**", "**/build/**"]
        };
        
        const files = await glob.glob(filePattern, globOptions);
        
        // Process each file
        for (const file of files.slice(0, 10)) { // Limit to 10 files to avoid token limits
            const filePath = String(file);  // Convert to string to fix TypeScript error
            const relativePath = path.relative(directoryPath, filePath);
            
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                
                // Only include files that are not too large
                if (content.length < 5000) { // Limit file size to avoid token limits
                    result.files.push({
                        path: relativePath,
                        content
                    });
                    structureElements.push(`File: ${relativePath}\n${content}`);
                } else {
                    // For large files, just include metadata
                    result.files.push({
                        path: relativePath,
                        content: `[File too large: ${content.length} bytes]`
                    });
                    structureElements.push(`File: ${relativePath} [too large to include, ${content.length} bytes]`);
                }
            } catch (error) {
                result.files.push({
                    path: relativePath,
                    error: `Error reading file: ${String(error)}`
                });
                structureElements.push(`File: ${relativePath}\nError reading file: ${String(error)}`);
            }
        }
    } catch (error) {
        structureElements.push(`Error scanning directory: ${String(error)}`);
    }
    
    // Build the summary
    result.summary = structureElements.join('\n\n');
    
    return result;
}

/**
 * Simplified version that just returns key files without full content
 */
export async function getProjectSummary(
    directoryPath: string
): Promise<{
    rootDir: string;
    packageJson?: any;
    fileCount: number;
    fileTypes: Record<string, number>;
    keyFiles: string[];
}> {
    // Implement a lightweight summary without full file contents
    const result = {
        rootDir: directoryPath,
        fileCount: 0,
        fileTypes: {} as Record<string, number>,
        keyFiles: [] as string[],
        packageJson: undefined as any
    };
    
    // Get package.json
    const packageJsonPath = path.join(directoryPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        try {
            const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
            result.packageJson = JSON.parse(packageJsonContent);
        } catch (error) {
            console.error(`Error reading package.json: ${String(error)}`);
        }
    }
    
    // Count files by type
    try {
        const filePattern = "**/*.{js,jsx,ts,tsx,css,scss,html,json,md}";
        const globOptions: glob.GlobOptions = {
            cwd: directoryPath,
            absolute: false,
            ignore: ["**/node_modules/**", "**/dist/**", "**/build/**"]
        };
        
        const files = await glob.glob(filePattern, globOptions);
        result.fileCount = files.length;
        
        // Group by extension
        files.forEach(file => {
            const fileStr = String(file);  // Convert to string to fix TypeScript error
            const ext = path.extname(fileStr).slice(1);
            result.fileTypes[ext] = (result.fileTypes[ext] || 0) + 1;
            
            // Keep track of key files
            if (fileStr.includes('index.') || 
                fileStr.includes('App.') || 
                fileStr.includes('main.') || 
                fileStr.includes('webpack.config') ||
                fileStr === 'package.json') {
                result.keyFiles.push(fileStr);
            }
        });
    } catch (error) {
        console.error(`Error scanning directory: ${String(error)}`);
    }
    
    return result;
}
