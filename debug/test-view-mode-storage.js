// Test script for localStorage functionality
// Run this in the browser console to test localStorage persistence

console.log('Testing AI Code Review View Mode localStorage functionality...');

// Test the storage utility functions
const testViewModeStorage = () => {
  // Import the utility functions (this will only work if the module is available)
  // For manual testing, we'll test the localStorage directly

  const STORAGE_KEY = 'aicodereview-view-mode';

  console.log('1. Testing initial state...');
  const initialValue = localStorage.getItem(STORAGE_KEY);
  console.log('Initial localStorage value:', initialValue);

  console.log('2. Testing setting to "split"...');
  localStorage.setItem(STORAGE_KEY, 'split');
  const splitValue = localStorage.getItem(STORAGE_KEY);
  console.log('After setting to split:', splitValue);

  console.log('3. Testing setting to "inline"...');
  localStorage.setItem(STORAGE_KEY, 'inline');
  const inlineValue = localStorage.getItem(STORAGE_KEY);
  console.log('After setting to inline:', inlineValue);

  console.log('4. Clearing storage...');
  localStorage.removeItem(STORAGE_KEY);
  const clearedValue = localStorage.getItem(STORAGE_KEY);
  console.log('After clearing:', clearedValue);

  console.log('Test completed! The view mode should persist across page reloads.');
  console.log('To test:');
  console.log('1. Switch to split view using the toggle button');
  console.log('2. Reload the page');
  console.log('3. The split view should be preserved');
};

testViewModeStorage();
