export class MockLLMProvider {
  static async explainLine(
    lineContent: string,
    filePath: string,
    fileContent?: string,
    contextLines: number = 5,
    lineNumber?: number
  ): Promise<string> {
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate a mock explanation based on the line content
    if (lineContent.includes('map')) {
      return `This line uses the \`map\` method to transform each element in the array. The \`map\` function creates a new array by applying the provided function (x => x * 2) to every element in the original array. In this case, it's doubling each value.

Key points:
- \`map\` doesn't modify the original array
- It returns a new array with the same length
- The callback function (x => x * 2) is executed for each element`;
    }
    
    if (lineContent.includes('function') || lineContent.includes('=>')) {
      return `This appears to be a function definition. Functions are fundamental building blocks in JavaScript that encapsulate reusable code logic.

Key characteristics:
- Functions can accept parameters
- They can return values
- They create their own scope
- They can be called multiple times`;
    }
    
    if (lineContent.includes('const') || lineContent.includes('let') || lineContent.includes('var')) {
      return `This is a variable declaration. Variables store data that can be referenced and manipulated later in your program.

About this declaration:
- Uses modern JavaScript syntax
- The variable stores the result of the expression
- Scope depends on the declaration keyword used`;
    }
    
    return `This line of code in \`${filePath}\` performs a specific operation. Based on the syntax, it appears to be JavaScript/TypeScript code that contributes to the overall functionality of the program.

To better understand this code:
- Consider the context of surrounding lines
- Look at how this fits into the larger function or method
- Check if there are any dependencies or imports related to this code`;
  }

  static async generateChatResponse(
    conversationHistory: string,
    userMessage: string,
    lineContent: string,
    filePath: string
  ): Promise<string> {
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('explain') || lowerMessage.includes('what')) {
      return `Let me provide more details about this code. ${lineContent.includes('map') ? 'The map method is particularly useful for data transformation operations.' : 'This code snippet serves a specific purpose in the application flow.'} Feel free to ask more specific questions!`;
    }
    
    if (lowerMessage.includes('performance') || lowerMessage.includes('optimize')) {
      return `From a performance perspective, this code looks reasonable. ${lineContent.includes('map') ? 'The map operation is generally efficient, but for very large arrays, you might consider alternatives like for loops if maximum performance is needed.' : 'Consider whether this operation needs to be optimized based on your use case.'}`;
    }
    
    if (lowerMessage.includes('alternative') || lowerMessage.includes('different')) {
      return `There are several ways you could approach this differently:
1. Using different JavaScript methods
2. Breaking it into smaller functions
3. Adding error handling
4. Using TypeScript for better type safety

Which aspect would you like me to elaborate on?`;
    }
    
    if (lowerMessage.includes('error') || lowerMessage.includes('bug')) {
      return `I don't see any obvious errors in this code, but here are some potential issues to watch for:
- Null/undefined values
- Type mismatches
- Scope issues
- Async operation handling

Is there a specific error you're encountering?`;
    }
    
    if (lowerMessage.includes('test') || lowerMessage.includes('testing')) {
      return `For testing this code, you could:
1. Write unit tests with sample data
2. Test edge cases (empty arrays, null values)
3. Verify the expected output
4. Mock any dependencies

Would you like me to suggest specific test cases?`;
    }
    
    // Default response
    return `That's a great question! Based on the context of "${lineContent}" in ${filePath}, I can help you understand this better. Could you be more specific about what aspect you'd like me to explain?`;
  }
}