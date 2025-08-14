import React from 'react';
import { SyntaxHighlightedCode } from './SyntaxHighlightedCode';

const testCodeSamples = [
  {
    language: 'TypeScript',
    filePath: 'example.tsx',
    code: `interface User {
  id: number;
  name: string;
  email?: string;
}

const createUser = (data: Partial<User>): User => {
  return {
    id: Date.now(),
    name: data.name || 'Anonymous',
    ...data
  };
};`,
  },
  {
    language: 'Python',
    filePath: 'example.py',
    code: `def fibonacci(n: int) -> int:
    """Calculate the nth Fibonacci number."""
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

class DataProcessor:
    def __init__(self, data: list):
        self.data = data
    
    def process(self) -> dict:
        return {"processed": True, "count": len(self.data)}`,
  },
  {
    language: 'Rust',
    filePath: 'example.rs',
    code: `use std::collections::HashMap;

#[derive(Debug)]
struct User {
    id: u32,
    name: String,
    email: Option<String>,
}

impl User {
    fn new(id: u32, name: String) -> Self {
        Self { id, name, email: None }
    }
}

fn main() {
    let mut users = HashMap::new();
    users.insert(1, User::new(1, "Alice".to_string()));
    println!("{:?}", users);
}`,
  },
  {
    language: 'C++',
    filePath: 'example.cpp',
    code: `#include <iostream>
#include <vector>
#include <memory>

class Shape {
public:
    virtual ~Shape() = default;
    virtual double area() const = 0;
};

class Circle : public Shape {
private:
    double radius_;
public:
    Circle(double r) : radius_(r) {}
    double area() const override {
        return 3.14159 * radius_ * radius_;
    }
};

int main() {
    auto circle = std::make_unique<Circle>(5.0);
    std::cout << "Area: " << circle->area() << std::endl;
    return 0;
}`,
  },
  {
    language: 'HTML',
    filePath: 'example.html',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Syntax Highlighting Demo</title>
    <style>
        .container { max-width: 800px; margin: 0 auto; }
        .highlight { background-color: #f0f8ff; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to Code Review</h1>
        <p class="highlight">Syntax highlighting enabled!</p>
    </div>
</body>
</html>`,
  },
];

interface SyntaxHighlightingDemoProps {
  isDarkMode?: boolean;
}

export const SyntaxHighlightingDemo: React.FC<SyntaxHighlightingDemoProps> = ({
  isDarkMode = false,
}) => {
  return (
    <div className="p-6 space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          Syntax Highlighting Demo
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Code syntax highlighting now works for TypeScript, Python, Rust, C++, HTML and more!
        </p>
      </div>

      {testCodeSamples.map((sample, index) => (
        <div
          key={index}
          className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden"
        >
          <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-gray-800 dark:text-white">
                {sample.filePath}
              </span>
              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                {sample.language}
              </span>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-4 overflow-x-auto">
            <pre className="font-mono text-sm text-left" style={{ textAlign: 'left' }}>
              <SyntaxHighlightedCode
                code={sample.code}
                filePath={sample.filePath}
                isDarkMode={isDarkMode}
                className="whitespace-pre-wrap"
              />
            </pre>
          </div>
        </div>
      ))}

      <div className="mt-8 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
          ✅ Syntax Highlighting Features
        </h3>
        <ul className="space-y-1 text-sm text-green-700 dark:text-green-300">
          <li>• Automatic language detection from file extensions</li>
          <li>• Support for TypeScript, JavaScript, Python, Rust, C++, HTML, CSS, and more</li>
          <li>• Dark and light theme support</li>
          <li>• Seamless integration with diff view</li>
          <li>• Preserves existing diff styling for add/remove/context lines</li>
        </ul>
      </div>
    </div>
  );
};
