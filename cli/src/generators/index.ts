import {
  extractClasses,
  extractExports,
  extractFunctions,
  extractImports,
  extractInterfaces,
  generateDirectoryAST,
  generateFileAST,
  type ASTGenerationResult,
  type ASTNode,
  type FileAST,
} from "../utils/code-analysis/ast-generator";
import { generateCodeFixes } from "./code-fix";
import { generatePackageUpgradeChanges } from "./package-upgrade";
export {
  extractClasses,
  extractExports,
  extractFunctions,
  extractImports,
  extractInterfaces,
  generateCodeFixes,
  generateDirectoryAST,
  generateFileAST,
  generatePackageUpgradeChanges,
  type ASTGenerationResult,
  type ASTNode,
  type FileAST,
};
