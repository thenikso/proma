# proma-web

A full-stack web application for creating, editing, and running Proma visual programs.

## Overview

`proma-web` consists of two main parts:

- **Frontend** - Svelte-based SPA with a visual programming editor
- **Backend** - AWS Lambda serverless functions for project storage and execution

The deployed application is served via `proma.app` for production and `proma.dev` for development.

## Architecture

### Frontend

Built with:
- **Svelte** - UI framework
- **esbuild** - Fast bundling
- **@proma/core** - Visual programming engine
- **@proma/svelte-components** - Editor UI components
- **Auth0** - Authentication

### Backend

Built with:
- **Serverless Framework** - Infrastructure as code
- **AWS Lambda** - Serverless functions
- **DynamoDB** - NoSQL database for projects and hosts
- **S3** - File storage for project data
- **API Gateway** - HTTP API endpoints
- **Auth0** - JWT token validation

## Prerequisites

- Node.js (v14 or later)
- pnpm (install with `npm install -g pnpm`)
- AWS CLI (for deployment)
- Java Runtime (for DynamoDB Local)

## Local Development Setup

### 1. Install Dependencies

From the `proma-web` directory:

```bash
pnpm install
```

### 2. Setup Local DynamoDB

DynamoDB Local is required for the backend to run locally:

```bash
pnpm setup
```

This will:
- Download and install DynamoDB Local
- Create the necessary database tables
- Seed initial data

### 3. Configure Environment Variables

The backend uses these environment variables (configured in `serverless.yml`):

```yaml
AUTH0_DOMAIN: 'thenikso.eu.auth0.com'
SERVICE: ${stage}-proma-web
S3_PROJECT_DATA_BUCKET: ${stage}-proma-projects
DYNAMODB_HOSTS_TABLE: ${stage}-hosts
DYNAMODB_PROJECTS_TABLE: ${stage}-projects
```

For the frontend, create a `.env` file or set these in your build environment:

```bash
BACKEND_ENDPOINT=http://localhost:3000/dev
AUTH0_DOMAIN=thenikso.eu.auth0.com
AUTH0_CLIENTID=I0Vdf3zf7yoUnuvqKxYydiihHstUPd2G
AUTH0_AUDIENCE=dev-proma-web
```

### 4. Start the Backend

In one terminal, start the serverless backend with offline mode:

```bash
pnpm dev:backend
```

This will:
- Start DynamoDB Local on port 8000
- Start S3 Local (s3rver) on port 4569
- Start API Gateway on port 3000
- Seed local data

The backend API will be available at: **http://localhost:3000/dev**

### 5. Build, Watch, and Serve Frontend

In a second terminal, build, watch, and serve the frontend:

```bash
pnpm dev:frontend
```

This will:
- Use esbuild to bundle the Svelte app
- Watch for changes and rebuild automatically
- Serve the frontend on port 3000

The frontend will be available at: **http://localhost:3000**

### Alternative: Using the Playground

For quick experimentation without backend setup, use the offline playground:

```bash
pnpm serve
# Navigate to http://localhost:3000/playground
```

The playground runs entirely in the browser with localStorage for persistence.

## Project Structure

```
proma-web/
├── frontend/                   # Svelte frontend application
│   ├── src/
│   │   ├── routes/             # Application routes
│   │   │   ├── index.svelte    # Home page
│   │   │   ├── playground.svelte  # Offline playground
│   │   │   └── edit.svelte     # Project editor
│   │   └── lib/                # Shared components and utilities
│   │       ├── api.js          # Backend API client
│   │       ├── stores/         # Svelte stores (auth, routing)
│   │       ├── playground-projects/  # Example projects
│   │       └── ...             # Editor components
│   ├── public/                 # Static assets
│   └── esbuild.mjs             # Build configuration
├── backend/                    # Serverless backend
│   ├── src/
│   │   ├── authorizer.js       # Auth0 JWT authorizer
│   │   ├── project.js          # Project CRUD endpoints
│   │   ├── run.js              # Execute Proma endpoints
│   │   └── lib/
│   │       ├── aws.js          # AWS SDK helpers
│   │       └── buildCode.js    # esbuild integration
│   └── serverless.yml          # AWS infrastructure config
├── seeds/                      # Local development data
│   ├── hosts.json              # Sample hosts
│   ├── projects.json           # Sample projects
│   └── s3rver/                 # S3 seed files
└── package.json
```

## API Endpoints

### Authentication

All endpoints (except `/run`) require an Auth0 JWT token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

### GET /project/{hostId}/{projectSlug}

Retrieve a project's files.

**Authorization:** Required (must own host or be admin)

**Response:**
```json
{
  "files": {
    "main.proma": "base64...",
    "endpoints/greet.proma": "base64..."
  }
}
```

### POST /project/{hostId}/{projectSlug}

Save project files.

**Authorization:** Required (must own host or be admin)

**Request Body:**
```json
{
  "files": {
    "main.proma": "base64...",
    "endpoints/greet.proma": "base64..."
  }
}
```

**Response:**
```json
{
  "success": true
}
```

### ANY /run/{hostId}/{projectSlug}/{endpoint}

Execute a Proma endpoint publicly (no authentication required).

**Example:**
```
POST /run/nikso/default/greet
Content-Type: application/json

{
  "name": "World"
}
```

**Response:**
```json
{
  "result": "Hello World!",
  "logs": ["Greeting generated"]
}
```

**How it works:**
1. Loads project from DynamoDB
2. Retrieves endpoint file (e.g., `endpoints/greet.proma`) from S3
3. Deserializes the chip from JSON
4. Compiles chip to JavaScript
5. Bundles with esbuild (including remote imports)
6. Executes the compiled code
7. Returns result and logs

## Database Schema

### DynamoDB Tables

#### hosts

Stores host ownership information.

```json
{
  "hostId": "nikso",              // HASH key
  "ownerUserId": "auth0|123456"   // Owner's Auth0 user ID
}
```

#### projects

Stores project metadata.

```json
{
  "projectSlug": "default",       // HASH key
  "ownerHostId": "nikso",         // RANGE key
  "files": {                      // File references
    "main.proma": "ref",
    "endpoints/greet.proma": "ref"
  }
}
```

### S3 Buckets

#### {stage}-proma-projects

Project file storage.

**Structure:**
```
{hostId}/{projectSlug}/{filename}
```

**Example:**
```
nikso/default/endpoints/greet.proma
```

Files are stored as base64-encoded strings.

## Local S3 Setup

The backend uses `s3rver` for local S3 emulation. To manually interact with local S3:

### Configure AWS CLI Profile

```bash
aws configure --profile s3local
# AWS Access Key ID: S3RVER
# AWS Secret Access Key: S3RVER
```

### Upload Files

Upload a single file:
```bash
aws --endpoint http://localhost:4569 --profile s3local s3 cp \
  seeds/greet.json s3://dev-proma-projects/nikso/default/greet.json
```

Upload recursively:
```bash
aws --endpoint http://localhost:4569 --profile s3local s3 cp \
  --recursive seeds/s3rver s3://dev-proma-projects
```

### List Files

```bash
aws --endpoint http://localhost:4569 --profile s3local s3 ls \
  s3://dev-proma-projects/
```

## Frontend Routes

### / (Home)

Landing page with project list and creation.

### /playground

Offline playground editor that runs entirely in the browser. Projects are saved to localStorage.

**Features:**
- No backend required
- Example projects included
- Full editor capabilities
- Local persistence

### /edit/:hostId/:projectSlug

Full project editor with backend sync.

**Features:**
- Visual chip editor
- File browser
- Chip registry browser
- Test/run functionality
- Auto-save to backend
- Board details panel

## Development Scripts

```bash
# Setup
pnpm setup              # Install DynamoDB Local and seed data

# Frontend
pnpm dev:frontend       # Build, watch, and serve frontend (port 3000)
pnpm build:frontend     # Production build of frontend
pnpm serve              # Serve pre-built frontend on http://localhost:3000

# Backend
pnpm dev:backend        # Start serverless offline with DynamoDB and S3 (API on port 3000)
pnpm build:backend      # Package backend for deployment
pnpm deploy:backend     # Deploy backend to AWS

# Combined
pnpm dev                # Run both dev:frontend and dev:backend (in parallel)
pnpm build              # Build both frontend and backend
pnpm deploy             # Deploy both to AWS
```

**Note:** The `pnpm serve` command is only needed if you want to serve a pre-built frontend bundle. During development, `pnpm dev:frontend` handles both building and serving automatically.

## Deployment

### Prerequisites

1. **AWS Account** with credentials configured
2. **AWS CLI** installed and configured with profile `nikso-proma`
3. **Auth0 Account** with application configured

### Configure AWS Profile

In `serverless.yml`, the AWS profile is set to `nikso-proma`:

```yaml
provider:
  profile: nikso-proma
```

Make sure this profile is configured in `~/.aws/credentials`:

```ini
[nikso-proma]
aws_access_key_id = YOUR_ACCESS_KEY
aws_secret_access_key = YOUR_SECRET_KEY
```

### Deploy Backend

```bash
# Deploy to dev stage
pnpm deploy:backend

# Deploy to production stage
pnpm deploy:backend --stage prod
```

This will:
- Create DynamoDB tables
- Create S3 buckets
- Deploy Lambda functions
- Configure API Gateway
- Output the API endpoint URL

### Deploy Frontend

```bash
# Build frontend
pnpm build:frontend

# Deploy to S3 + CloudFront (manual setup required)
pnpm deploy:frontend
```

Note: Frontend deployment requires S3 bucket and CloudFront distribution to be configured separately.

### Environment Variables for Production

Update `frontend/esbuild.mjs` with production values:

```javascript
const env = {
  BACKEND_ENDPOINT: 'https://api.proma.app',
  AUTH0_DOMAIN: 'thenikso.eu.auth0.com',
  AUTH0_CLIENTID: 'YOUR_PRODUCTION_CLIENT_ID',
  AUTH0_AUDIENCE: 'prod-proma-web'
};
```

## Auth0 Configuration

### Application Setup

1. Create an Auth0 application (Single Page Application)
2. Configure allowed callbacks: `http://localhost:5000, https://proma.app`
3. Configure allowed origins: `http://localhost:5000, https://proma.app`
4. Note the Domain and Client ID

### API Setup

1. Create an Auth0 API
2. Set identifier (audience) to match environment (e.g., `dev-proma-web`)
3. Enable RS256 signing algorithm

### Update Configuration

Update the environment variables in your deployment:

```yaml
# serverless.yml
AUTH0_DOMAIN: 'your-tenant.auth0.com'

# frontend esbuild.mjs
AUTH0_DOMAIN: 'your-tenant.auth0.com'
AUTH0_CLIENTID: 'your-client-id'
AUTH0_AUDIENCE: 'your-api-identifier'
```

## Troubleshooting

### Backend not starting

**Issue:** DynamoDB Local fails to start

**Solution:**
```bash
# Ensure Java is installed
java -version

# Re-run setup
pnpm setup
```

### S3 connection errors

**Issue:** Cannot connect to local S3

**Solution:**
```bash
# Check s3rver is running (part of dev:backend)
# Ensure port 4569 is available
lsof -i :4569

# Restart backend
pnpm dev:backend
```

### Frontend build errors

**Issue:** Module not found errors

**Solution:**
```bash
# Rebuild dependencies
cd ../proma-core && pnpm build
cd ../proma-svelte-components && pnpm build
cd ../proma-web && pnpm dev:frontend
```

### Auth errors

**Issue:** 401 Unauthorized on API calls

**Solution:**
- Check Auth0 configuration matches environment variables
- Verify JWT token is valid and not expired
- Ensure user has permission for the host
- Check Auth0 audience matches backend configuration

## Testing

### Test the Run Endpoint Locally

```bash
# Start backend
pnpm dev:backend

# Make a request
curl -X POST http://localhost:3000/dev/run/nikso/default/greet \
  -H "Content-Type: application/json" \
  -d '{"name": "World"}'
```

Expected response:
```json
{
  "result": "Hello World!",
  "logs": [...]
}
```

### Test Project CRUD

```bash
# Get project (requires auth token)
curl http://localhost:3000/dev/project/nikso/default \
  -H "Authorization: Bearer YOUR_TOKEN"

# Save project (requires auth token)
curl -X POST http://localhost:3000/dev/project/nikso/default \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"files": {"test.proma": "eyJ0ZXN0IjogdHJ1ZX0="}}'
```

## Contributing

1. Make changes in `frontend/` or `backend/`
2. Test locally with `pnpm dev`
3. Build with `pnpm build`
4. Ensure `pnpm lint` passes
5. Submit pull request

## License

[Add license information]
