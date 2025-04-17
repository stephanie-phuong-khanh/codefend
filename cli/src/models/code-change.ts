// Code change interfaces

export interface CodeChange {
  type: 'replace';
  lineStart: number; // Start line of the change
  lineEnd: number;   // End line of the change
  originalCode: string; // Original code before the change
  newCode: string; // New code after the change
}

export interface FileChange {
  filePath: string; // Relative path to the file that needs to be changed
  codeChanges: CodeChange[];
}
