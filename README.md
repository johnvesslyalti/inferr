# AI Developer Feed

A NestJS-based backend application for an AI-powered developer feed service. This application provides infrastructure for aggregating, processing, and serving developer-focused content powered by AI.

## Prerequisites

- Node.js (v18+)
- npm or yarn
- Docker & Docker Compose

## Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) - Progressive Node.js framework
- **Database**: PostgreSQL with pgvector extension (for AI embeddings)
- **Cache**: Redis
- **ORM**: TypeORM
- **Language**: TypeScript
- **Testing**: Jest

## Getting Started

### Installation

```bash
npm install
```

### Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

### Start Services (Docker)

Start PostgreSQL and Redis using Docker Compose:

```bash
docker-compose up -d
```

This will start:
- PostgreSQL (port 5432) - database for storing content and embeddings
- Redis (port 6379) - caching layer

Verify services are healthy:

```bash
docker-compose ps
```

### Development

```bash
# Start in watch mode
npm run start:dev

# Start in debug mode
npm run start:debug

# Start in normal mode
npm run start
```

The application will be available at `http://localhost:3000`

### Production

```bash
# Build the application
npm run build

# Start production server
npm run start:prod
```

## Testing

```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run end-to-end tests
npm run test:e2e
```

## Code Quality

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## Project Structure

```
src/
├── app.controller.ts    # Main controller
├── app.controller.spec.ts
├── app.service.ts       # Core service logic
├── app.module.ts        # Root module
└── main.ts              # Application entry point
```

## Configuration Files

- `.prettierrc` - Code formatting rules
- `nest-cli.json` - NestJS CLI configuration
- `tsconfig.json` - TypeScript configuration
- `eslint.config.mjs` - ESLint rules
- `docker-compose.yml` - Development services

## Development Workflow

1. Start services: `docker-compose up -d`
2. Install dependencies: `npm install`
3. Run in watch mode: `npm run start:dev`
4. Make changes and test
5. Commit and push to main branch

## Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

## Documentation

For more information on NestJS, visit the [official documentation](https://docs.nestjs.com).

## License

UNLICENSED
