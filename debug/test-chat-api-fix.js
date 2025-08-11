#!/usr/bin/env node

/**
 * Test script to verify AI Chat API endpoints are working correctly
 * This script tests the fix for the 404 error on /api/start-chat endpoint
 */

import { strict as assert } from 'assert';

// Configuration
const FRONTEND_URL = 'http://localhost:5960';
const BACKEND_URL = 'http://localhost:5959';

// Test data
const testData = {
  lineContent: "const result = array.map(x => x * 2);",
  lineNumber: 5,
  filePath: "test.js",
  fileContent: "// Test file\nconst array = [1, 2, 3];\nconst result = array.map(x => x * 2);",
  contextLines: 3
};

/**
 * Test helper to make HTTP requests
 */
async function makeRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  return {
    ok: response.ok,
    status: response.status,
    data: response.ok ? await response.json() : null,
    error: !response.ok ? await response.text() : null
  };
}

/**
 * Test the backend directly
 */
async function testBackendDirect() {
  console.log('\n🔧 Testing Backend Direct Connection...');
  
  // Test start-chat endpoint
  const startChatResponse = await makeRequest(`${BACKEND_URL}/api/start-chat`, {
    method: 'POST',
    body: JSON.stringify(testData)
  });
  
  assert(startChatResponse.ok, `Backend start-chat failed: ${startChatResponse.error}`);
  assert(startChatResponse.data.success, 'Backend start-chat response missing success flag');
  assert(startChatResponse.data.sessionId, 'Backend start-chat response missing sessionId');
  assert(startChatResponse.data.explanation, 'Backend start-chat response missing explanation');
  
  console.log('✅ Backend start-chat endpoint working');
  
  // Test chat continuation
  const chatResponse = await makeRequest(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    body: JSON.stringify({
      sessionId: startChatResponse.data.sessionId,
      message: "What about performance?"
    })
  });
  
  assert(chatResponse.ok, `Backend chat failed: ${chatResponse.error}`);
  assert(chatResponse.data.success, 'Backend chat response missing success flag');
  assert(chatResponse.data.response, 'Backend chat response missing response');
  
  console.log('✅ Backend chat continuation endpoint working');
  
  return startChatResponse.data.sessionId;
}

/**
 * Test the frontend proxy
 */
async function testFrontendProxy() {
  console.log('\n🌐 Testing Frontend Proxy Connection...');
  
  // Test start-chat through proxy
  const startChatResponse = await makeRequest(`${FRONTEND_URL}/api/start-chat`, {
    method: 'POST',
    body: JSON.stringify(testData)
  });
  
  assert(startChatResponse.ok, `Frontend proxy start-chat failed: ${startChatResponse.error}`);
  assert(startChatResponse.data.success, 'Frontend proxy start-chat response missing success flag');
  assert(startChatResponse.data.sessionId, 'Frontend proxy start-chat response missing sessionId');
  assert(startChatResponse.data.explanation, 'Frontend proxy start-chat response missing explanation');
  
  console.log('✅ Frontend proxy start-chat endpoint working');
  
  // Test chat continuation through proxy
  const chatResponse = await makeRequest(`${FRONTEND_URL}/api/chat`, {
    method: 'POST',
    body: JSON.stringify({
      sessionId: startChatResponse.data.sessionId,
      message: "Can you suggest alternatives?"
    })
  });
  
  assert(chatResponse.ok, `Frontend proxy chat failed: ${chatResponse.error}`);
  assert(chatResponse.data.success, 'Frontend proxy chat response missing success flag');
  assert(chatResponse.data.response, 'Frontend proxy chat response missing response');
  
  console.log('✅ Frontend proxy chat continuation endpoint working');
  
  return startChatResponse.data.sessionId;
}

/**
 * Test the legacy explain-line endpoint for comparison
 */
async function testLegacyExplainLine() {
  console.log('\n📝 Testing Legacy Explain Line Endpoint...');
  
  const response = await makeRequest(`${FRONTEND_URL}/api/explain-line`, {
    method: 'POST',
    body: JSON.stringify(testData)
  });
  
  assert(response.ok, `Legacy explain-line failed: ${response.error}`);
  assert(response.data.success, 'Legacy explain-line response missing success flag');
  assert(response.data.explanation, 'Legacy explain-line response missing explanation');
  
  console.log('✅ Legacy explain-line endpoint working');
}

/**
 * Test session retrieval
 */
async function testSessionRetrieval(sessionId) {
  console.log('\n📚 Testing Session Retrieval...');
  
  const response = await makeRequest(`${FRONTEND_URL}/api/chat/${sessionId}`, {
    method: 'GET'
  });
  
  assert(response.ok, `Session retrieval failed: ${response.error}`);
  assert(response.data.success, 'Session retrieval response missing success flag');
  assert(response.data.messages, 'Session retrieval response missing messages');
  assert(Array.isArray(response.data.messages), 'Session messages should be an array');
  
  console.log('✅ Session retrieval endpoint working');
  console.log(`   📋 Session has ${response.data.messages.length} messages`);
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 AI Code Review Chat API Fix Test Suite');
  console.log('==========================================');
  
  try {
    // Test backend direct connection
    const backendSessionId = await testBackendDirect();
    
    // Test frontend proxy
    const frontendSessionId = await testFrontendProxy();
    
    // Test legacy endpoint
    await testLegacyExplainLine();
    
    // Test session retrieval
    await testSessionRetrieval(frontendSessionId);
    
    console.log('\n🎉 All tests passed! The AI Chat feature is working correctly.');
    console.log('\n📋 Summary:');
    console.log('   ✅ Backend API endpoints accessible');
    console.log('   ✅ Frontend proxy correctly forwards requests');
    console.log('   ✅ Chat session creation and continuation working');
    console.log('   ✅ Session persistence and retrieval working');
    console.log('   ✅ Legacy explain-line endpoint still functional');
    
    console.log('\n🔧 Fix Details:');
    console.log('   • Updated Vite proxy configuration for flexibility');
    console.log('   • Added port conflict resolution in npm scripts');
    console.log('   • Modified standalone server for strict port handling');
    console.log('   • Frontend and backend now coordinate on fixed ports');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\n🔍 Troubleshooting:');
    console.log('   1. Make sure both servers are running: npm run dev');
    console.log('   2. Check frontend is on http://localhost:5960');
    console.log('   3. Check backend is on http://localhost:5959');
    console.log('   4. Verify no other services are using these ports');
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}