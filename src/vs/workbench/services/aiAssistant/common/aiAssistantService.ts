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

export class AiAssistantService extends Disposable implements IAiAssistantService {
	readonly _serviceBrand: undefined;

	private _currentContext: AiContext = {};
	private readonly _contextHistory: AiContext[] = [];

	private readonly _onAssistantResponse = this._register(new Emitter<AiAssistantResponseEvent>());
	readonly onAssistantResponse: Event<AiAssistantResponseEvent> = this._onAssistantResponse.event;

	private readonly _onAssistantError = this._register(new Emitter<AiAssistantErrorEvent>());
	readonly onAssistantError: Event<AiAssistantErrorEvent> = this._onAssistantError.event;

	private readonly _onContextUpdated = this._register(new Emitter<AiContextUpdateEvent>());
	readonly onContextUpdated: Event<AiContextUpdateEvent> = this._onContextUpdated.event;

	constructor(
		@IAiCoreService private readonly aiCoreService: IAiCoreService,
		@ILogService private readonly logService: ILogService
	) {
		super();
	}

	async explainCode(code: string, context?: string): Promise<string> {
		const requestId = this.generateRequestId();
		const stopwatch = this.createStopwatch();

		try {
			const aiContext = await this.buildContext(context);
			const response = await this.aiCoreService.getChatResponse(
				`Please explain this code:\n\n${code}`,
				aiContext,
				CancellationToken.None
			);

			this._onAssistantResponse.fire({
				requestId,
				type: 'explainCode',
				result: response.message,
				duration: stopwatch.elapsed()
			});

			return response.message;
		} catch (error) {
			this._onAssistantError.fire({
				requestId,
				error: error as Error,
				context: 'explainCode'
			});
			throw error;
		}
	}

	async refactorCode(code: string, instruction: string): Promise<string> {
		const requestId = this.generateRequestId();
		const stopwatch = this.createStopwatch();

		try {
			const aiContext = await this.buildContext();
			const response = await this.aiCoreService.getChatResponse(
				`Please refactor this code according to the following instruction: ${instruction}\n\nCode:\n${code}`,
				aiContext,
				CancellationToken.None
			);

			this._onAssistantResponse.fire({
				requestId,
				type: 'refactorCode',
				result: response.message,
				duration: stopwatch.elapsed()
			});

			return response.message;
		} catch (error) {
			this._onAssistantError.fire({
				requestId,
				error: error as Error,
				context: 'refactorCode'
			});
			throw error;
		}
	}

	async fixBug(code: string, error?: string): Promise<string> {
		const requestId = this.generateRequestId();
		const stopwatch = this.createStopwatch();

		try {
			const aiContext = await this.buildContext();
			const prompt = error 
				? `Please fix this bug in the code. Error: ${error}\n\nCode:\n${code}`
				: `Please identify and fix any bugs in this code:\n\n${code}`;

			const response = await this.aiCoreService.getChatResponse(
				prompt,
				aiContext,
				CancellationToken.None
			);

			this._onAssistantResponse.fire({
				requestId,
				type: 'fixBug',
				result: response.message,
				duration: stopwatch.elapsed()
			});

			return response.message;
		} catch (error) {
			this._onAssistantError.fire({
				requestId,
				error: error as Error,
				context: 'fixBug'
			});
			throw error;
		}
	}

	async generateTests(code: string, framework?: string): Promise<string> {
		const requestId = this.generateRequestId();
		const stopwatch = this.createStopwatch();

		try {
			const aiContext = await this.buildContext();
			const prompt = framework 
				? `Please generate tests for this code using ${framework}:\n\n${code}`
				: `Please generate tests for this code:\n\n${code}`;

			const response = await this.aiCoreService.getChatResponse(
				prompt,
				aiContext,
				CancellationToken.None
			);

			this._onAssistantResponse.fire({
				requestId,
				type: 'generateTests',
				result: response.message,
				duration: stopwatch.elapsed()
			});

			return response.message;
		} catch (error) {
			this._onAssistantError.fire({
				requestId,
				error: error as Error,
				context: 'generateTests'
			});
			throw error;
		}
	}

	async generateDocumentation(code: string, type?: string): Promise<string> {
		const requestId = this.generateRequestId();
		const stopwatch = this.createStopwatch();

		try {
			const aiContext = await this.buildContext();
			const prompt = type 
				? `Please generate ${type} documentation for this code:\n\n${code}`
				: `Please generate documentation for this code:\n\n${code}`;

			const response = await this.aiCoreService.getChatResponse(
				prompt,
				aiContext,
				CancellationToken.None
			);

			this._onAssistantResponse.fire({
				requestId,
				type: 'generateDocumentation',
				result: response.message,
				duration: stopwatch.elapsed()
			});

			return response.message;
		} catch (error) {
			this._onAssistantError.fire({
				requestId,
				error: error as Error,
				context: 'generateDocumentation'
			});
			throw error;
		}
	}

	async reviewCode(code: string): Promise<AiCodeReviewResult> {
		const requestId = this.generateRequestId();
		const stopwatch = this.createStopwatch();

		try {
			const aiContext = await this.buildContext();
			const response = await this.aiCoreService.getChatResponse(
				`Please review this code and provide a detailed analysis including issues, suggestions, and a score from 1-10:\n\n${code}`,
				aiContext,
				CancellationToken.None
			);

			// Parse the response to extract structured data
			const result = this.parseCodeReviewResponse(response.message);

			this._onAssistantResponse.fire({
				requestId,
				type: 'reviewCode',
				result,
				duration: stopwatch.elapsed()
			});

			return result;
		} catch (error) {
			this._onAssistantError.fire({
				requestId,
				error: error as Error,
				context: 'reviewCode'
			});
			throw error;
		}
	}

	async optimizePerformance(code: string): Promise<AiPerformanceResult> {
		const requestId = this.generateRequestId();
		const stopwatch = this.createStopwatch();

		try {
			const aiContext = await this.buildContext();
			const response = await this.aiCoreService.getChatResponse(
				`Please analyze this code for performance issues and provide optimization suggestions:\n\n${code}`,
				aiContext,
				CancellationToken.None
			);

			const result = this.parsePerformanceResponse(response.message);

			this._onAssistantResponse.fire({
				requestId,
				type: 'optimizePerformance',
				result,
				duration: stopwatch.elapsed()
			});

			return result;
		} catch (error) {
			this._onAssistantError.fire({
				requestId,
				error: error as Error,
				context: 'optimizePerformance'
			});
			throw error;
		}
	}

	async analyzeSecurity(code: string): Promise<AiSecurityResult> {
		const requestId = this.generateRequestId();
		const stopwatch = this.createStopwatch();

		try {
			const aiContext = await this.buildContext();
			const response = await this.aiCoreService.getChatResponse(
				`Please analyze this code for security vulnerabilities and provide recommendations:\n\n${code}`,
				aiContext,
				CancellationToken.None
			);

			const result = this.parseSecurityResponse(response.message);

			this._onAssistantResponse.fire({
				requestId,
				type: 'analyzeSecurity',
				result,
				duration: stopwatch.elapsed()
			});

			return result;
		} catch (error) {
			this._onAssistantError.fire({
				requestId,
				error: error as Error,
				context: 'analyzeSecurity'
			});
			throw error;
		}
	}

	async chat(message: string, context?: AiContext): Promise<AiChatResponse> {
		const requestId = this.generateRequestId();
		const stopwatch = this.createStopwatch();

		try {
			const aiContext = await this.buildContext(context);
			const response = await this.aiCoreService.getChatResponse(
				message,
				aiContext,
				CancellationToken.None
			);

			this._onAssistantResponse.fire({
				requestId,
				type: 'chat',
				result: response,
				duration: stopwatch.elapsed()
			});

			return response;
		} catch (error) {
			this._onAssistantError.fire({
				requestId,
				error: error as Error,
				context: 'chat'
			});
			throw error;
		}
	}

	async chatWithFile(message: string, fileUri: URI): Promise<AiChatResponse> {
		const requestId = this.generateRequestId();
		const stopwatch = this.createStopwatch();

		try {
			const fileContext = await this.aiCoreService.getFileContext(fileUri);
			const aiContext = await this.buildContext({ file: fileContext });
			const response = await this.aiCoreService.getChatResponse(
				message,
				aiContext,
				CancellationToken.None
			);

			this._onAssistantResponse.fire({
				requestId,
				type: 'chatWithFile',
				result: response,
				duration: stopwatch.elapsed()
			});

			return response;
		} catch (error) {
			this._onAssistantError.fire({
				requestId,
				error: error as Error,
				context: 'chatWithFile'
			});
			throw error;
		}
	}

	async chatWithSelection(message: string, fileUri: URI, range: IRange): Promise<AiChatResponse> {
		const requestId = this.generateRequestId();
		const stopwatch = this.createStopwatch();

		try {
			const selectionContext = await this.aiCoreService.getSelectionContext(fileUri, range);
			const aiContext = await this.buildContext({ selection: selectionContext });
			const response = await this.aiCoreService.getChatResponse(
				message,
				aiContext,
				CancellationToken.None
			);

			this._onAssistantResponse.fire({
				requestId,
				type: 'chatWithSelection',
				result: response,
				duration: stopwatch.elapsed()
			});

			return response;
		} catch (error) {
			this._onAssistantError.fire({
				requestId,
				error: error as Error,
				context: 'chatWithSelection'
			});
			throw error;
		}
	}

	async editCode(request: AiAssistantEditRequest): Promise<AiCodeEditResult> {
		const requestId = this.generateRequestId();
		const stopwatch = this.createStopwatch();

		try {
			const aiContext = await this.buildContext();
			const editRequest = {
				uri: request.fileUri || URI.parse('untitled://'),
				range: request.range || { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
				instruction: request.instruction,
				context: aiContext,
				options: request.options
			};

			const result = await this.aiCoreService.getCodeEdit(editRequest, CancellationToken.None);

			this._onAssistantResponse.fire({
				requestId,
				type: 'editCode',
				result,
				duration: stopwatch.elapsed()
			});

			return result;
		} catch (error) {
			this._onAssistantError.fire({
				requestId,
				error: error as Error,
				context: 'editCode'
			});
			throw error;
		}
	}

	async insertCode(code: string, position: string, context?: string): Promise<string> {
		const requestId = this.generateRequestId();
		const stopwatch = this.createStopwatch();

		try {
			const aiContext = await this.buildContext(context);
			const response = await this.aiCoreService.getChatResponse(
				`Please insert this code at the specified position: ${position}\n\nCode to insert:\n${code}`,
				aiContext,
				CancellationToken.None
			);

			this._onAssistantResponse.fire({
				requestId,
				type: 'insertCode',
				result: response.message,
				duration: stopwatch.elapsed()
			});

			return response.message;
		} catch (error) {
			this._onAssistantError.fire({
				requestId,
				error: error as Error,
				context: 'insertCode'
			});
			throw error;
		}
	}

	async replaceCode(oldCode: string, newCode: string, context?: string): Promise<string> {
		const requestId = this.generateRequestId();
		const stopwatch = this.createStopwatch();

		try {
			const aiContext = await this.buildContext(context);
			const response = await this.aiCoreService.getChatResponse(
				`Please replace this code:\n${oldCode}\n\nWith this code:\n${newCode}`,
				aiContext,
				CancellationToken.None
			);

			this._onAssistantResponse.fire({
				requestId,
				type: 'replaceCode',
				result: response.message,
				duration: stopwatch.elapsed()
			});

			return response.message;
		} catch (error) {
			this._onAssistantError.fire({
				requestId,
				error: error as Error,
				context: 'replaceCode'
			});
			throw error;
		}
	}

	async getCurrentContext(): Promise<AiContext> {
		return { ...this._currentContext };
	}

	setContext(context: Partial<AiContext>): void {
		const oldContext = { ...this._currentContext };
		this._currentContext = { ...this._currentContext, ...context };
		
		this._contextHistory.push(oldContext);
		if (this._contextHistory.length > 10) {
			this._contextHistory.shift();
		}

		this._onContextUpdated.fire({
			context: this._currentContext,
			changes: context
		});
	}

	clearContext(): void {
		this._currentContext = {};
		this._contextHistory.length = 0;
	}

	private async buildContext(additionalContext?: Partial<AiContext>): Promise<AiContext> {
		const context = { ...this._currentContext, ...additionalContext };
		
		// Add workspace context if not present
		if (!context.workspace) {
			try {
				context.workspace = await this.aiCoreService.getWorkspaceContext();
			} catch (error) {
				this.logService.warn('[AiAssistantService] Failed to get workspace context:', error);
			}
		}

		return context;
	}

	private generateRequestId(): string {
		return `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	private createStopwatch() {
		const { StopWatch } = require('../../../../base/common/stopwatch.js');
		return StopWatch.create();
	}

	private parseCodeReviewResponse(response: string): AiCodeReviewResult {
		// Simple parsing - in a real implementation, you'd want more sophisticated parsing
		const lines = response.split('\n');
		const issues: AiReviewIssue[] = [];
		const suggestions: AiReviewSuggestion[] = [];
		let score = 5; // Default score

		// Extract score
		const scoreMatch = response.match(/score[:\s]*(\d+)/i);
		if (scoreMatch) {
			score = parseInt(scoreMatch[1]);
		}

		// Parse issues and suggestions (simplified)
		lines.forEach(line => {
			if (line.includes('error') || line.includes('warning') || line.includes('issue')) {
				issues.push({
					severity: line.includes('error') ? 'error' : 'warning',
					message: line.trim(),
					line: undefined
				});
			} else if (line.includes('suggestion') || line.includes('recommendation')) {
				suggestions.push({
					message: line.trim(),
					priority: 'medium',
					impact: 'Improves code quality'
				});
			}
		});

		return {
			score,
			issues,
			suggestions,
			summary: response
		};
	}

	private parsePerformanceResponse(response: string): AiPerformanceResult {
		// Simple parsing - in a real implementation, you'd want more sophisticated parsing
		const lines = response.split('\n');
		const issues: AiPerformanceIssue[] = [];
		const optimizations: AiPerformanceOptimization[] = [];
		let score = 5; // Default score

		// Parse performance issues and optimizations (simplified)
		lines.forEach(line => {
			if (line.includes('performance') || line.includes('slow') || line.includes('inefficient')) {
				issues.push({
					severity: 'medium',
					message: line.trim(),
					line: undefined,
					impact: 'Reduces performance',
					suggestion: 'Consider optimization'
				});
			} else if (line.includes('optimize') || line.includes('improve')) {
				optimizations.push({
					description: line.trim(),
					implementation: 'Manual implementation required',
					expectedImprovement: 'Performance improvement'
				});
			}
		});

		return {
			score,
			issues,
			optimizations,
			summary: response
		};
	}

	private parseSecurityResponse(response: string): AiSecurityResult {
		// Simple parsing - in a real implementation, you'd want more sophisticated parsing
		const lines = response.split('\n');
		const vulnerabilities: AiSecurityVulnerability[] = [];
		const recommendations: AiSecurityRecommendation[] = [];
		let score = 5; // Default score

		// Parse security vulnerabilities and recommendations (simplified)
		lines.forEach(line => {
			if (line.includes('vulnerability') || line.includes('security') || line.includes('risk')) {
				vulnerabilities.push({
					severity: 'medium',
					type: 'General security issue',
					description: line.trim(),
					line: undefined,
					mitigation: 'Review and fix'
				});
			} else if (line.includes('secure') || line.includes('protect')) {
				recommendations.push({
					description: line.trim(),
					implementation: 'Manual implementation required',
					priority: 'medium'
				});
			}
		});

		return {
			score,
			vulnerabilities,
			recommendations,
			summary: response
		};
	}
}

registerSingleton(IAiAssistantService, AiAssistantService, InstantiationType.Delayed);