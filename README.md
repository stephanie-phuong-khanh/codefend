# Local Development

Make sure you've been added to the `codefend-ai` organization on GitHub and can access both of the following apps:

- OAuth app `Codefend AI App (Dev)` : https://github.com/organizations/codefend-ai/settings/applications/2961986
- GitHub app `Codefend AI (Dev)` : https://github.com/organizations/codefend-ai/settings/apps/codefend-ai-dev

### Install dependencies

```bash
npm install
```

### Environment variables

Create a `.env` file with the following variables:

```
NEXT_PUBLIC_URL="http://localhost:3000"
NEXT_PUBLIC_GITHUB_APP_NAME="codefend-ai-dev"

DATABASE_URL="postgresql://<username>:<password>@localhost:5432/codefend"
DIRECT_URL="postgresql://<username>:<password>@localhost:5432/codefend"

GITHUB_OAUTH_CLIENT_ID='Ov23lih2JnwTcnVvI9Qr'
GITHUB_OAUTH_CLIENT_SECRET=''

GITHUB_APP_CLIENT_ID='Iv23li6tTLVvnZGvZ0kF'
GITHUB_APP_CLIENT_SECRET=''
GITHUB_APP_ID=1193742
GITHUB_APP_PRIVATE_KEY=''
GITHUB_APP_WEBHOOK_SECRET=''
JWT_SECRET=''
```

### Database

Set up your local Postgres database. Make sure you have postgres installed and have created a database called `codefend`. Set your username and password in the `.env` file where you set the `DATABASE_URL` and `DIRECT_URL` variables.

```bash
# Reads your Prisma schema file (prisma/schema.prisma) and applies the changes to your local database.
npx prisma migrate dev

# If you made changes to the schema, run the following. It creates a new migration file under `prisma/migrations` and regenerates the Prisma Client based on the schema. Here you also need to provide a name for the migration.
npx prisma migrate dev --name <migration-name>

# Open Prisma Studio
npx prisma studio

# If you need to reset the database
npx prisma db push --force-reset && npx prisma db seed
npx prisma migrate reset
```

### Run development server

Make sure it runs at `http://localhost:3000` because this callback URL is configured in the GitHub App.

```bash
npm run dev
```

# Set up production

When you push to main, the Vercel CI/CD pipeline will handle deployment. However, make sure your project builds successfully before pushing to main:

```bash
npm run build
```

### Environment variables

Pull the production environment variables from Vercel into your `.env.production.local` file:

```bash
vercel env pull .env.production.local
```

### Database

You have to manulaly apply the migrations to your production database in Supabase. This is because by default, there's no automatic integration between Vercel and Supabase for applying Prisma migrations. Also for now, we want to have a manual step to ensure that we're aware of the changes being applied.

Make sure you've been added to the `codefend-db` project in Supabase.

```bash
npx prisma migrate deploy
```
