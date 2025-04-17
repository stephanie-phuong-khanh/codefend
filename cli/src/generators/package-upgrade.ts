import * as path from 'path';
import * as fs from 'fs';

import {
    FileChange,
    CodeChange
} from "../models/code-change";


function updatePackageJson(
    filePath: string, 
    packageName: string, 
    newVersion: string, 
    oldVersion?: string
): FileChange {
    // Read the package.json file
    const packageJsonContent = fs.readFileSync(filePath, 'utf8');
    const packageData = JSON.parse(packageJsonContent);
    
    const changes: CodeChange[] = [];
    
    // Check if package is in dependencies
    // TODO: Handle devDependencies and peerDependencies
    for (const depType of ['dependencies']) {
        if (packageData[depType] && packageData[depType][packageName]) {
            const currentVersion = packageData[depType][packageName];
            
            // If oldVersion is specified, only replace if it matches
            if (oldVersion && !currentVersion.includes(oldVersion)) {
                console.debug(`Current version ${currentVersion} doesn't contain ${oldVersion}, skipping`);
                continue;
            }
            
            // Extract version prefix (^, ~, etc.)
            const prefixMatch = currentVersion.match(/^([^\d]*)(.+)$/);
            let updatedVersion: string;
            
            if (prefixMatch) {
                const prefix = prefixMatch[1]; // e.g., "^" or "~"
                updatedVersion = `${prefix}${newVersion}`;
            } else {
                updatedVersion = newVersion;
            }
            
            // Create a change that replaces just the version
            packageData[depType][packageName] = updatedVersion;
        }
    }
    
    // Create a single change that replaces the entire file content
    const updatedContent = JSON.stringify(packageData, null, 2);
    
    const change: CodeChange = {
        type: 'replace',
        lineStart: 0,
        lineEnd: packageJsonContent.split('\n').length - 1,
        originalCode: packageJsonContent,
        newCode: updatedContent
    };
    
    return {
        filePath,
        codeChanges: [change]
    };
}

export function generatePackageUpgradeChanges(
    packageName: string,
    newVersion: string,
    targetDirectory: string
): FileChange[] {
    // This assumes that package.json is the only file that needs to be updated,
    // and it is located in the root of the target directory. TODO: Revise this.
    const packageJsonPath = path.join(targetDirectory, 'package.json');

    // Use the updatePackageJson function to generate the change
    const fileChange = updatePackageJson(packageJsonPath, packageName, newVersion);

    return [fileChange];
}
