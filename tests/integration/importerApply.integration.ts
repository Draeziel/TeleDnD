import { execSync, spawnSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

function run(cmd: string, opts: any = {}) {
  console.log('>', cmd);
  return execSync(cmd, { stdio: 'inherit', shell: true, ...opts });
}

function runToFile(cmd: string, outFile: string, opts: any = {}) {
  console.log('>', cmd, '->', outFile);
  // Ensure parent dir
  try { fs.mkdirSync(path.dirname(outFile), { recursive: true }); } catch (e) {}
  // Run and capture output to file
  execSync(`${cmd} > "${outFile}" 2>&1`, { shell: true, ...opts });
}

async function waitForPostgres(url: string, timeoutSec = 60) {
  const start = Date.now();
  while ((Date.now() - start) / 1000 < timeoutSec) {
    try {
      const client = new PrismaClient({ datasources: { db: { url } } } as any);
      await client.$connect();
      await client.$disconnect();
      return true;
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('Postgres did not become available in time');
}

async function main() {
  // If Docker is not available on this machine, skip the integration test.
  try {
    execSync('docker version', { stdio: 'ignore' });
  } catch (err) {
    console.log('Docker not available; skipping integration test (requires Docker).');
    process.exit(0);
  }
  const cwd = path.resolve(__dirname, '../../');
  const containerName = `rpg-test-db-${Date.now()}`;
  const hostPort = 5433;
  const dbName = 'rpg_test';
  const dbUser = 'postgres';
  const dbPass = 'postgres';

  try {
    // Start Postgres in Docker
    run(`docker run --name ${containerName} -e POSTGRES_PASSWORD=${dbPass} -e POSTGRES_USER=${dbUser} -e POSTGRES_DB=${dbName} -p ${hostPort}:5432 -d postgres:16`);

    const databaseUrl = `postgresql://${dbUser}:${dbPass}@127.0.0.1:${hostPort}/${dbName}?schema=public`;

    // Wait for Postgres availability
    console.log('Waiting for Postgres...');
    await waitForPostgres(databaseUrl, 90);

    // Run prisma generate and migrations
    run('npx prisma generate', { cwd });
    run('npx prisma migrate deploy', { cwd, env: { ...process.env, DATABASE_URL: databaseUrl } });

    // Seed DB if seed script exists
    if (fs.existsSync(path.join(cwd, 'scripts', 'seed.ts'))) {
      run('npm run seed', { cwd, env: { ...process.env, DATABASE_URL: databaseUrl } });
    }

    // Run import with --update --apply against fixture and capture logs
    const fixture = path.join(cwd, 'tests', 'fixtures', 'missing-ref-pack.json');
    const reportFile = path.join(cwd, '.artifacts', `import-rules-report.${Date.now()}.json`);
    const importLog = path.join(cwd, '.artifacts', `import-rules-log.${Date.now()}.log`);
    fs.mkdirSync(path.dirname(reportFile), { recursive: true });

    try {
      runToFile(`npx ts-node scripts/importRulesContent.ts --apply --update --file "${fixture}" --report-file "${reportFile}"`, importLog, {
        cwd,
        env: { ...process.env, DATABASE_URL: databaseUrl },
      });
    } catch (err) {
      console.error('Import command failed; check log:', importLog);
      throw err;
    }

    // Verify DB contains created feature
    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } } as any);
    await prisma.$connect();
    const feat = await prisma.feature.findFirst({ where: { sourceRef: 'feature:missing_feature' } });
    await prisma.$disconnect();

    if (!feat) {
      throw new Error('Expected feature:missing_feature to be created in DB');
    }

    console.log('importerApply.integration: PASS');
    process.exit(0);
  } catch (err) {
    console.error('importerApply.integration: FAIL', err);
    process.exit(2);
  } finally {
    // Cleanup docker container
    try {
      run(`docker rm -f ${containerName}`);
    } catch (e) {
      // ignore
    }
    // Print any report/logs for CI artifact collection
    try {
      const artifactsDir = path.join(cwd, '.artifacts');
      if (fs.existsSync(artifactsDir)) {
        const files = fs.readdirSync(artifactsDir);
        for (const f of files) {
          console.log('Artifact:', path.join(artifactsDir, f));
        }
      }
    } catch (e) {
      // ignore
    }
  }
}

main();
