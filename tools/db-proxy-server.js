/**
 * 数据库连接代理服务器 (DB Connection Proxy Server)
 *
 * 用途：浏览器无法直接连接数据库，此代理运行在本地 Node.js 环境中，
 *       为"数据导入脚本生成工具"提供数据库表结构查询接口。
 *
 * 启动方式：
 *   1. 安装依赖：npm install mysql2 pg mssql
 *   2. 运行：node db-proxy-server.js [端口号，默认 3579]
 *
 * 接口：
 *   GET  /api/health         — 健康检查
 *   POST /api/columns        — 查询表列信息
 *     Body: { dbType, host, port, database, user, password, table }
 *     Response: { table, columns: [{ column_name, data_type, is_nullable, column_default }] }
 */

const http = require('http');
const { URL } = require('url');

const PORT = parseInt(process.argv[2]) || 3579;

// ── CORS headers ──
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, data, status = 200) {
  setCORS(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

function error(res, message, status = 500) {
  setCORS(res);
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(String(message));
}

// ── Parse JSON body from POST request ──
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(new Error('Invalid JSON: ' + e.message)); }
    });
    req.on('error', reject);
  });
}

// ── Database-specific column queries ──
const QUERIES = {
  mysql: (table, database) => [
    `SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default, COLUMN_KEY AS column_key, EXTRA AS extra ` +
    `FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${database}' AND TABLE_NAME = '${table}' ORDER BY ORDINAL_POSITION`,
    'mysql'
  ],
  pgsql: (table, database) => [
    `SELECT column_name, data_type, is_nullable, column_default ` +
    `FROM INFORMATION_SCHEMA.COLUMNS WHERE table_catalog = '${database}' AND table_name = '${table}' ` +
    `ORDER BY ordinal_position`,
    'pgsql'
  ],
  mssql: (table, database) => [
    `SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default ` +
    `FROM ${database}.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = N'${table}' ORDER BY ORDINAL_POSITION`,
    'mssql'
  ]
};

// ── Database connector ──
async function queryColumns(config) {
  const { dbType, host, port, database, user, password, table } = config;
  const [sql, type] = (QUERIES[dbType] || QUERIES.mysql)(table, database);

  if (type === 'mysql') {
    let mysql2;
    try { mysql2 = require('mysql2/promise'); } catch { throw new Error('未安装 mysql2 包，请运行: npm install mysql2'); }
    const conn = await mysql2.createConnection({ host, port, user, password, database });
    const [rows] = await conn.execute(sql);
    await conn.end();

    return rows.map(r => ({
      column_name: r.column_name,
      data_type: r.data_type,
      is_nullable: r.is_nullable,
      column_default: r.column_default,
      is_primary_key: r.column_key === 'PRI',
      is_autoincrement: (r.extra || '').toLowerCase().includes('auto_increment')
    }));
  }

  if (type === 'pgsql') {
    let pg;
    try { pg = require('pg'); } catch { throw new Error('未安装 pg 包，请运行: npm install pg'); }
    const client = new pg.Client({ host, port, user, password, database });
    await client.connect();
    const result = await client.query(sql);
    await client.end();

    // Also get primary key info
    let pkResult;
    try {
      const pg2 = require('pg');
      const c2 = new pg2.Client({ host, port, user, password, database });
      await c2.connect();
      pkResult = await c2.query(
        `SELECT kcu.column_name FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc ` +
        `JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON tc.constraint_name = kcu.constraint_name ` +
        `WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'`,
        [table]
      );
      await c2.end();
    } catch { pkResult = { rows: [] }; }

    const pkSet = new Set(pkResult.rows.map(r => r.column_name));
    return result.rows.map(r => ({
      column_name: r.column_name,
      data_type: r.data_type,
      is_nullable: r.is_nullable,
      column_default: r.column_default,
      is_primary_key: pkSet.has(r.column_name),
      is_autoincrement: (r.column_default || '').toLowerCase().includes('nextval')
    }));
  }

  if (type === 'mssql') {
    let mssql;
    try { mssql = require('mssql'); } catch { throw new Error('未安装 mssql 包，请运行: npm install mssql'); }
    const pool = await mssql.connect({
      server: host, port, user, password, database,
      options: { encrypt: false, trustServerCertificate: true }
    });
    const result = await pool.request().query(sql);
    await pool.close();
    return result.recordset.map(r => ({
      column_name: r.column_name,
      data_type: r.data_type,
      is_nullable: r.is_nullable,
      column_default: r.column_default
    }));
  }

  throw new Error('不支持的数据库类型: ' + dbType);
}

// ── HTTP Server ──
const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    setCORS(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Health check
  if (req.method === 'GET' && reqUrl.pathname === '/api/health') {
    json(res, { status: 'ok', message: '数据库代理服务器运行中' });
    return;
  }

  // Get columns
  if (req.method === 'POST' && reqUrl.pathname === '/api/columns') {
    try {
      const config = await parseBody(req);
      if (!config.table) { error(res, '缺少 table 参数', 400); return; }
      if (!config.database) { error(res, '缺少 database 参数', 400); return; }

      console.log(`[${new Date().toISOString()}] 查询表: ${config.database}.${config.table} (${config.dbType})`);
      const columns = await queryColumns(config);
      console.log(`[${new Date().toISOString()}] 成功: ${columns.length} 列`);
      json(res, { table: config.table, columns });
    } catch (e) {
      console.error(`[${new Date().toISOString()}] 错误:`, e.message);
      error(res, e.message);
    }
    return;
  }

  // 404
  error(res, 'Not Found: ' + reqUrl.pathname, 404);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════╗
║     数据库连接代理服务器 (DB Proxy Server)     ║
║────────────────────────────────────────────────║
║  监听端口: ${String(PORT).padEnd(36)}║
║  健康检查: http://localhost:${String(PORT).padEnd(30)}/api/health ║
║────────────────────────────────────────────────║
║  支持的数据库:                                 ║
║    - MySQL    (需安装 mysql2)                  ║
║    - PostgreSQL (需安装 pg)                    ║
║    - SQL Server (需安装 mssql)                 ║
║────────────────────────────────────────────────║
║  安装依赖: npm install mysql2 pg mssql         ║
║  按 Ctrl+C 停止服务                            ║
╚════════════════════════════════════════════════╝
`);
});
