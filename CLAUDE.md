# DBML Editor - Project Documentation

## Project Overview

**dbml-editor** is a free online DBML (Database Markup Language) editor that provides real-time visualization of database schemas through an interactive ER diagram interface.

- **Version**: 0.5.0
- **Author**: Jingchao Di (alswlx@gmail.com)
- **Live Demo**: https://dbml-editor.alswl.com/
- **Repository**: https://github.com/alswl/dbml-editor

## Key Features

1. **DBML Syntax Highlighting** - Monaco Editor with custom DBML language support
2. **Live Preview** - Real-time ER diagram rendering as you type
3. **Import from SQL** - Convert SQL schemas to DBML (MySQL, Postgres, MSSQL)
4. **Export to SQL** - Convert DBML to SQL for various databases (MySQL, Postgres, MSSQL, Oracle)
5. **Interactive Diagrams** - Drag and drop entities, visual relationship rendering

## Tech Stack

### Core Framework
- **UmiJS 4.x** - React framework with Ant Design Pro integration
- **React 18** - UI library
- **TypeScript** - Type-safe development
- **pnpm** - Package manager

### Key Dependencies
- **@dbml/core** (3.4.3) - DBML parser, importer, and exporter
- **Monaco Editor** (0.48.0) - Code editor (VSCode engine)
- **AntV X6** (2.18.1) - Graph visualization library for ER diagrams
- **@antv/layout** (0.3.25) - Graph layout algorithms (Dagre)
- **Ant Design** (5.16.5) - UI component library
- **Ant Design Pro Components** (2.4.4) - Advanced UI components

### Development Tools
- **Husky** - Git hooks
- **lint-staged** - Pre-commit linting
- **Prettier** - Code formatting
- **ESLint** - Code linting

## Project Structure

```
dbml-editor/
├── src/
│   ├── pages/
│   │   └── Home/                    # Main editor page
│   │       ├── index.tsx            # Split-view layout (editor + viewer)
│   │       └── index.less           # Page styles
│   ├── components/
│   │   ├── editor/                  # Monaco Editor wrapper
│   │   │   ├── editor.tsx
│   │   │   └── index.ts             # Exports InitCode (default DBML)
│   │   └── viewer/                  # ER diagram viewer
│   │       ├── viewer.tsx           # AntV X6 graph component
│   │       └── index.ts
│   ├── services/
│   │   ├── dbml/                    # DBML parsing & conversion
│   │   │   └── index.ts             # Import/export format types, error formatting
│   │   ├── er/                      # ER diagram conversion
│   │   │   └── index.ts             # Converts Database model to X6 graph format
│   │   └── editor/                  # Editor services
│   │       └── syntax.ts            # DBML syntax highlighting
│   ├── nodes/
│   │   └── er.ts                    # Custom X6 node shapes for ER entities
│   ├── models/
│   │   └── global.ts                # Global state management
│   ├── constants/
│   │   └── index.ts                 # Application constants
│   ├── utils/
│   │   └── format.ts                # Utility functions
│   ├── access.ts                    # Access control
│   ├── app.ts                       # App configuration
│   └── global.ts                    # Global initialization
├── .umirc.ts                        # UmiJS configuration
├── package.json                     # Dependencies & scripts
└── tsconfig.json                    # TypeScript configuration
```

## Architecture

### Data Flow

1. **User Input** → Monaco Editor
2. **Debounced Change** (2s delay) → DBML Parser (@dbml/core)
3. **Database Model** → ER Converter (src/services/er)
4. **Graph Model** → Dagre Layout Algorithm
5. **Positioned Graph** → AntV X6 Renderer
6. **Visual ER Diagram** → User sees result

### Key Components

#### 1. Home Page (`src/pages/Home/index.tsx`)
- Split-screen layout (responsive)
- Left: Monaco Editor with DBML code
- Right: Interactive ER diagram viewer
- Import/Export floating action buttons
- Modal dialogs for SQL import/export
- Real-time error messaging
- Debounced parsing (2 second delay)

#### 2. Editor Component (`src/components/editor/`)
- Monaco Editor integration
- DBML syntax highlighting
- Dark theme
- Auto-layout, no minimap
- Stores default/initial DBML code

#### 3. Viewer Component (`src/components/viewer/viewer.tsx`)
- AntV X6 graph instance
- Dagre layout (left-to-right, hierarchical)
- Snapline plugin for alignment
- Interactive node dragging
- Auto-centering
- Background color: #F2F7FA

#### 4. ER Service (`src/services/er/index.ts`)
Converts DBML Database model to X6 graph format:
- **Tables → Nodes**: ER entity rectangles with ports
- **Fields → Ports**: Field name, type, PK (🔑), Not Null (🚫)
- **Table Notes → Ports**: Special note ports
- **Refs → Edges**: Relationship arrows with cardinality labels

#### 5. DBML Service (`src/services/dbml/index.ts`)
- Type definitions for import/export formats
- Error formatting for compiler errors
- Supported formats:
  - Import: MySQL, Postgres, Postgres Legacy, DBML, MSSQL, JSON
  - Export: MySQL, Postgres, DBML, MSSQL, Oracle, JSON

### Custom X6 Shapes (`src/nodes/er.ts`)
- `er-rect`: Custom ER entity rectangle
- Ports for fields and notes
- Custom styling for database entities

## Configuration

### UmiJS Config (`.umirc.ts`)
- **Layout**: Ant Design Pro layout with custom title
- **Routes**: Single-page app with external links to docs
- **Analytics**: Google Analytics (GA4) + Baidu Analytics
- **Build**: esbuild minification with IIFE
- **Plugins**: antd, access, model, initialState, request

### Package Scripts
```json
{
  "dev": "max dev",           // Start development server
  "build": "max build",       // Production build
  "start": "npm run dev",     // Alias for dev
  "format": "prettier --cache --write .",
  "setup": "max setup",       // Setup UmiJS
  "postinstall": "max setup"
}
```

## Roadmap (from README)

- [ ] Better syntax highlighting
- [ ] Editor inline error hints
- [ ] Hidden foreign key option
- [ ] Better styling based on notes
- [ ] ER diagram position save/restore

## Important Implementation Details

### Parsing & Error Handling
- DBML parsing uses `@dbml/core` Parser
- Errors are caught and displayed via Ant Design message API
- CompilerError types are formatted with custom ErrorFmt function
- Parser runs in `dbmlv2` mode

### Layout Algorithm
- Uses Dagre layout (directed graph)
- Configuration:
  - `rankdir: 'LR'` (left to right)
  - `align: 'UL'` (upper-left alignment)
  - `ranksep: 80px` (rank separation)
  - `nodesep: 60px` (node separation)
  - `controlPoints: true` (smooth edges)

### State Management
- React hooks (useState, useEffect)
- Debounced code updates (2 second delay)
- Separate state for:
  - DBML code
  - Parsed database model
  - Import/export modals
  - Import/export text and formats

### Graph Interactions
- Node dragging: enabled
- Edge/label dragging: disabled
- Panning: enabled
- Mouse wheel zoom: disabled
- Snapline: enabled (for alignment guides)
- Auto-centering on load

## Development Workflow

1. **Install**: `pnpm install`
2. **Dev Server**: `pnpm dev`
3. **Build**: `pnpm build`
4. **Format**: `pnpm format`

## Git Hooks
- **pre-commit**: Runs lint-staged (prettier, linting)
- **commit-msg**: Validates commit message format

## Alternatives & Competition
- dbdiagram.io (commercial)
- dbml.org (official DBML site)
- dber.tech
- TruDan/dbdiagram-oss (open source)

## Customization Ideas

When customizing this project, consider:

1. **Enhanced Editor Features**
   - Inline error hints in Monaco Editor
   - Auto-completion for DBML syntax
   - Code snippets for common patterns
   - Multi-file support

2. **Diagram Enhancements**
   - Save/restore diagram positions (localStorage)
   - Export diagram as image (PNG, SVG)
   - Zoom controls
   - Different layout algorithms (hierarchical, circular, force-directed)
   - Dark mode for diagrams
   - Custom color schemes per table/schema

3. **Import/Export Extensions**
   - More database formats (SQLite, MariaDB)
   - Schema diff tool
   - Migration script generation
   - Batch import from multiple files

4. **Collaboration Features**
   - Share diagram via URL
   - Real-time collaboration
   - Comments on tables/fields
   - Version history

5. **User Experience**
   - Keyboard shortcuts
   - Command palette
   - Tutorial/onboarding
   - Example templates library
   - Search within schema

6. **Integration**
   - GitHub integration (load from repo)
   - REST API for programmatic access
   - CLI tool
   - VS Code extension

## Notes for AI Development

- The project uses UmiJS conventions (pages/, components/, services/)
- All components are functional React components with hooks
- TypeScript is used throughout with loose type checking
- Monaco Editor requires special handling for custom languages
- X6 graph requires manual layout calculation (done via @antv/layout)
- Debouncing is critical to avoid performance issues during typing
- The DBML parser can throw errors that need try-catch handling

---

## Agent Instructions (Task Tracking & Session Completion)

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

### Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
