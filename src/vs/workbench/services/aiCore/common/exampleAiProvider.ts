/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IAiCoreService, IAiProvider, ICodeCompletionProvider, IChatProvider, ICodeEditProvider, AiContext, AiCompletionResult, AiChatResponse, AiCodeEditRequest, AiCodeEditResult, AiCompletion, AiCompletionKind } from './aiCoreService.js';
import { IRange, Range } from '../../../../editor/common/core/range.js';

/**
 * Example AI Provider that demonstrates how to implement custom AI providers.
 * This provider shows basic implementations of code completion, chat, and code editing.
 */
export class ExampleAiProvider extends Disposable implements IAiProvider, ICodeCompletionProvider, IChatProvider, ICodeEditProvider {
	readonly id = 'example-ai-provider';
	readonly name = 'Example AI Provider';
	readonly capabilities = ['codeCompletion', 'chat', 'codeEdit'] as const;

	constructor(
		@IAiCoreService private readonly aiCoreService: IAiCoreService,
		@ILogService private readonly logService: ILogService
	) {
		super();

		// Register this provider with the AI Core Service
		this._register(this.aiCoreService.registerCodeCompletionProvider(this));
		this._register(this.aiCoreService.registerChatProvider(this));
		this._register(this.aiCoreService.registerCodeEditProvider(this));

		this.logService.trace('[ExampleAiProvider] Provider registered');
	}

	async initialize(): Promise<void> {
		this.logService.trace('[ExampleAiProvider] Initializing provider');
		// Initialize any resources, load models, etc.
	}

	dispose(): void {
		this.logService.trace('[ExampleAiProvider] Disposing provider');
		super.dispose();
	}

	// Code Completion Implementation
	async provideCompletion(query: string, context: AiContext, token: CancellationToken): Promise<AiCompletionResult> {
		this.logService.trace('[ExampleAiProvider] Providing completion for query:', query);

		const completions: AiCompletion[] = [];

		// Simple completion logic based on query
		if (query.includes('function')) {
			completions.push({
				text: 'function example() {\n\t// TODO: Implement function\n}',
				range: new Range(1, 1, 1, 1),
				kind: AiCompletionKind.Function,
				score: 0.9,
				metadata: { provider: this.id }
			});
		}

		if (query.includes('class')) {
			completions.push({
				text: 'class ExampleClass {\n\tconstructor() {\n\t\t// TODO: Initialize class\n\t}\n}',
				range: new Range(1, 1, 1, 1),
				kind: AiCompletionKind.Class,
				score: 0.8,
				metadata: { provider: this.id }
			});
		}

		if (query.includes('import')) {
			completions.push({
				text: 'import { Component } from \'react\';',
				range: new Range(1, 1, 1, 1),
				kind: AiCompletionKind.Import,
				score: 0.7,
				metadata: { provider: this.id }
			});
		}

		// Add some generic completions
		completions.push({
			text: 'console.log("Hello, World!");',
			range: new Range(1, 1, 1, 1),
			kind: AiCompletionKind.Snippet,
			score: 0.5,
			metadata: { provider: this.id }
		});

		return {
			completions,
			metadata: {
				provider: this.id,
				query,
				timestamp: Date.now()
			}
		};
	}

	// Chat Implementation
	async provideChatResponse(message: string, context: AiContext, token: CancellationToken): Promise<AiChatResponse> {
		this.logService.trace('[ExampleAiProvider] Providing chat response for message:', message);

		let response = '';

		// Simple chat logic based on message content
		if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
			response = 'Hello! I\'m the Example AI Provider. How can I help you with your code today?';
		} else if (message.toLowerCase().includes('explain') || message.toLowerCase().includes('what')) {
			response = 'I can help explain code concepts, suggest improvements, and assist with various programming tasks. What would you like to know?';
		} else if (message.toLowerCase().includes('bug') || message.toLowerCase().includes('error')) {
			response = 'I can help you identify and fix bugs in your code. Please share the code you\'re having trouble with and any error messages you\'re seeing.';
		} else if (message.toLowerCase().includes('test')) {
			response = 'I can help you generate tests for your code. Just select the code you want to test and I\'ll create comprehensive test cases.';
		} else {
			response = 'I\'m here to help with your coding tasks! You can ask me to explain code, suggest improvements, fix bugs, generate tests, and much more.';
		}

		return {
			message: response,
			codeBlocks: [],
			suggestions: [
				'Try asking me to explain some code',
				'Ask me to help fix a bug',
				'Request test generation for your code',
				'Ask for code refactoring suggestions'
			],
			metadata: {
				provider: this.id,
				message,
				timestamp: Date.now()
			}
		};
	}

	// Code Edit Implementation
	async provideCodeEdit(request: AiCodeEditRequest, token: CancellationToken): Promise<AiCodeEditResult> {
		this.logService.trace('[ExampleAiProvider] Providing code edit for instruction:', request.instruction);

		const edits = [];

		// Simple code edit logic based on instruction
		if (request.instruction.toLowerCase().includes('add comment')) {
			edits.push({
				range: request.range,
				text: '// TODO: Add implementation here\n',
				kind: 'insert'
			});
		} else if (request.instruction.toLowerCase().includes('fix')) {
			edits.push({
				range: request.range,
				text: '// Fixed: ' + request.instruction + '\n',
				kind: 'replace'
			});
		} else if (request.instruction.toLowerCase().includes('improve')) {
			edits.push({
				range: request.range,
				text: '// Improved: ' + request.instruction + '\n',
				kind: 'replace'
			});
		} else {
			// Default edit
			edits.push({
				range: request.range,
				text: '// Edited: ' + request.instruction + '\n',
				kind: 'replace'
			});
		}

		return {
			edits,
			explanation: `Applied edit based on instruction: "${request.instruction}"`,
			metadata: {
				provider: this.id,
				instruction: request.instruction,
				timestamp: Date.now()
			}
		};
	}
}

/**
 * Advanced AI Provider with more sophisticated features
 */
export class AdvancedAiProvider extends Disposable implements IAiProvider, ICodeCompletionProvider, IChatProvider, ICodeEditProvider {
	readonly id = 'advanced-ai-provider';
	readonly name = 'Advanced AI Provider';
	readonly capabilities = ['codeCompletion', 'chat', 'codeEdit'] as const;

	private readonly languagePatterns = new Map<string, RegExp[]>();
	private readonly codeTemplates = new Map<string, string[]>();

	constructor(
		@IAiCoreService private readonly aiCoreService: IAiCoreService,
		@ILogService private readonly logService: ILogService
	) {
		super();

		this.initializePatterns();
		this.initializeTemplates();

		// Register this provider with the AI Core Service
		this._register(this.aiCoreService.registerCodeCompletionProvider(this));
		this._register(this.aiCoreService.registerChatProvider(this));
		this._register(this.aiCoreService.registerCodeEditProvider(this));

		this.logService.trace('[AdvancedAiProvider] Provider registered');
	}

	private initializePatterns(): void {
		// JavaScript/TypeScript patterns
		this.languagePatterns.set('javascript', [
			/\bfunction\s+\w+\s*\(/,
			/\bclass\s+\w+/,
			/\bconst\s+\w+\s*=/,
			/\blet\s+\w+\s*=/,
			/\bvar\s+\w+\s*=/,
			/\bimport\s+.*\s+from/,
			/\bexport\s+/,
			/\breturn\s+/,
			/\bif\s*\(/,
			/\bfor\s*\(/,
			/\bwhile\s*\(/,
			/\btry\s*{/,
			/\bcatch\s*\(/,
			/\bfinally\s*{/
		]);

		// Python patterns
		this.languagePatterns.set('python', [
			/\bdef\s+\w+\s*\(/,
			/\bclass\s+\w+/,
			/\bimport\s+/,
			/\bfrom\s+.*\s+import/,
			/\bif\s+.*:/,
			/\bfor\s+.*\s+in/,
			/\bwhile\s+.*:/,
			/\btry:/,
			/\bexcept\s+.*:/,
			/\bfinally:/,
			/\breturn\s+/
		]);
	}

	private initializeTemplates(): void {
		// JavaScript templates
		this.codeTemplates.set('javascript', [
			'function example() {\n\t// TODO: Implement function\n\treturn null;\n}',
			'class ExampleClass {\n\tconstructor() {\n\t\t// TODO: Initialize class\n\t}\n}',
			'const example = () => {\n\t// TODO: Implement arrow function\n};',
			'import { Component } from \'react\';\n\nclass MyComponent extends Component {\n\trender() {\n\t\treturn <div>Hello World</div>;\n\t}\n}',
			'try {\n\t// TODO: Add try block\n} catch (error) {\n\tconsole.error(error);\n}',
			'if (condition) {\n\t// TODO: Add if block\n} else {\n\t// TODO: Add else block\n}'
		]);

		// Python templates
		this.codeTemplates.set('python', [
			'def example():\n\t"""TODO: Add docstring"""\n\tpass',
			'class ExampleClass:\n\tdef __init__(self):\n\t\t"""TODO: Initialize class"""\n\t\tpass',
			'import os\nimport sys\n\n# TODO: Add imports and implementation',
			'try:\n\t# TODO: Add try block\n\tpass\nexcept Exception as e:\n\tprint(f"Error: {e}")',
			'if condition:\n\t# TODO: Add if block\n\tpass\nelse:\n\t# TODO: Add else block\n\tpass',
			'for item in items:\n\t# TODO: Add for loop implementation\n\tpass'
		]);
	}

	async initialize(): Promise<void> {
		this.logService.trace('[AdvancedAiProvider] Initializing provider');
		// Load models, initialize AI services, etc.
	}

	dispose(): void {
		this.logService.trace('[AdvancedAiProvider] Disposing provider');
		super.dispose();
	}

	async provideCompletion(query: string, context: AiContext, token: CancellationToken): Promise<AiCompletionResult> {
		this.logService.trace('[AdvancedAiProvider] Providing completion for query:', query);

		const completions: AiCompletion[] = [];
		const language = context.language || 'javascript';
		const templates = this.codeTemplates.get(language) || [];

		// Generate completions based on language and query
		for (const template of templates) {
			if (this.matchesQuery(template, query)) {
				completions.push({
					text: template,
					range: new Range(1, 1, 1, 1),
					kind: this.getCompletionKind(template),
					score: this.calculateScore(template, query),
					metadata: { 
						provider: this.id,
						language,
						template: true
					}
				});
			}
		}

		// Add context-aware completions
		if (context.file) {
			const fileCompletions = this.generateFileSpecificCompletions(context.file, query);
			completions.push(...fileCompletions);
		}

		return {
			completions,
			metadata: {
				provider: this.id,
				language,
				query,
				timestamp: Date.now()
			}
		};
	}

	async provideChatResponse(message: string, context: AiContext, token: CancellationToken): Promise<AiChatResponse> {
		this.logService.trace('[AdvancedAiProvider] Providing chat response for message:', message);

		let response = '';
		const suggestions: string[] = [];

		// Analyze message intent and provide appropriate response
		if (this.isGreeting(message)) {
			response = 'Hello! I\'m the Advanced AI Provider. I can help you with code completion, refactoring, debugging, and much more. What would you like to work on?';
			suggestions.push('Ask me to explain some code', 'Request code improvements', 'Ask for debugging help');
		} else if (this.isCodeQuestion(message)) {
			response = 'I can help you understand and improve your code. Please share the specific code you\'d like me to look at, and I\'ll provide detailed explanations and suggestions.';
			suggestions.push('Share code for explanation', 'Ask for optimization tips', 'Request refactoring suggestions');
		} else if (this.isDebuggingRequest(message)) {
			response = 'I can help you debug your code. Please share the problematic code and any error messages you\'re seeing, and I\'ll help identify and fix the issues.';
			suggestions.push('Share error messages', 'Show problematic code', 'Ask for debugging strategies');
		} else {
			response = 'I\'m here to help with your coding tasks! I can assist with code explanation, refactoring, debugging, testing, and optimization. Just let me know what you need help with.';
			suggestions.push('Code explanation', 'Refactoring help', 'Debugging assistance', 'Test generation');
		}

		return {
			message: response,
			codeBlocks: [],
			suggestions,
			metadata: {
				provider: this.id,
				message,
				timestamp: Date.now()
			}
		};
	}

	async provideCodeEdit(request: AiCodeEditRequest, token: CancellationToken): Promise<AiCodeEditResult> {
		this.logService.trace('[AdvancedAiProvider] Providing code edit for instruction:', request.instruction);

		const edits = [];
		const instruction = request.instruction.toLowerCase();

		// Analyze instruction and generate appropriate edits
		if (instruction.includes('add comment') || instruction.includes('document')) {
			edits.push({
				range: request.range,
				text: this.generateComment(request.context.language || 'javascript'),
				kind: 'insert'
			});
		} else if (instruction.includes('fix') || instruction.includes('bug')) {
			edits.push({
				range: request.range,
				text: this.generateBugFix(request.context.language || 'javascript'),
				kind: 'replace'
			});
		} else if (instruction.includes('optimize') || instruction.includes('improve')) {
			edits.push({
				range: request.range,
				text: this.generateOptimization(request.context.language || 'javascript'),
				kind: 'replace'
			});
		} else if (instruction.includes('refactor')) {
			edits.push({
				range: request.range,
				text: this.generateRefactoring(request.context.language || 'javascript'),
				kind: 'replace'
			});
		} else {
			// Default edit
			edits.push({
				range: request.range,
				text: `// ${request.instruction}\n`,
				kind: 'insert'
			});
		}

		return {
			edits,
			explanation: `Applied advanced edit based on instruction: "${request.instruction}"`,
			metadata: {
				provider: this.id,
				instruction: request.instruction,
				language: request.context.language,
				timestamp: Date.now()
			}
		};
	}

	private matchesQuery(template: string, query: string): boolean {
		const queryLower = query.toLowerCase();
		const templateLower = template.toLowerCase();
		
		// Check if template contains query keywords
		const keywords = queryLower.split(/\s+/);
		return keywords.some(keyword => templateLower.includes(keyword));
	}

	private getCompletionKind(template: string): AiCompletionKind {
		if (template.includes('function') || template.includes('def ')) {
			return AiCompletionKind.Function;
		} else if (template.includes('class ')) {
			return AiCompletionKind.Class;
		} else if (template.includes('import ')) {
			return AiCompletionKind.Import;
		} else if (template.includes('const ') || template.includes('let ') || template.includes('var ')) {
			return AiCompletionKind.Variable;
		} else {
			return AiCompletionKind.Snippet;
		}
	}

	private calculateScore(template: string, query: string): number {
		let score = 0.5; // Base score

		// Increase score for better matches
		const queryLower = query.toLowerCase();
		const templateLower = template.toLowerCase();

		if (templateLower.includes(queryLower)) {
			score += 0.3;
		}

		// Prefer functions and classes
		if (template.includes('function') || template.includes('class') || template.includes('def ')) {
			score += 0.2;
		}

		return Math.min(score, 1.0);
	}

	private generateFileSpecificCompletions(fileContext: any, query: string): AiCompletion[] {
		const completions: AiCompletion[] = [];

		// Generate completions based on file structure
		if (fileContext.structure) {
			for (const func of fileContext.structure.functions || []) {
				completions.push({
					text: `// Call to ${func.name}\n${func.name}();`,
					range: new Range(1, 1, 1, 1),
					kind: AiCompletionKind.Function,
					score: 0.7,
					metadata: { 
						provider: this.id,
						fileSpecific: true,
						functionName: func.name
					}
				});
			}
		}

		return completions;
	}

	private isGreeting(message: string): boolean {
		const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
		return greetings.some(greeting => message.toLowerCase().includes(greeting));
	}

	private isCodeQuestion(message: string): boolean {
		const codeKeywords = ['explain', 'what', 'how', 'why', 'code', 'function', 'class', 'method'];
		return codeKeywords.some(keyword => message.toLowerCase().includes(keyword));
	}

	private isDebuggingRequest(message: string): boolean {
		const debugKeywords = ['bug', 'error', 'fix', 'debug', 'problem', 'issue', 'broken'];
		return debugKeywords.some(keyword => message.toLowerCase().includes(keyword));
	}

	private generateComment(language: string): string {
		if (language === 'python') {
			return '# TODO: Add implementation\n';
		} else {
			return '// TODO: Add implementation\n';
		}
	}

	private generateBugFix(language: string): string {
		if (language === 'python') {
			return '# Fixed: Bug resolved\n';
		} else {
			return '// Fixed: Bug resolved\n';
		}
	}

	private generateOptimization(language: string): string {
		if (language === 'python') {
			return '# Optimized: Performance improved\n';
		} else {
			return '// Optimized: Performance improved\n';
		}
	}

	private generateRefactoring(language: string): string {
		if (language === 'python') {
			return '# Refactored: Code improved\n';
		} else {
			return '// Refactored: Code improved\n';
		}
	}
}