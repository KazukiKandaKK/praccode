if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@db:5432/praccode?schema=public';
  console.info('[autopilot] DATABASE_URL not set. Using default Docker DB URL.');
}

await import('./autopilot-worker-main.js');
