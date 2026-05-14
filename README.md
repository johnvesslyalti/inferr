# AI Developer Feed

A full-stack monorepo application for an AI-powered developer feed service. Built with **Next.js** frontend and **NestJS** backend, using **Turborepo** for efficient workspace management.

## Tech Stack

### Frontend
- **Framework**: [Next.js 15](https://nextjs.org/) - React framework for production
- **Language**: TypeScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Deployment**: Vercel

### Backend
- **Framework**: [NestJS](https://nestjs.com/) - Progressive Node.js framework
- **Database**: PostgreSQL with pgvector extension (for AI embeddings)
- **Cache**: Redis
- **ORM**: TypeORM
- **Language**: TypeScript
- **Testing**: Jest
- **Deployment**: Railway

### Monorepo Management
- **Package Manager**: [pnpm](https://pnpm.io/) - Fast, disk space efficient package manager
- **Build System**: [Turborepo](https://turbo.build/) - High-performance build system

## Prerequisites

- **Node.js**: v18+ (recommended v20+)
- **pnpm**: Latest version (install globally: `npm install -g pnpm`)
- **Docker & Docker Compose**: For local development services
- **PostgreSQL**: v12+ (via Docker)
- **Redis**: (via Docker)

## Project Structure

```
.
├── apps/
│   ├── api/                 # NestJS backend API
│   │   ├── src/
│   │   ├── test/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                 # Next.js frontend
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── types/              # Shared TypeScript types
│   ├── utils/              # Shared utilities
│   └── config/             # Shared configuration
├── turbo.json              # Turborepo configuration
├── pnpm-workspace.yaml     # pnpm workspace definition
└── docker-compose.yml      # Local development services
```

For detailed monorepo documentation, see [MONOREPO.md](./MONOREPO.md).

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env.local
```

Then create `.env.local` files in each app:

**apps/api/.env.local:**
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_feed
JWT_SECRET=your-secret-key-change-in-production
API_PORT=3000
ANTHROPIC_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
```

**apps/web/.env.local:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### 3. Start Development Services

Start PostgreSQL and Redis using Docker Compose:

```bash
docker-compose up -d
```

Verify services are running:

```bash
docker-compose ps
```

### 4. Run Development Servers

**Start both frontend and backend:**
```bash
pnpm dev
```

**Or run individually:**

Frontend only:
```bash
cd apps/web && pnpm dev
```

Backend only:
```bash
cd apps/api && pnpm dev
```

### Access Points

- **Frontend**: http://localhost:3000 (or next available port)
- **Backend API**: http://localhost:3000/api

## Available Scripts

### Root Level (Orchestrated by Turborepo)

```bash
# Development
pnpm dev              # Start all dev servers

# Building
pnpm build            # Build all packages with Turborepo caching

# Code Quality
pnpm lint             # Lint all packages
pnpm format           # Format all code

# Testing
pnpm test             # Run all tests
pnpm test:cov         # Run tests with coverage

# Production
pnpm start:prod       # Start production servers

# Cleanup
pnpm clean            # Clean all build artifacts and node_modules
```

### Backend Specific (apps/api)

```bash
cd apps/api

pnpm dev              # Start in watch mode
pnpm build            # Build for production
pnpm start:prod       # Start production server
pnpm test             # Run unit tests
pnpm test:e2e         # Run end-to-end tests
pnpm lint             # Lint code
pnpm format           # Format code
```

### Frontend Specific (apps/web)

```bash
cd apps/web

pnpm dev              # Start dev server with hot reload
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm format           # Format code
```

## Development Workflow

### 1. Start Services

```bash
# Terminal 1: Start Docker services
docker-compose up -d

# Terminal 2: Install and run dev servers
pnpm install
pnpm dev
```

### 2. Make Changes

Edit code in `apps/api/src` or `apps/web/src`. Changes automatically reload in development mode.

### 3. Testing

```bash
# Test specific package
cd apps/api && pnpm test
cd apps/web && pnpm test

# Or test all
pnpm test
```

### 4. Code Quality

```bash
pnpm lint      # Check code
pnpm format    # Auto-format code
```

### 5. Commit Changes

```bash
git add <files>
git commit -m "type: description"
```

## Building for Production

### Build All

```bash
pnpm build
```

### Build Specific

```bash
cd apps/api && pnpm build
cd apps/web && pnpm build
```

## Deployment

### Frontend Deployment (Vercel)

1. Push to GitHub
2. Connect repository to [Vercel](https://vercel.com)
3. Set `NEXT_PUBLIC_API_URL` environment variable
4. Deploy automatically on push

### Backend Deployment (Railway)

1. Push to GitHub
2. Connect repository to [Railway](https://railway.app)
3. Set environment variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
4. Deploy automatically on push

## Stopping Services

```bash
# Stop all Docker services
docker-compose down

# Stop and remove data (clean slate)
docker-compose down -v
```

## Troubleshooting

### Port Already in Use

If port 3000 or 3001 is in use:

```bash
# Kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Kill process using port 3001
lsof -ti:3001 | xargs kill -9
```

### Database Connection Error

Ensure PostgreSQL is running:

```bash
docker-compose ps

# If not running:
docker-compose up -d
```

### Dependency Issues

Clear cache and reinstall:

```bash
pnpm clean
pnpm install
```

## Adding New Packages

To add a new shared package:

```bash
mkdir packages/my-package
cd packages/my-package
# Create package.json with name: @ai-developer-feed/my-package
```

To add a new app:

```bash
mkdir apps/my-app
cd apps/my-app
# Create package.json with name: @ai-developer-feed/my-app
```

## Documentation

- **Monorepo Documentation**: [MONOREPO.md](./MONOREPO.md)
- **NestJS Docs**: https://docs.nestjs.com
- **Next.js Docs**: https://nextjs.org/docs
- **Turborepo Docs**: https://turbo.build/repo/docs

## License

UNLICENSED
