/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IRange } from '../../../../editor/common/core/range.js';
import { IAiCoreService, AiContext, AiChatResponse, AiCodeEditRequest, AiCodeEditResult } from '../aiCore/common/aiCoreService.js';
import { StopWatch } from '../../../../base/common/stopwatch.js';

// =============================================================================
// Service Interface
// =============================================================================

export const IAiAssistantService = createDecorator<IAiAssistantService>('IAiAssistantService');

export interface IAiAssistantService {
	readonly _serviceBrand: undefined;

	// High-level AI operations
	explainCode(code: string, context?: string): Promise<string>;
	refactorCode(code: string, instruction: string): Promise<string>;
	fixBug(code: string, error?: string): Promise<string>;
	generateTests(code: string, framework?: string): Promise<string>;
	generateDocumentation(code: string, type?: string): Promise<string>;
	reviewCode(code: string): Promise<AiCodeReviewResult>;
	optimizePerformance(code: string): Promise<AiPerformanceResult>;
	analyzeSecurity(code: string): Promise<AiSecurityResult>;

	// Chat functionality
	chat(message: string, context?: AiContext): Promise<AiChatResponse>;
	chatWithFile(message: string, fileUri: URI): Promise<AiChatResponse>;
	chatWithSelection(message: string, fileUri: URI, range: IRange): Promise<AiChatResponse>;

	// Code editing
	editCode(request: AiAssistantEditRequest): Promise<AiCodeEditResult>;
	insertCode(code: string, position: string, context?: string): Promise<string>;
	replaceCode(oldCode: string, newCode: string, context?: string): Promise<string>;

	// Context management
	getCurrentContext(): Promise<AiContext>;
	setContext(context: Partial<AiContext>): void;
	clearContext(): void;

	// Events
	readonly onAssistantResponse: Event<AiAssistantResponseEvent>;
	readonly onAssistantError: Event<AiAssistantErrorEvent>;
	readonly onContextUpdated: Event<AiContextUpdateEvent>;
}

// =============================================================================
// Request and Result Interfaces
// =============================================================================

export interface AiAssistantEditRequest {
	instruction: string;
	fileUri?: URI;
	range?: IRange;
	context?: string;
	options?: AiAssistantEditOptions;
}

export interface AiAssistantEditOptions {
	preserveFormatting?: boolean;
	includeComments?: boolean;
	style?: 'conservative' | 'aggressive' | 'creative';
	language?: string;
	framework?: string;
}

export interface AiCodeReviewResult {
	score: number;
	issues: AiReviewIssue[];
	suggestions: AiReviewSuggestion[];
	summary: string;
}

export interface AiReviewIssue {
	severity: 'error' | 'warning' | 'info';
	message: string;
	line?: number;
	suggestion?: string;
}

export interface AiReviewSuggestion {
	message: string;
	priority: 'high' | 'medium' | 'low';
	impact: string;
}

export interface AiPerformanceResult {
	score: number;
	issues: AiPerformanceIssue[];
	optimizations: AiPerformanceOptimization[];
	summary: string;
}

export interface AiPerformanceIssue {
	severity: 'critical' | 'high' | 'medium' | 'low';
	message: string;
	line?: number;
	impact: string;
	suggestion: string;
}

export interface AiPerformanceOptimization {
	description: string;
	implementation: string;
	expectedImprovement: string;
}

export interface AiSecurityResult {
	score: number;
	vulnerabilities: AiSecurityVulnerability[];
	recommendations: AiSecurityRecommendation[];
	summary: string;
}

export interface AiSecurityVulnerability {
	severity: 'critical' | 'high' | 'medium' | 'low';
	type: string;
	description: string;
	line?: number;
	cve?: string;
	mitigation: string;
}

export interface AiSecurityRecommendation {
	description: string;
	implementation: string;
	priority: 'high' | 'medium' | 'low';
}

// =============================================================================
// Event Interfaces
// =============================================================================

export interface AiAssistantResponseEvent {
	requestId: string;
	type: string;
	result: any;
	duration: number;
}

export interface AiAssistantErrorEvent {
	requestId: string;
	error: Error;
	context: string;
}

export interface AiContextUpdateEvent {
	context: AiContext;
	changes: Partial<AiContext>;
}

// =============================================================================
// Utility Classes
// =============================================================================

/**
 * Manages AI context and history
 */
class AiContextManager extends Disposable {
	private currentContext: AiContext = {};
	private readonly contextHistory: AiContext[] = [];
	private readonly maxHistorySize = 10;

	private readonly _onContextUpdated = this._register(new Emitter<AiContextUpdateEvent>());
	readonly onContextUpdated: Event<AiContextUpdateEvent> = this._onContextUpdated.event;

	/**
	 * Gets the current context
	 */
	getCurrentContext(): AiContext {
		return { ...this.currentContext };
	}

	/**
	 * Sets the context with history tracking
	 */
	setContext(context: Partial<AiContext>): void {
		const oldContext = { ...this.currentContext };
		this.currentContext = { ...this.currentContext, ...context };
		
		this.addToHistory(oldContext);
		this._onContextUpdated.fire({
			context: this.currentContext,
			changes: context
		});
	}

	/**
	 * Clears the context and history
	 */
	clearContext(): void {
		this.currentContext = {};
		this.contextHistory.length = 0;
	}

	/**
	 * Adds context to history with size limit
	 */
	private addToHistory(context: AiContext): void {
		this.contextHistory.push(context);
		if (this.contextHistory.length > this.maxHistorySize) {
			this.contextHistory.shift();
		}
	}
}

/**
 * Generates unique request IDs for tracking
 */
class AssistantRequestIdGenerator {
	private static counter = 0;

	static generate(): string {
		return `assistant-${Date.now()}-${this.counter++}-${Math.random().toString(36).substr(2, 9)}`;
	}
}

/**
 * Handles AI response parsing for different types of analysis
 */
class AiResponseParser {
	/**
	 * Parses code review responses into structured data
	 */
	static parseCodeReviewResponse(response: string): AiCodeReviewResult {
		const lines = response.split('\n');
		const issues: AiReviewIssue[] = [];
		const suggestions: AiReviewSuggestion[] = [];
		let score = this.extractScore(response, 5);

		lines.forEach(line => {
			const trimmedLine = line.trim();
			if (this.isIssueLine(trimmedLine)) {
				issues.push(this.createReviewIssue(trimmedLine));
			} else if (this.isSuggestionLine(trimmedLine)) {
				suggestions.push(this.createReviewSuggestion(trimmedLine));
			}
		});

		return {
			score,
			issues,
			suggestions,
			summary: response
		};
	}

	/**
	 * Parses performance analysis responses
	 */
	static parsePerformanceResponse(response: string): AiPerformanceResult {
		const lines = response.split('\n');
		const issues: AiPerformanceIssue[] = [];
		const optimizations: AiPerformanceOptimization[] = [];
		let score = this.extractScore(response, 5);

		lines.forEach(line => {
			const trimmedLine = line.trim();
			if (this.isPerformanceIssueLine(trimmedLine)) {
				issues.push(this.createPerformanceIssue(trimmedLine));
			} else if (this.isOptimizationLine(trimmedLine)) {
				optimizations.push(this.createPerformanceOptimization(trimmedLine));
			}
		});

		return {
			score,
			issues,
			optimizations,
			summary: response
		};
	}

	/**
	 * Parses security analysis responses
	 */
	static parseSecurityResponse(response: string): AiSecurityResult {
		const lines = response.split('\n');
		const vulnerabilities: AiSecurityVulnerability[] = [];
		const recommendations: AiSecurityRecommendation[] = [];
		let score = this.extractScore(response, 5);

		lines.forEach(line => {
			const trimmedLine = line.trim();
			if (this.isVulnerabilityLine(trimmedLine)) {
				vulnerabilities.push(this.createSecurityVulnerability(trimmedLine));
			} else if (this.isSecurityRecommendationLine(trimmedLine)) {
				recommendations.push(this.createSecurityRecommendation(trimmedLine));
			}
		});

		return {
			score,
			vulnerabilities,
			recommendations,
			summary: response
		};
	}

	/**
	 * Extracts score from response text
	 */
	private static extractScore(response: string, defaultValue: number): number {
		const scoreMatch = response.match(/score[:\s]*(\d+)/i);
		return scoreMatch ? parseInt(scoreMatch[1]) : defaultValue;
	}

	/**
	 * Checks if a line contains an issue
	 */
	private static isIssueLine(line: string): boolean {
		return line.includes('error') || line.includes('warning') || line.includes('issue');
	}

	/**
	 * Checks if a line contains a suggestion
	 */
	private static isSuggestionLine(line: string): boolean {
		return line.includes('suggestion') || line.includes('recommendation');
	}

	/**
	 * Checks if a line contains a performance issue
	 */
	private static isPerformanceIssueLine(line: string): boolean {
		return line.includes('performance') || line.includes('slow') || line.includes('inefficient');
	}

	/**
	 * Checks if a line contains an optimization
	 */
	private static isOptimizationLine(line: string): boolean {
		return line.includes('optimize') || line.includes('improve');
	}

	/**
	 * Checks if a line contains a vulnerability
	 */
	private static isVulnerabilityLine(line: string): boolean {
		return line.includes('vulnerability') || line.includes('security') || line.includes('risk');
	}

	/**
	 * Checks if a line contains a security recommendation
	 */
	private static isSecurityRecommendationLine(line: string): boolean {
		return line.includes('secure') || line.includes('protect');
	}

	/**
	 * Creates a review issue from a line
	 */
	private static createReviewIssue(line: string): AiReviewIssue {
		return {
			severity: line.includes('error') ? 'error' : 'warning',
			message: line,
			line: undefined
		};
	}

	/**
	 * Creates a review suggestion from a line
	 */
	private static createReviewSuggestion(line: string): AiReviewSuggestion {
		return {
			message: line,
			priority: 'medium',
			impact: 'Improves code quality'
		};
	}

	/**
	 * Creates a performance issue from a line
	 */
	private static createPerformanceIssue(line: string): AiPerformanceIssue {
		return {
			severity: 'medium',
			message: line,
			line: undefined,
			impact: 'Reduces performance',
			suggestion: 'Consider optimization'
		};
	}

	/**
	 * Creates a performance optimization from a line
	 */
	private static createPerformanceOptimization(line: string): AiPerformanceOptimization {
		return {
			description: line,
			implementation: 'Manual implementation required',
			expectedImprovement: 'Performance improvement'
		};
	}

	/**
	 * Creates a security vulnerability from a line
	 */
	private static createSecurityVulnerability(line: string): AiSecurityVulnerability {
		return {
			severity: 'medium',
			type: 'General security issue',
			description: line,
			line: undefined,
			mitigation: 'Review and fix'
		};
	}

	/**
	 * Creates a security recommendation from a line
	 */
	private static createSecurityRecommendation(line: string): AiSecurityRecommendation {
		return {
			description: line,
			implementation: 'Manual implementation required',
			priority: 'medium'
		};
	}
}

/**
 * Handles AI operation execution with consistent error handling and event firing
 */
class AiOperationExecutor {
	constructor(
		private readonly aiCoreService: IAiCoreService,
		private readonly contextManager: AiContextManager,
		private readonly logService: ILogService,
		private readonly eventEmitter: {
			fireResponse: (event: AiAssistantResponseEvent) => void;
			fireError: (event: AiAssistantErrorEvent) => void;
		}
	) {}

	/**
	 * Executes an AI operation with consistent error handling and event firing
	 */
	async executeOperation<T>(
		operationType: string,
		operation: () => Promise<T>
	): Promise<T> {
		const requestId = AssistantRequestIdGenerator.generate();
		const stopwatch = StopWatch.create();

		try {
			const result = await operation();
			
			this.eventEmitter.fireResponse({
				requestId,
				type: operationType,
				result,
				duration: stopwatch.elapsed()
			});

			return result;
		} catch (error) {
			this.eventEmitter.fireError({
				requestId,
				error: error as Error,
				context: operationType
			});
			throw error;
		}
	}

	/**
	 * Builds AI context with workspace information
	 */
	async buildContext(additionalContext?: Partial<AiContext>): Promise<AiContext> {
		const context = { ...this.contextManager.getCurrentContext(), ...additionalContext };
		
		// Add workspace context if not present
		if (!context.workspace) {
			try {
				context.workspace = await this.aiCoreService.getWorkspaceContext();
			} catch (error) {
				this.logService.warn('[AiOperationExecutor] Failed to get workspace context:', error);
			}
		}

		return context;
	}
}

// =============================================================================
// Main Service Implementation
// =============================================================================

/**
 * High-level AI assistant service that provides user-friendly interfaces
 * for common AI operations like code explanation, refactoring, and chat
 */
export class AiAssistantService extends Disposable implements IAiAssistantService {
	readonly _serviceBrand: undefined;

	private readonly contextManager: AiContextManager;
	private readonly operationExecutor: AiOperationExecutor;

	// Events
	private readonly _onAssistantResponse = this._register(new Emitter<AiAssistantResponseEvent>());
	readonly onAssistantResponse: Event<AiAssistantResponseEvent> = this._onAssistantResponse.event;

	private readonly _onAssistantError = this._register(new Emitter<AiAssistantErrorEvent>());
	readonly onAssistantError: Event<AiAssistantErrorEvent> = this._onAssistantError.event;

	readonly onContextUpdated: Event<AiContextUpdateEvent>;

	constructor(
		@IAiCoreService private readonly aiCoreService: IAiCoreService,
		@ILogService private readonly logService: ILogService
	) {
		super();
		
		this.contextManager = this._register(new AiContextManager());
		this.onContextUpdated = this.contextManager.onContextUpdated;
		
		this.operationExecutor = new AiOperationExecutor(
			this.aiCoreService,
			this.contextManager,
			this.logService,
			{
				fireResponse: (event) => this._onAssistantResponse.fire(event),
				fireError: (event) => this._onAssistantError.fire(event)
			}
		);
	}

	// =============================================================================
	// High-level AI Operations
	// =============================================================================

	/**
	 * Explains the given code using AI
	 */
	async explainCode(code: string, context?: string): Promise<string> {
		return this.operationExecutor.executeOperation('explainCode', async () => {
			const aiContext = await this.operationExecutor.buildContext(context ? { userPreferences: { context } } : undefined);
			const response = await this.aiCoreService.getChatResponse(
				`Please explain this code:\n\n${code}`,
				aiContext,
				CancellationToken.None
			);
			return response.message;
		});
	}

	/**
	 * Refactors code according to the given instruction
	 */
	async refactorCode(code: string, instruction: string): Promise<string> {
		return this.operationExecutor.executeOperation('refactorCode', async () => {
			const aiContext = await this.operationExecutor.buildContext();
			const response = await this.aiCoreService.getChatResponse(
				`Please refactor this code according to the following instruction: ${instruction}\n\nCode:\n${code}`,
				aiContext,
				CancellationToken.None
			);
			return response.message;
		});
	}

	/**
	 * Fixes bugs in the given code
	 */
	async fixBug(code: string, error?: string): Promise<string> {
		return this.operationExecutor.executeOperation('fixBug', async () => {
			const aiContext = await this.operationExecutor.buildContext();
			const prompt = error 
				? `Please fix this bug in the code. Error: ${error}\n\nCode:\n${code}`
				: `Please identify and fix any bugs in this code:\n\n${code}`;

			const response = await this.aiCoreService.getChatResponse(
				prompt,
				aiContext,
				CancellationToken.None
			);
			return response.message;
		});
	}

	/**
	 * Generates tests for the given code
	 */
	async generateTests(code: string, framework?: string): Promise<string> {
		return this.operationExecutor.executeOperation('generateTests', async () => {
			const aiContext = await this.operationExecutor.buildContext();
			const prompt = framework 
				? `Please generate tests for this code using ${framework}:\n\n${code}`
				: `Please generate tests for this code:\n\n${code}`;

			const response = await this.aiCoreService.getChatResponse(
				prompt,
				aiContext,
				CancellationToken.None
			);
			return response.message;
		});
	}

	/**
	 * Generates documentation for the given code
	 */
	async generateDocumentation(code: string, type?: string): Promise<string> {
		return this.operationExecutor.executeOperation('generateDocumentation', async () => {
			const aiContext = await this.operationExecutor.buildContext();
			const prompt = type 
				? `Please generate ${type} documentation for this code:\n\n${code}`
				: `Please generate documentation for this code:\n\n${code}`;

			const response = await this.aiCoreService.getChatResponse(
				prompt,
				aiContext,
				CancellationToken.None
			);
			return response.message;
		});
	}

	/**
	 * Reviews code and provides analysis
	 */
	async reviewCode(code: string): Promise<AiCodeReviewResult> {
		return this.operationExecutor.executeOperation('reviewCode', async () => {
			const aiContext = await this.operationExecutor.buildContext();
			const response = await this.aiCoreService.getChatResponse(
				`Please review this code and provide a detailed analysis including issues, suggestions, and a score from 1-10:\n\n${code}`,
				aiContext,
				CancellationToken.None
			);
			return AiResponseParser.parseCodeReviewResponse(response.message);
		});
	}

	/**
	 * Analyzes code for performance issues
	 */
	async optimizePerformance(code: string): Promise<AiPerformanceResult> {
		return this.operationExecutor.executeOperation('optimizePerformance', async () => {
			const aiContext = await this.operationExecutor.buildContext();
			const response = await this.aiCoreService.getChatResponse(
				`Please analyze this code for performance issues and provide optimization suggestions:\n\n${code}`,
				aiContext,
				CancellationToken.None
			);
			return AiResponseParser.parsePerformanceResponse(response.message);
		});
	}

	/**
	 * Analyzes code for security vulnerabilities
	 */
	async analyzeSecurity(code: string): Promise<AiSecurityResult> {
		return this.operationExecutor.executeOperation('analyzeSecurity', async () => {
			const aiContext = await this.operationExecutor.buildContext();
			const response = await this.aiCoreService.getChatResponse(
				`Please analyze this code for security vulnerabilities and provide recommendations:\n\n${code}`,
				aiContext,
				CancellationToken.None
			);
			return AiResponseParser.parseSecurityResponse(response.message);
		});
	}

	// =============================================================================
	// Chat Functionality
	// =============================================================================

	/**
	 * Sends a chat message with optional context
	 */
	async chat(message: string, context?: AiContext): Promise<AiChatResponse> {
		return this.operationExecutor.executeOperation('chat', async () => {
			const aiContext = await this.operationExecutor.buildContext(context);
			return await this.aiCoreService.getChatResponse(
				message,
				aiContext,
				CancellationToken.None
			);
		});
	}

	/**
	 * Sends a chat message with file context
	 */
	async chatWithFile(message: string, fileUri: URI): Promise<AiChatResponse> {
		return this.operationExecutor.executeOperation('chatWithFile', async () => {
			const fileContext = await this.aiCoreService.getFileContext(fileUri);
			const aiContext = await this.operationExecutor.buildContext({ file: fileContext });
			return await this.aiCoreService.getChatResponse(
				message,
				aiContext,
				CancellationToken.None
			);
		});
	}

	/**
	 * Sends a chat message with selection context
	 */
	async chatWithSelection(message: string, fileUri: URI, range: IRange): Promise<AiChatResponse> {
		return this.operationExecutor.executeOperation('chatWithSelection', async () => {
			const selectionContext = await this.aiCoreService.getSelectionContext(fileUri, range);
			const aiContext = await this.operationExecutor.buildContext({ selection: selectionContext });
			return await this.aiCoreService.getChatResponse(
				message,
				aiContext,
				CancellationToken.None
			);
		});
	}

	// =============================================================================
	// Code Editing
	// =============================================================================

	/**
	 * Edits code according to the given request
	 */
	async editCode(request: AiAssistantEditRequest): Promise<AiCodeEditResult> {
		return this.operationExecutor.executeOperation('editCode', async () => {
			const aiContext = await this.operationExecutor.buildContext();
			const editRequest: AiCodeEditRequest = {
				uri: request.fileUri || URI.parse('untitled://'),
				range: request.range || { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
				instruction: request.instruction,
				context: aiContext,
				options: request.options
			};
			return await this.aiCoreService.getCodeEdit(editRequest, CancellationToken.None);
		});
	}

	/**
	 * Inserts code at a specified position
	 */
	async insertCode(code: string, position: string, context?: string): Promise<string> {
		return this.operationExecutor.executeOperation('insertCode', async () => {
			const aiContext = await this.operationExecutor.buildContext(context ? { userPreferences: { context } } : undefined);
			const response = await this.aiCoreService.getChatResponse(
				`Please insert this code at the specified position: ${position}\n\nCode to insert:\n${code}`,
				aiContext,
				CancellationToken.None
			);
			return response.message;
		});
	}

	/**
	 * Replaces old code with new code
	 */
	async replaceCode(oldCode: string, newCode: string, context?: string): Promise<string> {
		return this.operationExecutor.executeOperation('replaceCode', async () => {
			const aiContext = await this.operationExecutor.buildContext(context ? { userPreferences: { context } } : undefined);
			const response = await this.aiCoreService.getChatResponse(
				`Please replace this code:\n${oldCode}\n\nWith this code:\n${newCode}`,
				aiContext,
				CancellationToken.None
			);
			return response.message;
		});
	}

	// =============================================================================
	// Context Management
	// =============================================================================

	/**
	 * Gets the current AI context
	 */
	async getCurrentContext(): Promise<AiContext> {
		return this.contextManager.getCurrentContext();
	}

	/**
	 * Sets the AI context
	 */
	setContext(context: Partial<AiContext>): void {
		this.contextManager.setContext(context);
	}

	/**
	 * Clears the AI context
	 */
	clearContext(): void {
		this.contextManager.clearContext();
	}
}

// Register the service
registerSingleton(IAiAssistantService, AiAssistantService, InstantiationType.Delayed);