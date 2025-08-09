import { describe, test, expect } from 'vitest';
import { detectLanguageFromPath, isLanguageSupported, getSupportedLanguages } from './languageDetection';

describe('Language Detection', () => {
  test('detects TypeScript files', () => {
    expect(detectLanguageFromPath('src/components/App.tsx')).toBe('tsx');
    expect(detectLanguageFromPath('src/utils/helper.ts')).toBe('typescript');
  });

  test('detects JavaScript files', () => {
    expect(detectLanguageFromPath('src/app.js')).toBe('javascript');
    expect(detectLanguageFromPath('src/components/App.jsx')).toBe('jsx');
  });

  test('detects Python files', () => {
    expect(detectLanguageFromPath('scripts/main.py')).toBe('python');
    expect(detectLanguageFromPath('test.py3')).toBe('python');
  });

  test('detects C++ files', () => {
    expect(detectLanguageFromPath('src/main.cpp')).toBe('cpp');
    expect(detectLanguageFromPath('include/header.hpp')).toBe('cpp');
    expect(detectLanguageFromPath('legacy.c')).toBe('c');
  });

  test('detects Rust files', () => {
    expect(detectLanguageFromPath('src/main.rs')).toBe('rust');
  });

  test('detects HTML files', () => {
    expect(detectLanguageFromPath('index.html')).toBe('html');
    expect(detectLanguageFromPath('template.htm')).toBe('html');
  });

  test('detects CSS files', () => {
    expect(detectLanguageFromPath('styles.css')).toBe('css');
    expect(detectLanguageFromPath('styles.scss')).toBe('scss');
  });

  test('detects special files', () => {
    expect(detectLanguageFromPath('Dockerfile')).toBe('dockerfile');
    expect(detectLanguageFromPath('docker/Dockerfile')).toBe('dockerfile');
    expect(detectLanguageFromPath('Makefile')).toBe('makefile');
  });

  test('returns null for unsupported files', () => {
    expect(detectLanguageFromPath('README.txt')).toBe(null);
    expect(detectLanguageFromPath('binary.exe')).toBe(null);
    expect(detectLanguageFromPath('')).toBe(null);
  });

  test('case insensitive detection', () => {
    expect(detectLanguageFromPath('MAIN.PY')).toBe('python');
    expect(detectLanguageFromPath('App.JS')).toBe('javascript');
  });

  test('isLanguageSupported works correctly', () => {
    expect(isLanguageSupported('python')).toBe(true);
    expect(isLanguageSupported('typescript')).toBe(true);
    expect(isLanguageSupported('unknown')).toBe(false);
    expect(isLanguageSupported(null)).toBe(false);
  });

  test('getSupportedLanguages returns array', () => {
    const languages = getSupportedLanguages();
    expect(Array.isArray(languages)).toBe(true);
    expect(languages.length).toBeGreaterThan(0);
    expect(languages).toContain('python');
    expect(languages).toContain('typescript');
    expect(languages).toContain('rust');
  });
});