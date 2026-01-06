import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDb, closeDb } from './db/client.js';
import { buildApp } from './app.js';
import { generateApiKey } from './security/api-keys.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  console.log('Starting OADS Brain API Server...');
  console.log(`Environment: ${config.nodeEnv}`);

  // Initialize database
  console.log('Initializing database...');
  initDb();

  // Check if we need to generate an initial API key
  const adminKeyEnv = process.env['ADMIN_API_KEY'];
  if (!adminKeyEnv) {
    console.log('\n⚠️  No ADMIN_API_KEY found. Generating initial admin key...');
    const key = await generateApiKey('admin', 'full', 1000);

    // Save to .env file
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      if (!envContent.includes('ADMIN_API_KEY=')) {
        fs.appendFileSync(envPath, `\nADMIN_API_KEY=${key.key}\n`);
        console.log(`\n✅ API key saved to .env file`);
      }
    } else {
      fs.writeFileSync(envPath, `ADMIN_API_KEY=${key.key}\n`);
      console.log(`\n✅ API key saved to new .env file`);
    }

    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║ ADMIN API KEY (saved to .env)                                     ║');
    console.log('╠═══════════════════════════════════════════════════════════════════╣');
    console.log(`║ ${key.key} ║`);
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  } else {
    console.log('✅ Using existing ADMIN_API_KEY from environment');
  }

  // Build and start server
  const app = await buildApp();

  try {
    await app.listen({
      port: config.port,
      host: config.host
    });

    console.log(`\n🧠 OADS Brain API running at http://${config.host}:${config.port}`);
    console.log(`   Health check: http://localhost:${config.port}/health`);
    console.log(`   API docs: http://localhost:${config.port}/\n`);

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`\nReceived ${signal}, shutting down gracefully...`);

      try {
        await app.close();
        closeDb();
        console.log('Server closed successfully');
        process.exit(0);
      } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
    });
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
