#!/usr/bin/env node

/**
 * Test script for AI Code Review subpath proxy setup
 *
 * This script demonstrates how to test your AI Code Review app
 * when hosted behind a proxy on a subpath.
 */

const { spawn } = require('node:child_process');
const { setTimeout } = require('node:timers/promises');

console.log('🧪 AI Code Review Subpath Proxy Test');
console.log('=====================================\n');

console.log('📋 Test Setup:');
console.log('   1. AI Code Review server runs on port 5960 with subpath "/path/to"');
console.log('   2. Proxy server runs on port 3000 and forwards /path/to -> localhost:5960/path/to');
console.log('   3. Access via: http://localhost:3000/path/to\n');

console.log('🚀 Starting test sequence...\n');

async function runTest() {
  console.log('Step 1: Starting AI Code Review server...');
  const aiServer = spawn('node', ['./bin/cli.js', '--sub-path', '/path/to'], {
    stdio: 'pipe',
    cwd: process.cwd(),
  });

  aiServer.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('AI Code Review is ready')) {
      console.log('✅ AI Code Review server is ready!');
    }
    process.stdout.write(`[AI-SERVER] ${output}`);
  });

  aiServer.stderr.on('data', (data) => {
    process.stderr.write(`[AI-SERVER-ERR] ${data}`);
  });

  // Wait for server to start
  await setTimeout(3000);

  console.log('\nStep 2: Starting proxy server...');
  const proxyServer = spawn('node', ['debug/proxy-server.js'], {
    stdio: 'pipe',
    cwd: process.cwd(),
  });

  proxyServer.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Proxy Server Configuration')) {
      console.log('✅ Proxy server is ready!');
    }
    process.stdout.write(`[PROXY] ${output}`);
  });

  proxyServer.stderr.on('data', (data) => {
    process.stderr.write(`[PROXY-ERR] ${data}`);
  });

  // Wait for proxy to start
  await setTimeout(2000);

  console.log('\n🌐 Test URLs:');
  console.log('   📱 Direct access: http://localhost:5960/path/to');
  console.log('   🔗 Through proxy: http://localhost:3000/path/to');
  console.log('   ❤️  Proxy health: http://localhost:3000/health');

  console.log('\n📝 Testing with curl...');

  // Test proxy health
  console.log('\n1. Testing proxy health...');
  const healthTest = spawn('curl', ['-s', 'http://localhost:3000/health'], {
    stdio: 'pipe',
  });

  healthTest.stdout.on('data', (data) => {
    console.log('   Health response:', data.toString());
  });

  await setTimeout(1000);

  // Test direct access to AI server
  console.log('\n2. Testing direct AI server access...');
  const directTest = spawn('curl', ['-s', '-I', 'http://localhost:5960/path/to'], {
    stdio: 'pipe',
  });

  directTest.stdout.on('data', (data) => {
    console.log('   Direct access response headers:');
    console.log('  ', data.toString().replace(/\n/g, '\n   '));
  });

  await setTimeout(1000);

  // Test proxy access
  console.log('\n3. Testing proxy access...');
  const proxyTest = spawn('curl', ['-s', '-I', 'http://localhost:3000/path/to'], {
    stdio: 'pipe',
  });

  proxyTest.stdout.on('data', (data) => {
    console.log('   Proxy access response headers:');
    console.log('  ', data.toString().replace(/\n/g, '\n   '));
  });

  console.log('\n✅ Test setup complete!');
  console.log('\n🎯 Next steps:');
  console.log('   1. Open http://localhost:3000/path/to in your browser');
  console.log('   2. Verify that the app loads correctly');
  console.log('   3. Test API endpoints through the proxy');
  console.log('\n🛑 Press Ctrl+C to stop all servers');

  // Handle cleanup
  const cleanup = () => {
    console.log('\n🧹 Cleaning up...');
    aiServer.kill('SIGTERM');
    proxyServer.kill('SIGTERM');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

runTest().catch(console.error);
