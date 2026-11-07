
# Tribal Store

## Database

Local development uses SQLite. On Vercel, the app uses the Supabase PostgreSQL connection string supplied by the Supabase integration. Make sure `POSTGRES_PRISMA_URL` or `POSTGRES_URL_NON_POOLING` is enabled for the deployment environment; the database tables and starter catalog are initialized automatically.

The app does not use Supabase's browser publishable/anon key for database writes. If no PostgreSQL connection string is configured on Vercel, API requests return a database-unavailable error rather than saving to temporary storage.

The existing local SQLite database is separate from Supabase; its records are not automatically copied to the hosted database.
