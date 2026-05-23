# Turborepo Monorepo Structure

This is a Turborepo-based monorepo for the AI Developer Feed project.

## Directory Structure

```
.
├── apps/
│   ├── api/                 # NestJS backend API
│   └── web/                 # Next.js frontend
├── packages/
│   ├── types/              # Shared TypeScript types
│   ├── utils/              # Shared utilities
│   └── config/             # Shared configuration
├── docker-compose.yml      # Local development setup
├── turbo.json              # Turborepo configuration
├── pnpm-workspace.yaml     # pnpm workspace definition
└── package.json            # Root workspace package
```

## Getting Started

### Prerequisites
- Node.js 18+ (recommended 20+)
- pnpm (already installed globally)

### Installation

```bash
# Install dependencies for all packages
pnpm install
```

### Development

```bash
# Start all dev servers (backend + frontend)
pnpm dev

# Or run specific workspace
cd apps/api && pnpm dev
cd apps/web && pnpm dev
```

### Building

```bash
# Build all packages with Turborepo caching
pnpm build

# Build specific package
cd apps/web && pnpm build
```

### Testing

```bash
# Run tests across all packages
pnpm test

# Run tests with coverage
pnpm test:cov
```

### Linting & Formatting

```bash
# Lint all packages
pnpm lint

# Format all packages
pnpm format
```

### Production

```bash
# Start production server
pnpm start:prod
```

## Deployment

### Frontend (Next.js) - Vercel
- Deploy from `apps/web`
- Environment variables: `NEXT_PUBLIC_API_URL`

### Backend (NestJS) - Railway
- Deploy from `apps/api`
- Environment variables: `DATABASE_URL`, `JWT_SECRET`, etc.

## Scripts

- `pnpm dev` - Start all dev servers
- `pnpm build` - Build all packages
- `pnpm lint` - Lint all packages
- `pnpm format` - Format all code
- `pnpm test` - Run all tests
- `pnpm clean` - Clean all build artifacts

## Turborepo Caching

Turborepo automatically caches build outputs. Cache is stored in `.turbo/` directory. To clear cache:

```bash
pnpm clean
```

## Adding New Packages

To add a new shared package:

```bash
mkdir packages/my-package
cd packages/my-package
# Create package.json with appropriate name: @ai-developer-feed/my-package
```

To add a new app:

```bash
mkdir apps/my-app
cd apps/my-app
# Create package.json with appropriate name: @ai-developer-feed/my-app
```

## Dependencies

### Root Level
- **turbo**: Build system orchestration

### apps/api (NestJS Backend)
- **@nestjs/common**, **@nestjs/core**: NestJS core
- **typeorm**: Database ORM
- **pg**: PostgreSQL driver

### apps/web (Next.js Frontend)
- **next**: React framework
- **react**, **react-dom**: React library
- **tailwindcss**: CSS framework

### packages/types
- Shared TypeScript types for both backend and frontend
