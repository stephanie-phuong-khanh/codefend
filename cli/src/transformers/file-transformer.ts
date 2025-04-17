import * as fs from 'fs';
import * as path from 'path';
import { FileChange, CodeChange } from '../models/code-change';

/**
 * Applies a single code change to a string of content
 * @param content The original file content
 * @param change The code change to apply
 * @returns The updated content with the change applied
 */
function applyCodeChange(content: string, change: CodeChange): string {
    console.debug(`Applying change: ${JSON.stringify(change, null, 2)}`);
    
    if (change.type === 'replace') {
        const originalCode = change.originalCode.trim();
        const newCode = change.newCode.trim();
        
        // Check if the exact original code exists in the content
        if (content.includes(originalCode)) {
            console.debug(`Found exact match for original code`);
            return content.replace(originalCode, newCode);
        }
        
        // Try with different line endings
        const originalWithUnixEndings = originalCode.replace(/\r\n/g, '\n');
        if (content.includes(originalWithUnixEndings)) {
            console.debug(`Found match after normalizing line endings`);
            return content.replace(originalWithUnixEndings, newCode);
        }
        
        // Try relaxed whitespace match (this is a simple version without regex)
        // In a real implementation, you might want to use more sophisticated regex like in the Python version
        console.debug(`No exact match found, searching in lines...`);
        
        // Try line-by-line to find a close match
        const contentLines = content.split('\n');
        const searchTerm = originalCode.replace(/\s+/g, '').toLowerCase();
        
        for (let i = 0; i < contentLines.length; i++) {
            const normalized = contentLines[i].replace(/\s+/g, '').toLowerCase();
            if (normalized.includes(searchTerm)) {
                console.debug(`Found partial match at line ${i + 1}: ${contentLines[i]}`);
                contentLines[i] = newCode;
                return contentLines.join('\n');
            }
        }
        
        console.log(`⚠️ Could not find a match for the original code`);
    }
    
    console.log(`⚠️ No changes applied`);
    return content;
}

/**
 * Applies all changes to a single file
 * @param fileChange The file change to apply, containing file path and code changes
 * @param baseDir Base directory to resolve relative paths against
 * @returns A promise that resolves to a boolean indicating success
 */
export async function applyFileChange(fileChange: FileChange, baseDir: string = process.cwd()): Promise<boolean> {
    try {
        // Resolve the file path to absolute path
        const resolvedFilePath = path.isAbsolute(fileChange.filePath) 
            ? fileChange.filePath 
            : path.resolve(baseDir, fileChange.filePath);
            
        console.debug(`Applying changes to file: ${resolvedFilePath}`);
        
        // Check if file exists
        if (!fs.existsSync(resolvedFilePath)) {
            console.error(`File does not exist: ${resolvedFilePath}`);
            return false;
        }
        
        // Read the current file content
        let content: string;
        try {
            content = fs.readFileSync(resolvedFilePath, 'utf8');
            console.debug(`Successfully read file (${content.length} bytes)`);
        } catch (error) {
            console.error(`Failed to read file ${resolvedFilePath}:`, error);
            return false;
        }
        
        // First, process import/require changes
        const importChanges = fileChange.codeChanges.filter(change => 
            change.originalCode.includes('import') || 
            change.originalCode.includes('require'));
            
        const otherChanges = fileChange.codeChanges.filter(change => 
            !change.originalCode.includes('import') && 
            !change.originalCode.includes('require'));
            
        // Apply import changes first
        let updatedContent = content;
        for (const change of importChanges) {
            updatedContent = applyCodeChange(updatedContent, change);
        }
        
        // Then apply all other changes
        for (const change of otherChanges) {
            updatedContent = applyCodeChange(updatedContent, change);
        }
        
        // Only write the file if content has changed
        if (updatedContent !== content) {
            try {
                fs.writeFileSync(resolvedFilePath, updatedContent);
                console.debug(`Successfully updated file: ${resolvedFilePath}`);
                return true;
            } catch (error) {
                console.error(`Failed to write file ${resolvedFilePath}:`, error);
                return false;
            }
        } else {
            console.error(`No changes were made to file: ${resolvedFilePath}`);
            return false;
        }
    } catch (error) {
        console.error(`Unexpected error applying changes to ${fileChange.filePath}:`, error);
        return false;
    }
}

/**
 * Applies all file changes in a change set
 * @param fileChanges Array of file changes to apply
 * @param baseDir Base directory to resolve relative paths against
 * @returns A promise that resolves to statistics about the applied changes
 */
export async function applyFileChanges(
    fileChanges: FileChange[], 
    verbose: boolean = false
): Promise<{
    total: number;
    successful: number;
    failed: number;
}> {
    const stats = {
        total: fileChanges.length,
        successful: 0,
        failed: 0
    };

    const baseDir = process.cwd();
    
    console.debug(`Applying ${fileChanges.length} file changes...`);
    
    for (const fileChange of fileChanges) {
        await sleep(1000); // [TEMP] To make output less dense for demo
        
        const success = await applyFileChange(fileChange, baseDir);
        if (success) {
            stats.successful++;
            if (verbose) {
                console.log('');
                console.log(`• Applied changes to ${fileChange.filePath}`);
                fileChange.codeChanges.forEach(change => {
                    console.log(`  ◦ ${change.type}: ${change.originalCode} -> ${change.newCode}`);
                });
            }
        } else {
            stats.failed++;
            console.log('');
            console.error(`• Failed to apply changes to ${fileChange.filePath}`);
            if (verbose) {
                fileChange.codeChanges.forEach(change => {
                    console.error(`  ◦ ${change.type}: ${change.originalCode} -> ${change.newCode}`);
                });
            }
        }
    }

    console.debug(`Applied changes to ${stats.successful} files, failed for ${stats.failed} files`);
    return stats;
}


/**
 * Helper function to create a delay
 * @param ms Time to sleep in milliseconds
 * @returns Promise that resolves after the specified time
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
