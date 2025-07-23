#!/bin/bash

# Test script to demonstrate auto-init functionality

echo "=== AI Code Review Auto-Init Test ==="
echo

# Remove existing config
echo "1. Removing existing config..."
rm -f ~/.aicodereview/config.json
echo "✓ Config removed"
echo

# Check that no config exists
echo "2. Verifying no config exists..."
if [ -f ~/.aicodereview/config.json ]; then
    echo "❌ Config still exists!"
    exit 1
else
    echo "✓ No config found"
fi
echo

# Show what happens when we run aicodereview without config
echo "3. Running aicodereview command (will trigger auto-init)..."
echo "   Note: This will start the setup wizard automatically"
echo "   You can press Ctrl+C to cancel if needed"
echo

# Run the CLI - it should detect no config and run init
cd /Users/hainan.zhao/projects/gemini-code-reviewer
node bin/cli.js --provider gemini-cli --google-cloud-project test-project --no-open
