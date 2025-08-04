/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { StopWatch } from '../../../../base/common/stopwatch.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IPosition, Position } from '../../../../editor/common/core/position.js';
import { IRange, Range } from '../../../../editor/common/core/range.js';

export const IAiCoreService = createDecorator<IAiCoreService>('IAiCoreService');

export interface IAiCoreService {
	readonly _serviceBrand: undefined;

	// Core AI functionality
	isEnabled(): boolean;
	getCompletion(query: string, context: AiContext, token: CancellationToken): Promise<AiCompletionResult>;
	getChatResponse(message: string, context: AiContext, token: CancellationToken): Promise<AiChatResponse>;
	getCodeEdit(request: AiCodeEditRequest, token: CancellationToken): Promise<AiCodeEditResult>;
	getExplanation(code: string, context: AiContext, token: CancellationToken): Promise<AiExplanationResult>;
	getRefactoring(request: AiRefactoringRequest, token: CancellationToken): Promise<AiRefactoringResult>;
	getBugFix(request: AiBugFixRequest, token: CancellationToken): Promise<AiBugFixResult>;
	getTestGeneration(request: AiTestGenerationRequest, token: CancellationToken): Promise<AiTestGenerationResult>;
	getDocumentation(request: AiDocumentationRequest, token: CancellationToken): Promise<AiDocumentationResult>;
	getCodeReview(request: AiCodeReviewRequest, token: CancellationToken): Promise<AiCodeReviewResult>;
	getPerformanceOptimization(request: AiPerformanceRequest, token: CancellationToken): Promise<AiPerformanceResult>;
	getSecurityAnalysis(request: AiSecurityRequest, token: CancellationToken): Promise<AiSecurityResult>;

	// Context management
	getWorkspaceContext(): Promise<AiWorkspaceContext>;
	getFileContext(uri: URI): Promise<AiFileContext>;
	getSelectionContext(uri: URI, range: IRange): Promise<AiSelectionContext>;

	// Provider management
	registerAiProvider(provider: IAiProvider): IDisposable;
	registerCodeCompletionProvider(provider: ICodeCompletionProvider): IDisposable;
	registerChatProvider(provider: IChatProvider): IDisposable;
	registerCodeEditProvider(provider: ICodeEditProvider): IDisposable;

	// Events
	readonly onAiResponse: Event<AiResponseEvent>;
	readonly onAiError: Event<AiErrorEvent>;
	readonly onContextChanged: Event<AiContextChangeEvent>;
}

export interface IAiProvider {
	readonly id: string;
	readonly name: string;
	readonly capabilities: AiCapability[];
	
	initialize(): Promise<void>;
	dispose(): void;
}

export interface ICodeCompletionProvider extends IAiProvider {
	provideCompletion(query: string, context: AiContext, token: CancellationToken): Promise<AiCompletionResult>;
}

export interface IChatProvider extends IAiProvider {
	provideChatResponse(message: string, context: AiContext, token: CancellationToken): Promise<AiChatResponse>;
}

export interface ICodeEditProvider extends IAiProvider {
	provideCodeEdit(request: AiCodeEditRequest, token: CancellationToken): Promise<AiCodeEditResult>;
}

export enum AiCapability {
	CodeCompletion = 'codeCompletion',
	Chat = 'chat',
	CodeEdit = 'codeEdit',
	Explanation = 'explanation',
	Refactoring = 'refactoring',
	BugFix = 'bugFix',
	TestGeneration = 'testGeneration',
	Documentation = 'documentation',
	CodeReview = 'codeReview',
	PerformanceOptimization = 'performanceOptimization',
	SecurityAnalysis = 'securityAnalysis'
}

export interface AiContext {
	workspace?: AiWorkspaceContext;
	file?: AiFileContext;
	selection?: AiSelectionContext;
	language?: string;
	framework?: string;
	projectType?: string;
	userPreferences?: Record<string, any>;
}

export interface AiWorkspaceContext {
	rootPath: string;
	files: AiFileInfo[];
	dependencies: string[];
	configFiles: string[];
	gitInfo?: AiGitInfo;
}

export interface AiFileInfo {
	uri: URI;
	path: string;
	language: string;
	size: number;
	lastModified: number;
}

export interface AiGitInfo {
	branch: string;
	commit: string;
	remote?: string;
	changes: AiGitChange[];
}

export interface AiGitChange {
	file: string;
	status: 'modified' | 'added' | 'deleted';
	diff?: string;
}

export interface AiFileContext {
	uri: URI;
	content: string;
	language: string;
	structure: AiFileStructure;
	imports: string[];
	exports: string[];
	dependencies: string[];
}

export interface AiFileStructure {
	functions: AiFunctionInfo[];
	classes: AiClassInfo[];
	interfaces: AiInterfaceInfo[];
	variables: AiVariableInfo[];
	imports: AiImportInfo[];
}

export interface AiFunctionInfo {
	name: string;
	range: IRange;
	parameters: string[];
	returnType?: string;
	visibility: 'public' | 'private' | 'protected';
}

export interface AiClassInfo {
	name: string;
	range: IRange;
	methods: AiFunctionInfo[];
	properties: AiVariableInfo[];
	extends?: string;
	implements?: string[];
}

export interface AiInterfaceInfo {
	name: string;
	range: IRange;
	methods: AiFunctionInfo[];
	properties: AiVariableInfo[];
	extends?: string[];
}

export interface AiVariableInfo {
	name: string;
	range: IRange;
	type?: string;
	visibility: 'public' | 'private' | 'protected';
}

export interface AiImportInfo {
	module: string;
	imports: string[];
	range: IRange;
}

export interface AiSelectionContext {
	uri: URI;
	range: IRange;
	content: string;
	surroundingLines: string[];
	indentation: string;
	language: string;
}

export interface AiCompletionResult {
	completions: AiCompletion[];
	metadata?: Record<string, any>;
}

export interface AiCompletion {
	text: string;
	range: IRange;
	kind: AiCompletionKind;
	score: number;
	metadata?: Record<string, any>;
}

export enum AiCompletionKind {
	Function = 'function',
	Variable = 'variable',
	Class = 'class',
	Interface = 'interface',
	Import = 'import',
	Method = 'method',
	Property = 'property',
	Parameter = 'parameter',
	Type = 'type',
	Keyword = 'keyword',
	Snippet = 'snippet'
}

export interface AiChatResponse {
	message: string;
	codeBlocks: AiCodeBlock[];
	suggestions: string[];
	metadata?: Record<string, any>;
}

export interface AiCodeBlock {
	code: string;
	language: string;
	range?: IRange;
	explanation?: string;
}

export interface AiCodeEditRequest {
	uri: URI;
	range: IRange;
	instruction: string;
	context: AiContext;
	options?: AiCodeEditOptions;
}

export interface AiCodeEditOptions {
	preserveFormatting?: boolean;
	includeComments?: boolean;
	style?: 'conservative' | 'aggressive';
}

export interface AiCodeEditResult {
	edits: AiCodeEdit[];
	explanation?: string;
	metadata?: Record<string, any>;
}

export interface AiCodeEdit {
	range: IRange;
	text: string;
	kind: AiEditKind;
}

export enum AiEditKind {
	Insert = 'insert',
	Replace = 'replace',
	Delete = 'delete',
	Refactor = 'refactor'
}

export interface AiExplanationResult {
	explanation: string;
	codeBlocks: AiCodeBlock[];
	relatedConcepts: string[];
	metadata?: Record<string, any>;
}

export interface AiRefactoringRequest {
	uri: URI;
	range: IRange;
	type: AiRefactoringType;
	context: AiContext;
}

export enum AiRefactoringType {
	ExtractMethod = 'extractMethod',
	ExtractVariable = 'extractVariable',
	ExtractClass = 'extractClass',
	Rename = 'rename',
	Move = 'move',
	Inline = 'inline',
	Simplify = 'simplify'
}

export interface AiRefactoringResult {
	edits: AiCodeEdit[];
	explanation: string;
	beforeAfter?: { before: string; after: string };
	metadata?: Record<string, any>;
}

export interface AiBugFixRequest {
	uri: URI;
	range: IRange;
	error?: string;
	context: AiContext;
}

export interface AiBugFixResult {
	edits: AiCodeEdit[];
	explanation: string;
	errorAnalysis: string;
	metadata?: Record<string, any>;
}

export interface AiTestGenerationRequest {
	uri: URI;
	range: IRange;
	type: AiTestType;
	framework?: string;
	context: AiContext;
}

export enum AiTestType {
	Unit = 'unit',
	Integration = 'integration',
	E2E = 'e2e',
	Performance = 'performance'
}

export interface AiTestGenerationResult {
	tests: AiTest[];
	framework: string;
	metadata?: Record<string, any>;
}

export interface AiTest {
	code: string;
	description: string;
	type: AiTestType;
	coverage?: number;
}

export interface AiDocumentationRequest {
	uri: URI;
	range: IRange;
	type: AiDocumentationType;
	context: AiContext;
}

export enum AiDocumentationType {
	Function = 'function',
	Class = 'class',
	Interface = 'interface',
	Module = 'module',
	API = 'api'
}

export interface AiDocumentationResult {
	documentation: string;
	examples: string[];
	metadata?: Record<string, any>;
}

export interface AiCodeReviewRequest {
	uri: URI;
	context: AiContext;
	options?: AiCodeReviewOptions;
}

export interface AiCodeReviewOptions {
	includeSuggestions?: boolean;
	includeSecurity?: boolean;
	includePerformance?: boolean;
	includeBestPractices?: boolean;
}

export interface AiCodeReviewResult {
	issues: AiCodeReviewIssue[];
	suggestions: AiCodeReviewSuggestion[];
	score: number;
	metadata?: Record<string, any>;
}

export interface AiCodeReviewIssue {
	severity: 'error' | 'warning' | 'info';
	message: string;
	range?: IRange;
	category: string;
	suggestion?: string;
}

export interface AiCodeReviewSuggestion {
	message: string;
	range?: IRange;
	priority: 'high' | 'medium' | 'low';
	impact: string;
}

export interface AiPerformanceRequest {
	uri: URI;
	context: AiContext;
}

export interface AiPerformanceResult {
	issues: AiPerformanceIssue[];
	optimizations: AiPerformanceOptimization[];
	score: number;
	metadata?: Record<string, any>;
}

export interface AiPerformanceIssue {
	severity: 'critical' | 'high' | 'medium' | 'low';
	message: string;
	range?: IRange;
	impact: string;
	suggestion: string;
}

export interface AiPerformanceOptimization {
	description: string;
	range?: IRange;
	implementation: string;
	expectedImprovement: string;
}

export interface AiSecurityRequest {
	uri: URI;
	context: AiContext;
}

export interface AiSecurityResult {
	vulnerabilities: AiSecurityVulnerability[];
	recommendations: AiSecurityRecommendation[];
	score: number;
	metadata?: Record<string, any>;
}

export interface AiSecurityVulnerability {
	severity: 'critical' | 'high' | 'medium' | 'low';
	type: string;
	description: string;
	range?: IRange;
	cve?: string;
	mitigation: string;
}

export interface AiSecurityRecommendation {
	description: string;
	range?: IRange;
	implementation: string;
	priority: 'high' | 'medium' | 'low';
}

export interface AiResponseEvent {
	requestId: string;
	type: string;
	result: any;
	duration: number;
}

export interface AiErrorEvent {
	requestId: string;
	error: Error;
	context: string;
}

export interface AiContextChangeEvent {
	type: 'workspace' | 'file' | 'selection';
	data: any;
}

export class AiCoreService extends Disposable implements IAiCoreService {
	readonly _serviceBrand: undefined;

	private readonly _providers: Map<string, IAiProvider> = new Map();
	private readonly _completionProviders: ICodeCompletionProvider[] = [];
	private readonly _chatProviders: IChatProvider[] = [];
	private readonly _codeEditProviders: ICodeEditProvider[] = [];

	private readonly _onAiResponse = this._register(new Emitter<AiResponseEvent>());
	readonly onAiResponse: Event<AiResponseEvent> = this._onAiResponse.event;

	private readonly _onAiError = this._register(new Emitter<AiErrorEvent>());
	readonly onAiError: Event<AiErrorEvent> = this._onAiError.event;

	private readonly _onContextChanged = this._register(new Emitter<AiContextChangeEvent>());
	readonly onContextChanged: Event<AiContextChangeEvent> = this._onContextChanged.event;

	constructor(@ILogService private readonly logService: ILogService) {
		super();
	}

	isEnabled(): boolean {
		return this._providers.size > 0;
	}

	registerAiProvider(provider: IAiProvider): IDisposable {
		this._providers.set(provider.id, provider);
		this.logService.trace(`[AiCoreService] Registered AI provider: ${provider.name}`);
		
		return {
			dispose: () => {
				this._providers.delete(provider.id);
				provider.dispose();
			}
		};
	}

	registerCodeCompletionProvider(provider: ICodeCompletionProvider): IDisposable {
		this._completionProviders.push(provider);
		this.logService.trace(`[AiCoreService] Registered code completion provider: ${provider.name}`);
		
		return {
			dispose: () => {
				const index = this._completionProviders.indexOf(provider);
				if (index >= 0) {
					this._completionProviders.splice(index, 1);
				}
			}
		};
	}

	registerChatProvider(provider: IChatProvider): IDisposable {
		this._chatProviders.push(provider);
		this.logService.trace(`[AiCoreService] Registered chat provider: ${provider.name}`);
		
		return {
			dispose: () => {
				const index = this._chatProviders.indexOf(provider);
				if (index >= 0) {
					this._chatProviders.splice(index, 1);
				}
			}
		};
	}

	registerCodeEditProvider(provider: ICodeEditProvider): IDisposable {
		this._codeEditProviders.push(provider);
		this.logService.trace(`[AiCoreService] Registered code edit provider: ${provider.name}`);
		
		return {
			dispose: () => {
				const index = this._codeEditProviders.indexOf(provider);
				if (index >= 0) {
					this._codeEditProviders.splice(index, 1);
				}
			}
		};
	}

	async getCompletion(query: string, context: AiContext, token: CancellationToken): Promise<AiCompletionResult> {
		const stopwatch = StopWatch.create();
		const requestId = this.generateRequestId();

		try {
			if (this._completionProviders.length === 0) {
				throw new Error('No code completion providers registered');
			}

			const results = await Promise.all(
				this._completionProviders.map(provider =>
					provider.provideCompletion(query, context, token)
				)
			);

			const mergedResult = this.mergeCompletionResults(results);
			
			this._onAiResponse.fire({
				requestId,
				type: 'completion',
				result: mergedResult,
				duration: stopwatch.elapsed()
			});

			return mergedResult;
		} catch (error) {
			this._onAiError.fire({
				requestId,
				error: error as Error,
				context: 'getCompletion'
			});
			throw error;
		}
	}

	async getChatResponse(message: string, context: AiContext, token: CancellationToken): Promise<AiChatResponse> {
		const stopwatch = StopWatch.create();
		const requestId = this.generateRequestId();

		try {
			if (this._chatProviders.length === 0) {
				throw new Error('No chat providers registered');
			}

			const results = await Promise.all(
				this._chatProviders.map(provider =>
					provider.provideChatResponse(message, context, token)
				)
			);

			const mergedResult = this.mergeChatResults(results);
			
			this._onAiResponse.fire({
				requestId,
				type: 'chat',
				result: mergedResult,
				duration: stopwatch.elapsed()
			});

			return mergedResult;
		} catch (error) {
			this._onAiError.fire({
				requestId,
				error: error as Error,
				context: 'getChatResponse'
			});
			throw error;
		}
	}

	async getCodeEdit(request: AiCodeEditRequest, token: CancellationToken): Promise<AiCodeEditResult> {
		const stopwatch = StopWatch.create();
		const requestId = this.generateRequestId();

		try {
			if (this._codeEditProviders.length === 0) {
				throw new Error('No code edit providers registered');
			}

			const results = await Promise.all(
				this._codeEditProviders.map(provider =>
					provider.provideCodeEdit(request, token)
				)
			);

			const mergedResult = this.mergeCodeEditResults(results);
			
			this._onAiResponse.fire({
				requestId,
				type: 'codeEdit',
				result: mergedResult,
				duration: stopwatch.elapsed()
			});

			return mergedResult;
		} catch (error) {
			this._onAiError.fire({
				requestId,
				error: error as Error,
				context: 'getCodeEdit'
			});
			throw error;
		}
	}

	async getExplanation(code: string, context: AiContext, token: CancellationToken): Promise<AiExplanationResult> {
		// Implementation for code explanation
		throw new Error('Not implemented');
	}

	async getRefactoring(request: AiRefactoringRequest, token: CancellationToken): Promise<AiRefactoringResult> {
		// Implementation for code refactoring
		throw new Error('Not implemented');
	}

	async getBugFix(request: AiBugFixRequest, token: CancellationToken): Promise<AiBugFixResult> {
		// Implementation for bug fixing
		throw new Error('Not implemented');
	}

	async getTestGeneration(request: AiTestGenerationRequest, token: CancellationToken): Promise<AiTestGenerationResult> {
		// Implementation for test generation
		throw new Error('Not implemented');
	}

	async getDocumentation(request: AiDocumentationRequest, token: CancellationToken): Promise<AiDocumentationResult> {
		// Implementation for documentation generation
		throw new Error('Not implemented');
	}

	async getCodeReview(request: AiCodeReviewRequest, token: CancellationToken): Promise<AiCodeReviewResult> {
		// Implementation for code review
		throw new Error('Not implemented');
	}

	async getPerformanceOptimization(request: AiPerformanceRequest, token: CancellationToken): Promise<AiPerformanceResult> {
		// Implementation for performance optimization
		throw new Error('Not implemented');
	}

	async getSecurityAnalysis(request: AiSecurityRequest, token: CancellationToken): Promise<AiSecurityResult> {
		// Implementation for security analysis
		throw new Error('Not implemented');
	}

	async getWorkspaceContext(): Promise<AiWorkspaceContext> {
		// Implementation for workspace context
		throw new Error('Not implemented');
	}

	async getFileContext(uri: URI): Promise<AiFileContext> {
		// Implementation for file context
		throw new Error('Not implemented');
	}

	async getSelectionContext(uri: URI, range: IRange): Promise<AiSelectionContext> {
		// Implementation for selection context
		throw new Error('Not implemented');
	}

	private generateRequestId(): string {
		return `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	private mergeCompletionResults(results: AiCompletionResult[]): AiCompletionResult {
		const allCompletions: AiCompletion[] = [];
		const metadata: Record<string, any> = {};

		for (const result of results) {
			allCompletions.push(...result.completions);
			if (result.metadata) {
				Object.assign(metadata, result.metadata);
			}
		}

		// Sort by score and remove duplicates
		const uniqueCompletions = this.deduplicateCompletions(allCompletions);
		uniqueCompletions.sort((a, b) => b.score - a.score);

		return {
			completions: uniqueCompletions,
			metadata
		};
	}

	private mergeChatResults(results: AiChatResponse[]): AiChatResponse {
		const allCodeBlocks: AiCodeBlock[] = [];
		const allSuggestions: string[] = [];
		const metadata: Record<string, any> = {};

		for (const result of results) {
			allCodeBlocks.push(...result.codeBlocks);
			allSuggestions.push(...result.suggestions);
			if (result.metadata) {
				Object.assign(metadata, result.metadata);
			}
		}

		return {
			message: results[0]?.message || '',
			codeBlocks: allCodeBlocks,
			suggestions: [...new Set(allSuggestions)],
			metadata
		};
	}

	private mergeCodeEditResults(results: AiCodeEditResult[]): AiCodeEditResult {
		const allEdits: AiCodeEdit[] = [];
		const metadata: Record<string, any> = {};

		for (const result of results) {
			allEdits.push(...result.edits);
			if (result.metadata) {
				Object.assign(metadata, result.metadata);
			}
		}

		return {
			edits: allEdits,
			explanation: results[0]?.explanation || '',
			metadata
		};
	}

	private deduplicateCompletions(completions: AiCompletion[]): AiCompletion[] {
		const seen = new Set<string>();
		return completions.filter(completion => {
			const key = `${completion.text}-${completion.range.startLineNumber}-${completion.range.startColumn}`;
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
	}
}

registerSingleton(IAiCoreService, AiCoreService, InstantiationType.Delayed);