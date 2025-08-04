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

// =============================================================================
// Service Interface
// =============================================================================

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

// =============================================================================
// Provider Interfaces
// =============================================================================

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

// =============================================================================
// Enums
// =============================================================================

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

export enum AiEditKind {
	Insert = 'insert',
	Replace = 'replace',
	Delete = 'delete',
	Refactor = 'refactor'
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

export enum AiTestType {
	Unit = 'unit',
	Integration = 'integration',
	E2E = 'e2e',
	Performance = 'performance'
}

export enum AiDocumentationType {
	Function = 'function',
	Class = 'class',
	Interface = 'interface',
	Module = 'module',
	API = 'api'
}

// =============================================================================
// Context Interfaces
// =============================================================================

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

// =============================================================================
// Result Interfaces
// =============================================================================

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

// =============================================================================
// Event Interfaces
// =============================================================================

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

// =============================================================================
// Utility Classes
// =============================================================================

/**
 * Manages AI providers registration and lifecycle
 */
class AiProviderManager extends Disposable {
	private readonly providers: Map<string, IAiProvider> = new Map();
	private readonly completionProviders: ICodeCompletionProvider[] = [];
	private readonly chatProviders: IChatProvider[] = [];
	private readonly codeEditProviders: ICodeEditProvider[] = [];

	constructor(private readonly logService: ILogService) {
		super();
	}

	/**
	 * Registers a general AI provider
	 */
	registerAiProvider(provider: IAiProvider): IDisposable {
		this.providers.set(provider.id, provider);
		this.logService.trace(`[AiProviderManager] Registered AI provider: ${provider.name}`);
		
		return {
			dispose: () => {
				this.providers.delete(provider.id);
				provider.dispose();
			}
		};
	}

	/**
	 * Registers a code completion provider
	 */
	registerCodeCompletionProvider(provider: ICodeCompletionProvider): IDisposable {
		this.completionProviders.push(provider);
		this.logService.trace(`[AiProviderManager] Registered code completion provider: ${provider.name}`);
		
		return {
			dispose: () => {
				const index = this.completionProviders.indexOf(provider);
				if (index >= 0) {
					this.completionProviders.splice(index, 1);
				}
			}
		};
	}

	/**
	 * Registers a chat provider
	 */
	registerChatProvider(provider: IChatProvider): IDisposable {
		this.chatProviders.push(provider);
		this.logService.trace(`[AiProviderManager] Registered chat provider: ${provider.name}`);
		
		return {
			dispose: () => {
				const index = this.chatProviders.indexOf(provider);
				if (index >= 0) {
					this.chatProviders.splice(index, 1);
				}
			}
		};
	}

	/**
	 * Registers a code edit provider
	 */
	registerCodeEditProvider(provider: ICodeEditProvider): IDisposable {
		this.codeEditProviders.push(provider);
		this.logService.trace(`[AiProviderManager] Registered code edit provider: ${provider.name}`);
		
		return {
			dispose: () => {
				const index = this.codeEditProviders.indexOf(provider);
				if (index >= 0) {
					this.codeEditProviders.splice(index, 1);
				}
			}
		};
	}

	/**
	 * Checks if any providers are registered
	 */
	isEnabled(): boolean {
		return this.providers.size > 0;
	}

	/**
	 * Gets all completion providers
	 */
	getCompletionProviders(): ICodeCompletionProvider[] {
		return [...this.completionProviders];
	}

	/**
	 * Gets all chat providers
	 */
	getChatProviders(): IChatProvider[] {
		return [...this.chatProviders];
	}

	/**
	 * Gets all code edit providers
	 */
	getCodeEditProviders(): ICodeEditProvider[] {
		return [...this.codeEditProviders];
	}
}

/**
 * Handles result merging and deduplication
 */
class AiResultMerger {
	/**
	 * Merges multiple completion results into a single result
	 */
	static mergeCompletionResults(results: AiCompletionResult[]): AiCompletionResult {
		const allCompletions: AiCompletion[] = [];
		const metadata: Record<string, any> = {};

		for (const result of results) {
			allCompletions.push(...result.completions);
			if (result.metadata) {
				Object.assign(metadata, result.metadata);
			}
		}

		const uniqueCompletions = this.deduplicateCompletions(allCompletions);
		uniqueCompletions.sort((a, b) => b.score - a.score);

		return {
			completions: uniqueCompletions,
			metadata
		};
	}

	/**
	 * Merges multiple chat results into a single result
	 */
	static mergeChatResults(results: AiChatResponse[]): AiChatResponse {
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

	/**
	 * Merges multiple code edit results into a single result
	 */
	static mergeCodeEditResults(results: AiCodeEditResult[]): AiCodeEditResult {
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

	/**
	 * Removes duplicate completions based on text and position
	 */
	private static deduplicateCompletions(completions: AiCompletion[]): AiCompletion[] {
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

/**
 * Generates unique request IDs for tracking
 */
class RequestIdGenerator {
	private static counter = 0;

	static generate(): string {
		return `ai-${Date.now()}-${this.counter++}-${Math.random().toString(36).substr(2, 9)}`;
	}
}

// =============================================================================
// Main Service Implementation
// =============================================================================

/**
 * Core AI service that orchestrates all AI functionalities
 * Provides a unified interface for code completion, chat, and code editing
 */
export class AiCoreService extends Disposable implements IAiCoreService {
	readonly _serviceBrand: undefined;

	private readonly providerManager: AiProviderManager;
	private readonly requestIdGenerator = RequestIdGenerator;

	// Events
	private readonly _onAiResponse = this._register(new Emitter<AiResponseEvent>());
	readonly onAiResponse: Event<AiResponseEvent> = this._onAiResponse.event;

	private readonly _onAiError = this._register(new Emitter<AiErrorEvent>());
	readonly onAiError: Event<AiErrorEvent> = this._onAiError.event;

	private readonly _onContextChanged = this._register(new Emitter<AiContextChangeEvent>());
	readonly onContextChanged: Event<AiContextChangeEvent> = this._onContextChanged.event;

	constructor(@ILogService private readonly logService: ILogService) {
		super();
		this.providerManager = this._register(new AiProviderManager(logService));
	}

	// =============================================================================
	// Public Interface Methods
	// =============================================================================

	/**
	 * Checks if AI functionality is enabled
	 */
	isEnabled(): boolean {
		return this.providerManager.isEnabled();
	}

	/**
	 * Registers a general AI provider
	 */
	registerAiProvider(provider: IAiProvider): IDisposable {
		return this.providerManager.registerAiProvider(provider);
	}

	/**
	 * Registers a code completion provider
	 */
	registerCodeCompletionProvider(provider: ICodeCompletionProvider): IDisposable {
		return this.providerManager.registerCodeCompletionProvider(provider);
	}

	/**
	 * Registers a chat provider
	 */
	registerChatProvider(provider: IChatProvider): IDisposable {
		return this.providerManager.registerChatProvider(provider);
	}

	/**
	 * Registers a code edit provider
	 */
	registerCodeEditProvider(provider: ICodeEditProvider): IDisposable {
		return this.providerManager.registerCodeEditProvider(provider);
	}

	// =============================================================================
	// AI Operation Methods
	// =============================================================================

	/**
	 * Gets code completions from all registered providers
	 */
	async getCompletion(query: string, context: AiContext, token: CancellationToken): Promise<AiCompletionResult> {
		const stopwatch = StopWatch.create();
		const requestId = this.requestIdGenerator.generate();

		try {
			this.validateProvidersExist('completion');
			const providers = this.providerManager.getCompletionProviders();
			const results = await this.executeWithProviders(providers, provider => 
				provider.provideCompletion(query, context, token)
			);
			const mergedResult = AiResultMerger.mergeCompletionResults(results);
			
			this.fireResponseEvent(requestId, 'completion', mergedResult, stopwatch.elapsed());
			return mergedResult;
		} catch (error) {
			this.fireErrorEvent(requestId, error as Error, 'getCompletion');
			throw error;
		}
	}

	/**
	 * Gets chat responses from all registered providers
	 */
	async getChatResponse(message: string, context: AiContext, token: CancellationToken): Promise<AiChatResponse> {
		const stopwatch = StopWatch.create();
		const requestId = this.requestIdGenerator.generate();

		try {
			this.validateProvidersExist('chat');
			const providers = this.providerManager.getChatProviders();
			const results = await this.executeWithProviders(providers, provider => 
				provider.provideChatResponse(message, context, token)
			);
			const mergedResult = AiResultMerger.mergeChatResults(results);
			
			this.fireResponseEvent(requestId, 'chat', mergedResult, stopwatch.elapsed());
			return mergedResult;
		} catch (error) {
			this.fireErrorEvent(requestId, error as Error, 'getChatResponse');
			throw error;
		}
	}

	/**
	 * Gets code edits from all registered providers
	 */
	async getCodeEdit(request: AiCodeEditRequest, token: CancellationToken): Promise<AiCodeEditResult> {
		const stopwatch = StopWatch.create();
		const requestId = this.requestIdGenerator.generate();

		try {
			this.validateProvidersExist('code edit');
			const providers = this.providerManager.getCodeEditProviders();
			const results = await this.executeWithProviders(providers, provider => 
				provider.provideCodeEdit(request, token)
			);
			const mergedResult = AiResultMerger.mergeCodeEditResults(results);
			
			this.fireResponseEvent(requestId, 'codeEdit', mergedResult, stopwatch.elapsed());
			return mergedResult;
		} catch (error) {
			this.fireErrorEvent(requestId, error as Error, 'getCodeEdit');
			throw error;
		}
	}

	// =============================================================================
	// Unimplemented Methods (Placeholders)
	// =============================================================================

	async getExplanation(code: string, context: AiContext, token: CancellationToken): Promise<AiExplanationResult> {
		throw new Error('Code explanation not implemented');
	}

	async getRefactoring(request: AiRefactoringRequest, token: CancellationToken): Promise<AiRefactoringResult> {
		throw new Error('Code refactoring not implemented');
	}

	async getBugFix(request: AiBugFixRequest, token: CancellationToken): Promise<AiBugFixResult> {
		throw new Error('Bug fixing not implemented');
	}

	async getTestGeneration(request: AiTestGenerationRequest, token: CancellationToken): Promise<AiTestGenerationResult> {
		throw new Error('Test generation not implemented');
	}

	async getDocumentation(request: AiDocumentationRequest, token: CancellationToken): Promise<AiDocumentationResult> {
		throw new Error('Documentation generation not implemented');
	}

	async getCodeReview(request: AiCodeReviewRequest, token: CancellationToken): Promise<AiCodeReviewResult> {
		throw new Error('Code review not implemented');
	}

	async getPerformanceOptimization(request: AiPerformanceRequest, token: CancellationToken): Promise<AiPerformanceResult> {
		throw new Error('Performance optimization not implemented');
	}

	async getSecurityAnalysis(request: AiSecurityRequest, token: CancellationToken): Promise<AiSecurityResult> {
		throw new Error('Security analysis not implemented');
	}

	async getWorkspaceContext(): Promise<AiWorkspaceContext> {
		throw new Error('Workspace context not implemented');
	}

	async getFileContext(uri: URI): Promise<AiFileContext> {
		throw new Error('File context not implemented');
	}

	async getSelectionContext(uri: URI, range: IRange): Promise<AiSelectionContext> {
		throw new Error('Selection context not implemented');
	}

	// =============================================================================
	// Private Helper Methods
	// =============================================================================

	/**
	 * Validates that providers exist for the given operation type
	 */
	private validateProvidersExist(operationType: string): void {
		const hasProviders = this.providerManager.isEnabled();
		if (!hasProviders) {
			throw new Error(`No AI providers registered for ${operationType}`);
		}
	}

	/**
	 * Executes operations with multiple providers and handles errors gracefully
	 */
	private async executeWithProviders<T>(
		providers: any[],
		operation: (provider: any) => Promise<T>
	): Promise<T[]> {
		const promises = providers.map(async (provider) => {
			try {
				return await operation(provider);
			} catch (error) {
				this.logService.warn(`[AiCoreService] Provider ${provider.name} failed:`, error);
				throw error;
			}
		});

		return Promise.all(promises);
	}

	/**
	 * Fires a response event with the given data
	 */
	private fireResponseEvent(requestId: string, type: string, result: any, duration: number): void {
		this._onAiResponse.fire({
			requestId,
			type,
			result,
			duration
		});
	}

	/**
	 * Fires an error event with the given error
	 */
	private fireErrorEvent(requestId: string, error: Error, context: string): void {
		this._onAiError.fire({
			requestId,
			error,
			context
		});
	}
}

// Register the service
registerSingleton(IAiCoreService, AiCoreService, InstantiationType.Delayed);