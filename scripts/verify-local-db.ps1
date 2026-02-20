param(
    [switch]$Fix,
    [string]$DatabaseUrl = $env:DATABASE_URL
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  $repoRoot = Split-Path -Parent $scriptDir
  $envFilePath = Join-Path $repoRoot ".env"

  if (Test-Path $envFilePath) {
    $databaseUrlLine = Get-Content $envFilePath | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if ($databaseUrlLine) {
      $DatabaseUrl = ($databaseUrlLine -replace '^\s*DATABASE_URL\s*=\s*', '').Trim()
      if (($DatabaseUrl.StartsWith('"') -and $DatabaseUrl.EndsWith('"')) -or ($DatabaseUrl.StartsWith("'") -and $DatabaseUrl.EndsWith("'"))) {
        $DatabaseUrl = $DatabaseUrl.Substring(1, $DatabaseUrl.Length - 2)
      }
    }
  }
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  Write-Host "DATABASE_URL is not set (env var or .env)" -ForegroundColor Red
    exit 1
}

$nodeScript = @'
const { Client } = require('pg');

const databaseUrl = process.env.DATABASE_URL;
const fixMode = process.argv.includes('--fix');

const requiredSessionColumns = [
  'initiative_locked',
  'encounter_active',
  'combat_round',
  'active_turn_session_character_id'
];

async function getColumns(client, tableName) {
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );

  return new Set(result.rows.map((row) => row.column_name));
}

(async () => {
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    const sessionColumns = await getColumns(client, 'sessions');
    const missingSessionColumns = requiredSessionColumns.filter((name) => !sessionColumns.has(name));

    if (missingSessionColumns.length === 0) {
      console.log('PASS: sessions schema is compatible for local smoke tests');
      process.exit(0);
    }

    console.log('WARN: missing sessions columns:', missingSessionColumns.join(', '));

    const canAutoFix = missingSessionColumns.every((column) => column === 'initiative_locked');
    if (fixMode && canAutoFix) {
      await client.query('ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "initiative_locked" BOOLEAN NOT NULL DEFAULT false');
      const sessionColumnsAfterFix = await getColumns(client, 'sessions');
      const missingAfterFix = requiredSessionColumns.filter((name) => !sessionColumnsAfterFix.has(name));

      if (missingAfterFix.length === 0) {
        console.log('PASS: auto-fix applied, sessions schema is now compatible');
        process.exit(0);
      }

      console.log('FAIL: auto-fix completed but required columns are still missing:', missingAfterFix.join(', '));
      process.exit(1);
    }

    if (fixMode && !canAutoFix) {
      console.log('FAIL: --Fix supports only initiative_locked drift; run prisma migrate deploy');
    } else {
      console.log('FAIL: local schema drift detected; run `npx prisma migrate deploy` (or rerun with --Fix for initiative_locked-only drift)');
    }

    process.exit(1);
  } catch (error) {
    console.error('FAIL: verify-local-db execution error:', error.message || error);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
})();
'@

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$tempScriptPath = Join-Path $scriptDir (".verify-local-db-" + [guid]::NewGuid().ToString("N") + ".cjs")
Set-Content -Path $tempScriptPath -Value $nodeScript -Encoding UTF8

try {
    $env:DATABASE_URL = $DatabaseUrl
    if ($Fix) {
        node $tempScriptPath --fix
    } else {
        node $tempScriptPath
    }

    exit $LASTEXITCODE
}
finally {
    if (Test-Path $tempScriptPath) {
        Remove-Item $tempScriptPath -Force -ErrorAction SilentlyContinue
    }
}
