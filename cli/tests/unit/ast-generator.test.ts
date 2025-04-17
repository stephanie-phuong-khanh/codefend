import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  ASTNode,
  extractClasses,
  extractExports,
  extractFunctions,
  extractImports,
  extractInterfaces,
  generateDirectoryAST,
  generateFileAST,
} from "../../src/generators";

describe("AST Generator", () => {
  // Create a temporary directory for test files
  let tempDir: string;

  beforeAll(() => {
    // Create a temporary directory for our test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ast-generator-test-"));
  });

  afterAll(() => {
    // Clean up temporary files after tests
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
    }
  });

  // Helper function to create test files
  function createTestFile(filename: string, content: string): string {
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  describe("generateFileAST", () => {
    it("should generate AST for a TypeScript file", async () => {
      // Create a test TypeScript file
      const tsContent = `
        import { useState } from 'react';
        
        interface User {
          id: number;
          name: string;
        }
        
        export function getUserName(user: User): string {
          return user.name;
        }
        
        export class UserService {
          getUser(id: number): User {
            return { id, name: 'Test User' };
          }
        }
      `;

      const tsFilePath = createTestFile("test.ts", tsContent);

      // Generate AST
      const ast = await generateFileAST(tsFilePath);

      // Basic assertions
      expect(ast).toBeDefined();
      expect(ast.type).toBe("program");
      expect(ast.children).toBeDefined();
      expect(ast.children?.length).toBeGreaterThan(0);
    });

    it("should throw an error for unsupported file types", async () => {
      // Create a test file with unsupported extension
      const filePath = createTestFile("test.txt", "This is a text file");

      // Expect error when generating AST
      await expect(generateFileAST(filePath)).rejects.toThrow(
        "Unsupported file extension"
      );
    });
  });

  describe("generateDirectoryAST", () => {
    it("should generate ASTs for all matching files in a directory", async () => {
      // Create multiple test files
      const tsFile = createTestFile("test1.ts", "export const x = 1;");
      const jsFile = createTestFile("test2.js", "export const y = 2;");
      createTestFile("test3.txt", "Not a script file"); // Should be ignored

      // Generate ASTs for the directory
      const result = await generateDirectoryAST(tempDir, "**/*.{ts,js}");

      // Assertions
      expect(result.totalFiles).toBe(result.files.length);
      expect(result.files.length).toBeGreaterThanOrEqual(2);
      expect(result.errors.length).toBe(0);

      // Check if the file paths are included
      const filePaths = result.files.map((f) => f.filePath);
      expect(filePaths).toContain(tsFile);
      expect(filePaths).toContain(jsFile);
    });

    it("should handle errors for invalid files", async () => {
      // Create a directory with a non-existent file pattern
      const result = await generateDirectoryAST(tempDir, "**/*.nonexistent");

      // Should have no files but no errors
      expect(result.totalFiles).toBe(0);
      expect(result.files.length).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    it("should throw an error for non-existent directories", async () => {
      // Try to generate ASTs for a non-existent directory
      await expect(
        generateDirectoryAST("/nonexistent/directory")
      ).rejects.toThrow("Directory does not exist");
    });
  });

  describe("Node extraction utilities", () => {
    let ast: ASTNode;

    beforeAll(async () => {
      // Create a test file with various node types
      const content = `
        import { Component } from 'react';
        import * as utils from './utils';
        
        interface Props {
          title: string;
        }
        
        export function Header(props: Props) {
          return props.title;
        }
        
        export class Footer extends Component {
          render() {
            return 'Footer';
          }
        }
        
        export default function App() {
          return 'App';
        }
      `;

      const filePath = createTestFile("component.tsx", content);
      ast = await generateFileAST(filePath);
    });

    it("should extract imports", () => {
      const imports = extractImports(ast);
      expect(imports.length).toBe(2);
      expect(imports[0].text).toContain("import { Component } from 'react'");
      expect(imports[1].text).toContain("import * as utils from './utils'");
    });

    it("should extract exports", () => {
      const exports = extractExports(ast);
      expect(exports.length).toBe(3); // function, class, and default export
    });

    it("should extract functions", () => {
      const functions = extractFunctions(ast);
      expect(functions.length).toBeGreaterThan(0);
      // At least one function should contain 'Header'
      expect(functions.some((f) => f.text.includes("Header"))).toBe(true);
    });

    it("should extract classes", () => {
      const classes = extractClasses(ast);
      expect(classes.length).toBeGreaterThan(0);
      // At least one class should contain 'Footer'
      expect(classes.some((c) => c.text.includes("Footer"))).toBe(true);
    });

    it("should extract interfaces", () => {
      const interfaces = extractInterfaces(ast);
      expect(interfaces.length).toBeGreaterThan(0);
      // At least one interface should contain 'Props'
      expect(interfaces.some((i) => i.text.includes("Props"))).toBe(true);
    });
  });
});
