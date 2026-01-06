import { initDb } from '../db/client.js';
import { generateApiKey, listApiKeys } from '../security/api-keys.js';

async function main(): Promise<void> {
  // Initialize database
  initDb();

  const args = process.argv.slice(2);
  const command = args[0] ?? 'generate';

  if (command === 'list') {
    const keys = listApiKeys();
    console.log('\nExisting API Keys:');
    console.log('─'.repeat(80));

    if (keys.length === 0) {
      console.log('No API keys found.');
    } else {
      for (const key of keys) {
        const status = key.revoked_at ? '🔴 REVOKED' : '🟢 ACTIVE';
        console.log(`${status} ${key.id} - ${key.name} (${key.scope})`);
        console.log(`   Created: ${key.created_at}`);
        console.log(`   Last used: ${key.last_used_at ?? 'Never'}`);
        console.log('');
      }
    }
    return;
  }

  // Generate new key
  const name = args[0] ?? 'default';
  const scope = (args[1] as 'full' | 'read' | 'write') ?? 'full';
  const rateLimit = parseInt(args[2] ?? '100', 10);

  console.log(`\nGenerating new API key...`);
  console.log(`Name: ${name}`);
  console.log(`Scope: ${scope}`);
  console.log(`Rate limit: ${rateLimit}/minute`);

  const key = await generateApiKey(name, scope, rateLimit);

  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║ NEW API KEY (save this - it will not be shown again)             ║');
  console.log('╠═══════════════════════════════════════════════════════════════════╣');
  console.log(`║ ID: ${key.id.padEnd(60)} ║`);
  console.log(`║ Key: ${key.key} ║`);
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  console.log('Usage example:');
  console.log(`  curl -H "X-API-Key: ${key.key}" http://localhost:3000/api/v1/notes`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
