import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    apply: args.includes('--apply'),
    commit: args.includes('--commit'),
    file: (() => {
      const i = args.indexOf('--file');
      if (i >= 0 && args[i + 1]) return args[i + 1];
      return 'content/rules-pack.demo.json';
    })(),
  };
}

function runImport(args: string[]) {
  const cmd = `ts-node scripts/importRulesContent.ts ${args.join(' ')}`;
  console.log(`Running: ${cmd}`);
  return execSync(cmd, { stdio: 'inherit' });
}

function runImportCapture(args: string[]) {
  const cmd = `ts-node scripts/importRulesContent.ts ${args.join(' ')}`;
  console.log(`Running (capture): ${cmd}`);
  return execSync(cmd, { encoding: 'utf-8' });
}

function gitCommitAndPush(files: string[], message: string) {
  execSync(`git add ${files.map((f) => `'${f}'`).join(' ')}`);
  execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`);
  execSync('git push');
}

async function main() {
  const { apply, commit, file } = parseArgs();
  const reportFile = path.resolve('.artifacts', 'import-rules-report.json');
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });

  const args = [`--file`, file, `--report-file`, reportFile, `--update`];
  if (apply) args.push('--apply');

  // capture output so we can inspect JSON report
  let out: string | Buffer;
  try {
    out = runImportCapture(args);
  } catch (err) {
    console.error('Import process failed. See output above.');
    process.exit(1);
  }

  // read report
  let report: any = null;
  try {
    report = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
  } catch (e) {
    console.warn('No report file found or failed to parse report. Falling back to captured output.');
    try {
      report = JSON.parse(String(out).trim());
    } catch (ee) {
      report = null;
    }
  }

  if (!report) {
    console.log('No CI report available; aborting automated commit step.');
    process.exit(0);
  }

  const created = report?.autoUpdate?.createdPlaceholders || [];
  if (created.length === 0) {
    console.log('No placeholders created by auto-update. Nothing to commit.');
    process.exit(0);
  }

  if (!commit) {
    console.log('Placeholders created:', created.join(', '));
    console.log('Run this script with --commit to commit and push the updated pack file(s).');
    process.exit(0);
  }

  // find modified files (conservative: the pack file and its backup)
  const packFile = path.resolve(process.cwd(), file);
  const backups = fs.readdirSync(path.dirname(packFile)).filter((n) => n.startsWith(path.basename(packFile) + '.bak'));
  const backupPaths = backups.map((b) => path.resolve(path.dirname(packFile), b));

  try {
    gitCommitAndPush([packFile, ...backupPaths], `importer(auto-update): add ${created.length} placeholder(s) from ${path.basename(file)}`);
    console.log('Committed and pushed placeholder changes.');
  } catch (e) {
    console.error('Git commit/push failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
