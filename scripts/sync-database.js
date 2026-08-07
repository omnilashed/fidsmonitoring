#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const sqlFilePath = path.join(repoRoot, 'database.sql');

function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fids_monitoring'
  };
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      current += char;
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === '*' && next === '/') {
        current += next;
        i += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (inSingleQuote) {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (inBacktick) {
      current += char;
      if (char === '`') {
        inBacktick = false;
      }
      continue;
    }

    if (char === '-' && next === '-') {
      current += '--';
      i += 1;
      inLineComment = true;
      continue;
    }

    if (char === '/' && next === '*') {
      current += '/*';
      i += 1;
      inBlockComment = true;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      current += char;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      current += char;
      continue;
    }

    if (char === '`') {
      inBacktick = true;
      current += char;
      continue;
    }

    if (char === ';') {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) {
    statements.push(tail);
  }

  return statements;
}

async function importWithMysqlCli(sqlContent) {
  const config = getDbConfig();
  const args = ['--host', config.host, '--port', String(config.port), '--user', config.user];

  if (config.password) {
    args.push('--password=' + config.password);
  } else {
    args.push('--password=');
  }

  return new Promise((resolve, reject) => {
    const mysqlProcess = execFile('mysql', args, {
      cwd: repoRoot,
      windowsHide: true,
      env: process.env
    }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      if (stderr && !stderr.includes('Warning')) {
        reject(new Error(stderr));
        return;
      }

      resolve({ stdout, stderr });
    });

    mysqlProcess.stdin.end(sqlContent);
  });
}

async function importWithMysql2(sqlContent) {
  const config = getDbConfig();
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
    await connection.query(`USE \`${config.database}\``);

    const statements = splitSqlStatements(sqlContent);
    for (const statement of statements) {
      try {
        await connection.query(statement);
      } catch (error) {
        if (error.message && error.message.includes('Cannot delete or update a parent row')) {
          console.warn('Lewati statement yang gagal karena constraint foreign key:', statement.split('\n')[0]);
          continue;
        }
        throw error;
      }
    }
  } finally {
    await connection.end();
  }
}

async function main() {
  if (!fs.existsSync(sqlFilePath)) {
    console.error(`File not found: ${sqlFilePath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  console.log(`Menerapkan ${path.relative(repoRoot, sqlFilePath)}...`);

  try {
    await importWithMysqlCli(sqlContent);
    console.log('Sinkronisasi database selesai.');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('Client mysql tidak ditemukan. Fallback ke mysql2...');
      try {
        await importWithMysql2(sqlContent);
        console.log('Sinkronisasi database selesai.');
        return;
      } catch (dbError) {
        if (dbError.code === 'ECONNREFUSED' || dbError.cause?.code === 'ECONNREFUSED') {
          console.error('MySQL/XAMPP belum berjalan atau port 3306 tidak dapat diakses.');
          console.error('Pastikan server MySQL Anda aktif sebelum menjalankan sinkronisasi.');
          process.exit(1);
        }

        console.error('Gagal menjalankan sinkronisasi database:');
        console.error(dbError.message);
        process.exit(1);
      }
    }

    if (error.code === 'ECONNREFUSED') {
      console.error('MySQL/XAMPP belum berjalan atau port 3306 tidak dapat diakses.');
      console.error('Pastikan server MySQL Anda aktif sebelum menjalankan sinkronisasi.');
      process.exit(1);
    }

    console.error('Gagal menjalankan sinkronisasi database:');
    console.error(error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
