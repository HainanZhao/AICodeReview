const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Create proxy for /path/to subpath
app.use(
  '/path/to',
  createProxyMiddleware({
    target: 'http://localhost:5960',
    changeOrigin: true,
    pathRewrite: { '^/path/to': '/path/to' },
    logLevel: 'info',
  })
);

// Health check
app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    proxy: 'localhost:3000/path/to -> localhost:5960/path/to',
  })
);

app.listen(3000, () => {
  console.log('🔗 Proxy server running on http://localhost:3000');
  console.log('   Forward: /path/to -> http://localhost:5960/path/to');
  console.log('   Health: http://localhost:3000/health');
  console.log('   Usage: http://localhost:3000/path/to');
});
