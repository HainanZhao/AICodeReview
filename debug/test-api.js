// Test script for debugging the AI Code Review API
import fetch from 'node-fetch';

const API_URL = 'http://localhost:5959';

async function testAPI() {
  try {
    console.log('🧪 Testing AI Code Review API...');

    // Test health endpoint
    console.log('\n1. Testing health endpoint...');
    const healthResponse = await fetch(`${API_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('Health check:', healthData);

    // Test review endpoint with a sample MR
    console.log('\n2. Testing review endpoint...');
    const mrUrl = 'https://gitlab.com/test/project/module/-/merge_requests/123';

    const reviewResponse = await fetch(`${API_URL}/api/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mrUrl: mrUrl,
        aiProvider: 'gemini',
        diffFormat: 'unified',
      }),
    });

    if (reviewResponse.ok) {
      const reviewData = await reviewResponse.json();
      console.log('Review response:', JSON.stringify(reviewData, null, 2));
    } else {
      console.error('Review failed:', reviewResponse.status, reviewResponse.statusText);
      const errorText = await reviewResponse.text();
      console.error('Error details:', errorText);
    }
  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

// Run the test
testAPI();
