import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDb, closeDb } from './db/client.js';
import { buildApp } from './app.js';
import { generateApiKey } from './security/api-keys.js';
import logger from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  logger.info('Starting OADS Brain API Server');
  logger.info('Environment', { env: config.nodeEnv });

  // Initialize database
  logger.info('Initializing database...');
  initDb();

  // Check if we need to generate an initial API key
  const adminKeyEnv = process.env['ADMIN_API_KEY'];
  if (!adminKeyEnv) {
    logger.warn('No ADMIN_API_KEY found. Generating initial admin key...');
    const key = await generateApiKey('admin', 'full', 1000);

    // Save to .env file
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      if (!envContent.includes('ADMIN_API_KEY=')) {
        fs.appendFileSync(envPath, `\nADMIN_API_KEY=${key.key}\n`);
        logger.info('API key saved to .env file');
      }
    } else {
      fs.writeFileSync(envPath, `ADMIN_API_KEY=${key.key}\n`);
      logger.info('API key saved to new .env file');
    }

    // Still log to console for initial setup visibility
    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║ ADMIN API KEY (saved to .env)                                     ║');
    console.log('╠═══════════════════════════════════════════════════════════════════╣');
    console.log(`║ ${key.key} ║`);
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  } else {
    logger.info('Using existing ADMIN_API_KEY from environment');
  }

  // Build and start server
  const app = await buildApp();

  try {
    await app.listen({
      port: config.port,
      host: config.host
    });

    logger.info('OADS Brain API running', {
      url: `http://${config.host}:${config.port}`,
      health: `http://localhost:${config.port}/health`
    });

  } catch (err) {
    logger.error('Failed to start server', { error: err });
    process.exit(1);
  }

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info('Shutting down gracefully', { signal });

      try {
        await app.close();
        closeDb();
        logger.info('Server closed successfully');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', { error: err });
        process.exit(1);
      }
    });
  }
}

main().catch(err => {
  logger.error('Fatal error', { error: err });
  process.exit(1);
});
