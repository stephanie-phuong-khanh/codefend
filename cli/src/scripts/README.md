# Code Analysis Tools

This directory contains tools for analyzing and visualizing code structure.

## AST Visualization

The `visualize-ast` script allows you to visualize the Abstract Syntax Tree (AST) of TypeScript and JavaScript files or directories, and analyze package usage.

### Usage

```bash
# For a single file
npm run visualize-ast -- --file <path-to-file>

# For a directory
npm run visualize-ast -- --dir <path-to-directory>

# For package usage analysis
npm run visualize-ast -- --dir <path-to-directory> --package <package-name>
```

### Options

- `-f, --file <path>`: Path to the file to analyze
- `-d, --dir <path>`: Path to the directory to analyze
- `-p, --pattern <glob>`: File pattern to match when using directory mode (default: **/*.{ts,tsx,js,jsx})
- `--depth <number>`: Maximum depth of the AST to display (default: Infinity)
- `-o, --output <path>`: Output file path (default: stdout)
- `--format <format>`: Output format (json, tree) (default: tree)
- `--no-color`: Disable colored output
- `--summary`: Show only summary information for directory mode
- `--package <name>`: Analyze usage of a specific package in the codebase

### Examples

#### Single File Usage

```bash
# Visualize AST for a file
npm run visualize-ast -- --file src/index.ts

# Only show the first 3 levels of the AST
npm run visualize-ast -- --file src/index.ts --depth 3

# Save the AST visualization to a file
npm run visualize-ast -- --file src/index.ts --output ast-output.txt

# Output the AST in JSON format
npm run visualize-ast -- --file src/index.ts --format json
```

#### Directory Usage

```bash
# Visualize ASTs for all TypeScript/JavaScript files in a directory
npm run visualize-ast -- --dir src/

# Visualize ASTs for specific file patterns
npm run visualize-ast -- --dir src/ --pattern "**/*.ts"

# Show only a summary for each file (useful for directories with many files)
npm run visualize-ast -- --dir src/ --summary

# Combine options for more specific analysis
npm run visualize-ast -- --dir src/ --pattern "**/*.{ts,tsx}" --depth 2 --summary
```

#### Package Analysis Usage

```bash
# Analyze where a specific package is used in your codebase
npm run visualize-ast -- --dir src/ --package lodash

# Save package analysis results to a file
npm run visualize-ast -- --dir src/ --package express --output express-usage.txt

# Get JSON format output for integration with other tools
npm run visualize-ast -- --dir src/ --package react --format json

# Combine with pattern to focus on specific files
npm run visualize-ast -- --dir src/ --package axios --pattern "**/*.tsx"
```

> **Note:** The tool automatically ignores `node_modules` directories to improve performance and focus on your project code.

### Understanding the Output

#### Tree Format

The tree format displays each node with:

- **Node Type**: The type of the AST node (e.g., program, import_statement)
- **Position**: The start and end positions in the file (row:column format)
- **Text Preview**: A preview of the text content of the node

Example output:

```
AST for /path/to/file.ts:

└── program (0:0-10:0) "import { useState } from..."
    ├── import_statement (0:0-0:31) "import { useState } from..."
    │   ├── import (0:0-0:6) "import"
    │   ├── import_clause (0:7-0:19) "{ useState }"
    │   │   └── named_imports (0:7-0:19) "{ useState }"
    │   │       └── import_specifier (0:9-0:17) "useState"
    │   │           └── identifier (0:9-0:17) "useState"
    │   └── string (0:23-0:30) "'react'"
    └── ...
```

#### Package Analysis Format

When analyzing package usage, the output includes:

- **Summary**: Number of files using the package
- **File Details**: For each file that uses the package:
  - **Imports**: How the package is imported, with line numbers
  - **Method Calls**: Where package methods are used in the code
  - **Variable Names**: Aliases used for the package in the code

Example output:

```
Package Usage Analysis for lodash

Found 3 files using this package out of 42 analyzed files.

/path/to/src/utils/helpers.js
  Imports (1):
    (1:0) import _ from 'lodash'
  Method Calls (5):
    (10:2) _.map(items, item => item.id)
    (15:4) _.filter(users, user => user.active)
    ...
  Variable Names: _

/path/to/src/components/DataTable.jsx
  Imports (1):
    (2:0) import { sortBy, groupBy } from 'lodash'
  Method Calls (2):
    (45:10) sortBy(data, 'timestamp')
    (60:6) groupBy(records, 'category')
  Variable Names: sortBy, groupBy
  
...
```

## Project Structure Visualization

The `visualize-project` script allows you to analyze and visualize the structure of a project directory, including files, dependencies, and key components.

### Usage

```bash
# Analyze a project directory
npm run visualize-project -- --dir <path-to-project>

# Get a quick summary without reading all file contents
npm run visualize-project -- --dir <path-to-project> --summary

# Save project analysis to a file
npm run visualize-project -- --dir <path-to-project> --output project-analysis.txt
```

### Options

- `-d, --dir <path>`: Path to the project directory to analyze (required)
- `--summary`: Show only summary information without reading all file contents (faster)
- `-o, --output <path>`: Output file path (default: stdout)
- `--format <format>`: Output format (json, text) (default: text)
- `--no-color`: Disable colored output
- `--file-limit <number>`: Maximum number of files to include in full analysis (default: 10)

### Examples

```bash
# Get a detailed analysis of a project
npm run visualize-project -- --dir ./my-project

# Get a quick summary of a large project
npm run visualize-project -- --dir ./large-project --summary

# Export project structure as JSON for further processing
npm run visualize-project -- --dir ./my-project --format json --output project-data.json

# Increase the file limit for more comprehensive analysis
npm run visualize-project -- --dir ./my-project --file-limit 20
```

### Understanding the Output

#### Text Format

The text format provides a human-readable overview of the project:

- **Project Path**: The directory being analyzed
- **Dependencies**: List of dependencies from package.json
- **Files**: Preview of file contents (limited to keep output manageable)
- **File Types**: Count of files by extension

#### Summary Format

The summary format provides a high-level overview without reading all file contents:

- **File Statistics**: Total file count and breakdown by file type
- **Key Files**: Important files like index.js, App.js, package.json, etc.
- **Package Information**: Basic details from package.json

Example output:

```
Project Summary for /path/to/project

File Statistics:
Total Files: 42

File Types:
  js: 15
  tsx: 10
  ts: 8
  json: 5
  md: 4

Key Files:
  index.js
  App.js
  package.json
  webpack.config.js

Package Information:
  Name: my-project
  Version: 1.0.0
  Dependencies: 12
  Dev Dependencies: 8
```

## Integration with SmartUpgrade

These tools provide valuable insights for the SmartUpgrade process by:

1. Identifying where specific packages are used in your codebase
2. Understanding the overall project structure
3. Helping to target testing efforts after package upgrades
