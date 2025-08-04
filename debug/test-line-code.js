// Debug script to test line_code generation
import crypto from 'crypto';

const generateLineCode = (filePath, oldLine, newLine) => {
  const fileSha = crypto.createHash('sha1').update(filePath).digest('hex');
  return `${fileSha}_${oldLine}_${newLine}`;
};

// Test with the example from GitLab UI
const testFilePath = 'src/app/fill-transfer/constants.ts';
const testOldLine = 194;
const testNewLine = 194;

const generated = generateLineCode(testFilePath, testOldLine, testNewLine);
const expected = '6ba4765c10b48d078089e6880ce9ff8f3d2011d6_194_194';

console.log('Generated:', generated);
console.log('Expected: ', expected);
console.log('Match:', generated === expected);

// Test the actual SHA generation
const fileSha = crypto.createHash('sha1').update(testFilePath).digest('hex');
console.log('File SHA:', fileSha);
console.log('Expected SHA: 6ba4765c10b48d078089e6880ce9ff8f3d2011d6');
console.log('SHA Match:', fileSha === '6ba4765c10b48d078089e6880ce9ff8f3d2011d6');
