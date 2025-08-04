/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import { Disposable, DisposableStore, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ICodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { URI } from '../../../../base/common/uri.js';
import { IRange } from '../../../../editor/common/core/range.js';
import { IAiAssistantService, AiChatResponse, AiCodeReviewResult, AiPerformanceResult, AiSecurityResult } from '../../services/aiAssistant/common/aiAssistantService.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { StopWatch } from '../../../../base/common/stopwatch.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

// =============================================================================
// Service Interface
// =============================================================================

export const IAiPanelService = createDecorator<IAiPanelService>('IAiPanelService');

export interface IAiPanelService {
	readonly _serviceBrand: undefined;

	// Panel management
	showPanel(): void;
	hidePanel(): void;
	togglePanel(): void;
	isVisible(): boolean;

	// AI operations
	explainCode(code: string): Promise<void>;
	refactorCode(code: string, instruction: string): Promise<void>;
	fixBug(code: string, error?: string): Promise<void>;
	generateTests(code: string, framework?: string): Promise<void>;
	reviewCode(code: string): Promise<void>;
	optimizePerformance(code: string): Promise<void>;
	analyzeSecurity(code: string): Promise<void>;

	// Chat functionality
	sendMessage(message: string): Promise<void>;
	clearHistory(): void;

	// Events
	readonly onPanelVisibilityChanged: Event<boolean>;
	readonly onMessageSent: Event<string>;
	readonly onResponseReceived: Event<AiPanelResponse>;
	readonly onError: Event<AiPanelError>;
}

// =============================================================================
// Data Interfaces
// =============================================================================

export interface AiPanelResponse {
	type: 'chat' | 'explain' | 'refactor' | 'fix' | 'test' | 'review' | 'performance' | 'security';
	content: string;
	codeBlocks: string[];
	suggestions: string[];
	timestamp: number;
	duration: number;
}

export interface AiPanelError {
	message: string;
	context: string;
	timestamp: number;
}

export interface AiPanelOptions {
	theme?: 'light' | 'dark' | 'auto';
	position?: 'right' | 'left' | 'bottom';
	size?: number;
	showCodeBlocks?: boolean;
	showSuggestions?: boolean;
	enableVoice?: boolean;
}

export interface AiPanelMessage {
	type: 'user' | 'assistant';
	content: string;
	timestamp: number;
}

// =============================================================================
// Utility Classes
// =============================================================================

/**
 * Manages the AI panel's visual state and DOM elements
 */
class AiPanelRenderer extends Disposable {
	private container: HTMLElement | undefined;
	private readonly options: AiPanelOptions;

	constructor(options: AiPanelOptions = {}) {
		super();
		this.options = options;
	}

	/**
	 * Creates the main panel container
	 */
	createPanel(): HTMLElement {
		if (this.container) {
			return this.container;
		}

		this.container = document.createElement('div');
		this.container.className = 'ai-panel';
		this.applyPanelStyles();

		document.body.appendChild(this.container);
		return this.container;
	}

	/**
	 * Destroys the panel container
	 */
	destroyPanel(): void {
		if (this.container) {
			this.container.remove();
			this.container = undefined;
		}
	}

	/**
	 * Creates the panel header
	 */
	createHeader(onClose: () => void): HTMLElement {
		const header = document.createElement('div');
		header.className = 'ai-panel-header';
		this.applyHeaderStyles(header);

		const title = this.createHeaderTitle();
		const closeButton = this.createCloseButton(onClose);

		header.appendChild(title);
		header.appendChild(closeButton);
		return header;
	}

	/**
	 * Creates the panel content area
	 */
	createContent(): HTMLElement {
		const content = document.createElement('div');
		content.className = 'ai-panel-content';
		this.applyContentStyles(content);
		return content;
	}

	/**
	 * Creates the panel input area
	 */
	createInput(onSend: (message: string) => void, onClear: () => void): HTMLElement {
		const inputContainer = document.createElement('div');
		inputContainer.className = 'ai-panel-input';
		this.applyInputContainerStyles(inputContainer);

		const input = this.createTextArea();
		const buttonContainer = this.createButtonContainer(input, onSend, onClear);

		inputContainer.appendChild(input);
		inputContainer.appendChild(buttonContainer);
		return inputContainer;
	}

	/**
	 * Creates a message element
	 */
	createMessageElement(message: AiPanelMessage): HTMLElement {
		const messageContainer = document.createElement('div');
		messageContainer.className = `ai-message ai-message-${message.type}`;
		this.applyMessageStyles(messageContainer, message.type);

		const content = this.createMessageContent(message.content);
		const timestamp = this.createMessageTimestamp(message.timestamp);

		messageContainer.appendChild(content);
		messageContainer.appendChild(timestamp);

		return messageContainer;
	}

	/**
	 * Creates a loading indicator
	 */
	createLoadingIndicator(): HTMLElement {
		const loading = document.createElement('div');
		loading.className = 'ai-loading';
		loading.innerHTML = `
			<div style="display: flex; align-items: center; gap: 8px; padding: 10px;">
				<div style="width: 16px; height: 16px; border: 2px solid var(--vscode-progressBar-background); border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
				<span>AI is thinking...</span>
			</div>
		`;
		this.applyLoadingStyles(loading);
		return loading;
	}

	/**
	 * Updates the message history display
	 */
	updateMessageHistory(container: HTMLElement, messages: AiPanelMessage[]): void {
		container.innerHTML = '';
		messages.forEach(message => {
			const messageElement = this.createMessageElement(message);
			container.appendChild(messageElement);
		});
		container.scrollTop = container.scrollHeight;
	}

	/**
	 * Updates the loading state
	 */
	updateLoadingState(container: HTMLElement, isLoading: boolean): void {
		const existingLoading = container.querySelector('.ai-loading');
		
		if (isLoading && !existingLoading) {
			const loading = this.createLoadingIndicator();
			container.appendChild(loading);
		} else if (!isLoading && existingLoading) {
			existingLoading.remove();
		}
	}

	// =============================================================================
	// Private Helper Methods
	// =============================================================================

	private applyPanelStyles(): void {
		if (!this.container) return;
		
		this.container.style.cssText = `
			position: fixed;
			top: 0;
			right: 0;
			width: ${this.options.size || 400}px;
			height: 100vh;
			background: var(--vscode-panel-background);
			border-left: 1px solid var(--vscode-panel-border);
			z-index: 1000;
			display: flex;
			flex-direction: column;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
		`;
	}

	private applyHeaderStyles(header: HTMLElement): void {
		header.style.cssText = `
			padding: 10px 15px;
			border-bottom: 1px solid var(--vscode-panel-border);
			display: flex;
			justify-content: space-between;
			align-items: center;
			background: var(--vscode-panel-background);
		`;
	}

	private createHeaderTitle(): HTMLElement {
		const title = document.createElement('h3');
		title.textContent = 'AI Assistant';
		title.style.cssText = `
			margin: 0;
			color: var(--vscode-foreground);
			font-size: 14px;
			font-weight: 600;
		`;
		return title;
	}

	private createCloseButton(onClose: () => void): HTMLElement {
		const closeButton = document.createElement('button');
		closeButton.innerHTML = '✕';
		closeButton.style.cssText = `
			background: none;
			border: none;
			color: var(--vscode-foreground);
			cursor: pointer;
			font-size: 16px;
			padding: 0;
			width: 24px;
			height: 24px;
			display: flex;
			align-items: center;
			justify-content: center;
		`;
		closeButton.onclick = onClose;
		return closeButton;
	}

	private applyContentStyles(content: HTMLElement): void {
		content.style.cssText = `
			flex: 1;
			overflow-y: auto;
			padding: 15px;
			display: flex;
			flex-direction: column;
			gap: 15px;
		`;
	}

	private applyInputContainerStyles(container: HTMLElement): void {
		container.style.cssText = `
			padding: 15px;
			border-top: 1px solid var(--vscode-panel-border);
			background: var(--vscode-panel-background);
		`;
	}

	private createTextArea(): HTMLTextAreaElement {
		const input = document.createElement('textarea');
		input.placeholder = 'Ask me anything about your code...';
		input.style.cssText = `
			width: 100%;
			min-height: 60px;
			padding: 8px 12px;
			border: 1px solid var(--vscode-input-border);
			border-radius: 4px;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			font-family: inherit;
			font-size: inherit;
			resize: vertical;
			outline: none;
		`;
		return input;
	}

	private createButtonContainer(input: HTMLTextAreaElement, onSend: (message: string) => void, onClear: () => void): HTMLElement {
		const buttonContainer = document.createElement('div');
		buttonContainer.style.cssText = `
			display: flex;
			gap: 8px;
			margin-top: 8px;
		`;

		const sendButton = this.createButton('Send', 'primary', () => {
			onSend(input.value);
			input.value = '';
		});

		const clearButton = this.createButton('Clear', 'secondary', onClear);

		buttonContainer.appendChild(sendButton);
		buttonContainer.appendChild(clearButton);
		return buttonContainer;
	}

	private createButton(text: string, type: 'primary' | 'secondary', onClick: () => void): HTMLElement {
		const button = document.createElement('button');
		button.textContent = text;
		
		const baseStyles = `
			padding: 6px 12px;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: inherit;
		`;

		if (type === 'primary') {
			button.style.cssText = baseStyles + `
				background: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
			`;
		} else {
			button.style.cssText = baseStyles + `
				background: var(--vscode-button-secondaryBackground);
				color: var(--vscode-button-secondaryForeground);
			`;
		}

		button.onclick = onClick;
		return button;
	}

	private applyMessageStyles(container: HTMLElement, type: 'user' | 'assistant'): void {
		const baseStyles = `
			padding: 10px;
			border-radius: 8px;
			margin-bottom: 10px;
			max-width: 100%;
			word-wrap: break-word;
		`;

		if (type === 'user') {
			container.style.cssText = baseStyles + `
				background: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
				margin-left: 20px;
			`;
		} else {
			container.style.cssText = baseStyles + `
				background: var(--vscode-editor-background);
				color: var(--vscode-foreground);
				border: 1px solid var(--vscode-panel-border);
				margin-right: 20px;
			`;
		}
	}

	private createMessageContent(content: string): HTMLElement {
		const contentElement = document.createElement('div');
		contentElement.innerHTML = this.formatMessageContent(content);
		contentElement.style.cssText = `
			line-height: 1.4;
			white-space: pre-wrap;
		`;
		return contentElement;
	}

	private createMessageTimestamp(timestamp: number): HTMLElement {
		const timestampElement = document.createElement('div');
		timestampElement.textContent = new Date(timestamp).toLocaleTimeString();
		timestampElement.style.cssText = `
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			margin-top: 4px;
			text-align: right;
		`;
		return timestampElement;
	}

	private applyLoadingStyles(loading: HTMLElement): void {
		loading.style.cssText = `
			background: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 8px;
			margin: 10px 0;
		`;
	}

	private formatMessageContent(content: string): string {
		// Simple markdown-like formatting
		return content
			.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.*?)\*/g, '<em>$1</em>')
			.replace(/`(.*?)`/g, '<code>$1</code>')
			.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
	}
}

/**
 * Manages AI operations and their execution
 */
class AiOperationManager {
	constructor(
		private readonly aiAssistantService: IAiAssistantService,
		private readonly logService: ILogService,
		private readonly onResponse: (response: AiPanelResponse) => void,
		private readonly onError: (error: AiPanelError) => void
	) {}

	/**
	 * Executes an AI operation with consistent error handling
	 */
	async executeOperation<T>(
		operationType: string,
		operation: () => Promise<T>,
		userMessage: string,
		formatResponse: (result: T) => AiPanelResponse
	): Promise<void> {
		const stopwatch = StopWatch.create();

		try {
			const result = await operation();
			const response = formatResponse(result);
			response.duration = stopwatch.elapsed();
			
			this.onResponse(response);
		} catch (error) {
			this.handleError(operationType, error as Error);
		}
	}

	/**
	 * Handles errors from AI operations
	 */
	private handleError(context: string, error: Error): void {
		this.logService.error(`[AiOperationManager] Error in ${context}:`, error);
		
		this.onError({
			message: error.message,
			context,
			timestamp: Date.now()
		});
	}
}

/**
 * Manages message history and state
 */
class MessageHistoryManager {
	private messages: AiPanelMessage[] = [];

	/**
	 * Adds a message to the history
	 */
	addMessage(message: AiPanelMessage): void {
		this.messages.push(message);
	}

	/**
	 * Gets all messages
	 */
	getMessages(): AiPanelMessage[] {
		return [...this.messages];
	}

	/**
	 * Clears the message history
	 */
	clearHistory(): void {
		this.messages = [];
	}

	/**
	 * Gets the number of messages
	 */
	getMessageCount(): number {
		return this.messages.length;
	}
}

// =============================================================================
// Main Service Implementation
// =============================================================================

/**
 * AI Panel Widget that provides a chat interface for AI interactions
 * Similar to Cursor's AI chat panel with modern UI and functionality
 */
export class AiPanelWidget extends Disposable implements IAiPanelService {
	readonly _serviceBrand: undefined;

	private isVisible: boolean = false;
	private isLoading: boolean = false;
	private currentRequestId: string | undefined;

	private readonly renderer: AiPanelRenderer;
	private readonly operationManager: AiOperationManager;
	private readonly messageHistory: MessageHistoryManager;

	// Events
	private readonly _onPanelVisibilityChanged = this._register(new Emitter<boolean>());
	readonly onPanelVisibilityChanged: Event<boolean> = this._onPanelVisibilityChanged.event;

	private readonly _onMessageSent = this._register(new Emitter<string>());
	readonly onMessageSent: Event<string> = this._onMessageSent.event;

	private readonly _onResponseReceived = this._register(new Emitter<AiPanelResponse>());
	readonly onResponseReceived: Event<AiPanelResponse> = this._onResponseReceived.event;

	private readonly _onError = this._register(new Emitter<AiPanelError>());
	readonly onError: Event<AiPanelError> = this._onError.event;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
		@IThemeService private readonly themeService: IThemeService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ICommandService private readonly commandService: ICommandService,
		@IEditorService private readonly editorService: IEditorService,
		@IAiAssistantService private readonly aiAssistantService: IAiAssistantService,
		private readonly options: AiPanelOptions = {}
	) {
		super();

		this.renderer = this._register(new AiPanelRenderer(options));
		this.messageHistory = new MessageHistoryManager();
		this.operationManager = new AiOperationManager(
			this.aiAssistantService,
			this.logService,
			(response) => this._onResponseReceived.fire(response),
			(error) => this._onError.fire(error)
		);

		this._register(this.aiAssistantService.onAssistantResponse(this.handleAssistantResponse, this));
		this._register(this.aiAssistantService.onAssistantError(this.handleAssistantError, this));
	}

	// =============================================================================
	// Panel Management
	// =============================================================================

	/**
	 * Shows the AI panel
	 */
	showPanel(): void {
		if (this.isVisible) {
			return;
		}

		this.isVisible = true;
		this.createPanel();
		this._onPanelVisibilityChanged.fire(true);
	}

	/**
	 * Hides the AI panel
	 */
	hidePanel(): void {
		if (!this.isVisible) {
			return;
		}

		this.isVisible = false;
		this.renderer.destroyPanel();
		this._onPanelVisibilityChanged.fire(false);
	}

	/**
	 * Toggles the AI panel visibility
	 */
	togglePanel(): void {
		if (this.isVisible) {
			this.hidePanel();
		} else {
			this.showPanel();
		}
	}

	/**
	 * Checks if the panel is visible
	 */
	isVisible(): boolean {
		return this.isVisible;
	}

	// =============================================================================
	// AI Operations
	// =============================================================================

	/**
	 * Explains the given code
	 */
	async explainCode(code: string): Promise<void> {
		if (this.isLoading) return;

		this.setLoadingState(true);
		this.addUserMessage(`Explain this code:\n\n${code}`);

		await this.operationManager.executeOperation(
			'explainCode',
			() => this.aiAssistantService.explainCode(code),
			`Explain this code:\n\n${code}`,
			(explanation) => ({
				type: 'explain',
				content: explanation,
				codeBlocks: [],
				suggestions: [],
				timestamp: Date.now(),
				duration: 0
			})
		);

		this.setLoadingState(false);
	}

	/**
	 * Refactors code according to the given instruction
	 */
	async refactorCode(code: string, instruction: string): Promise<void> {
		if (this.isLoading) return;

		this.setLoadingState(true);
		this.addUserMessage(`Refactor this code: ${instruction}\n\n${code}`);

		await this.operationManager.executeOperation(
			'refactorCode',
			() => this.aiAssistantService.refactorCode(code, instruction),
			`Refactor this code: ${instruction}\n\n${code}`,
			(refactoredCode) => ({
				type: 'refactor',
				content: refactoredCode,
				codeBlocks: [refactoredCode],
				suggestions: [],
				timestamp: Date.now(),
				duration: 0
			})
		);

		this.setLoadingState(false);
	}

	/**
	 * Fixes bugs in the given code
	 */
	async fixBug(code: string, error?: string): Promise<void> {
		if (this.isLoading) return;

		this.setLoadingState(true);
		this.addUserMessage(`Fix this bug${error ? `: ${error}` : ''}\n\n${code}`);

		await this.operationManager.executeOperation(
			'fixBug',
			() => this.aiAssistantService.fixBug(code, error),
			`Fix this bug${error ? `: ${error}` : ''}\n\n${code}`,
			(fixedCode) => ({
				type: 'fix',
				content: fixedCode,
				codeBlocks: [fixedCode],
				suggestions: [],
				timestamp: Date.now(),
				duration: 0
			})
		);

		this.setLoadingState(false);
	}

	/**
	 * Generates tests for the given code
	 */
	async generateTests(code: string, framework?: string): Promise<void> {
		if (this.isLoading) return;

		this.setLoadingState(true);
		this.addUserMessage(`Generate tests${framework ? ` using ${framework}` : ''} for this code:\n\n${code}`);

		await this.operationManager.executeOperation(
			'generateTests',
			() => this.aiAssistantService.generateTests(code, framework),
			`Generate tests${framework ? ` using ${framework}` : ''} for this code:\n\n${code}`,
			(tests) => ({
				type: 'test',
				content: tests,
				codeBlocks: [tests],
				suggestions: [],
				timestamp: Date.now(),
				duration: 0
			})
		);

		this.setLoadingState(false);
	}

	/**
	 * Reviews the given code
	 */
	async reviewCode(code: string): Promise<void> {
		if (this.isLoading) return;

		this.setLoadingState(true);
		this.addUserMessage(`Review this code:\n\n${code}`);

		await this.operationManager.executeOperation(
			'reviewCode',
			() => this.aiAssistantService.reviewCode(code),
			`Review this code:\n\n${code}`,
			(review) => ({
				type: 'review',
				content: review.summary,
				codeBlocks: [],
				suggestions: review.suggestions.map(s => s.message),
				timestamp: Date.now(),
				duration: 0
			})
		);

		this.setLoadingState(false);
	}

	/**
	 * Optimizes performance of the given code
	 */
	async optimizePerformance(code: string): Promise<void> {
		if (this.isLoading) return;

		this.setLoadingState(true);
		this.addUserMessage(`Optimize performance of this code:\n\n${code}`);

		await this.operationManager.executeOperation(
			'optimizePerformance',
			() => this.aiAssistantService.optimizePerformance(code),
			`Optimize performance of this code:\n\n${code}`,
			(optimization) => ({
				type: 'performance',
				content: optimization.summary,
				codeBlocks: [],
				suggestions: optimization.optimizations.map(o => o.description),
				timestamp: Date.now(),
				duration: 0
			})
		);

		this.setLoadingState(false);
	}

	/**
	 * Analyzes security of the given code
	 */
	async analyzeSecurity(code: string): Promise<void> {
		if (this.isLoading) return;

		this.setLoadingState(true);
		this.addUserMessage(`Analyze security of this code:\n\n${code}`);

		await this.operationManager.executeOperation(
			'analyzeSecurity',
			() => this.aiAssistantService.analyzeSecurity(code),
			`Analyze security of this code:\n\n${code}`,
			(security) => ({
				type: 'security',
				content: security.summary,
				codeBlocks: [],
				suggestions: security.recommendations.map(r => r.description),
				timestamp: Date.now(),
				duration: 0
			})
		);

		this.setLoadingState(false);
	}

	// =============================================================================
	// Chat Functionality
	// =============================================================================

	/**
	 * Sends a chat message
	 */
	async sendMessage(message: string): Promise<void> {
		if (this.isLoading || !message.trim()) {
			return;
		}

		this.setLoadingState(true);
		this.addUserMessage(message);

		await this.operationManager.executeOperation(
			'sendMessage',
			() => this.aiAssistantService.chat(message),
			message,
			(response) => ({
				type: 'chat',
				content: response.message,
				codeBlocks: response.codeBlocks.map(block => block.code),
				suggestions: response.suggestions,
				timestamp: Date.now(),
				duration: 0
			})
		);

		this._onMessageSent.fire(message);
		this.setLoadingState(false);
	}

	/**
	 * Clears the message history
	 */
	clearHistory(): void {
		this.messageHistory.clearHistory();
		this.updateMessageDisplay();
	}

	// =============================================================================
	// Private Helper Methods
	// =============================================================================

	/**
	 * Creates the panel with all its components
	 */
	private createPanel(): void {
		const container = this.renderer.createPanel();
		
		const header = this.renderer.createHeader(() => this.hidePanel());
		const content = this.renderer.createContent();
		const input = this.renderer.createInput(
			(message) => this.sendMessage(message),
			() => this.clearHistory()
		);

		container.appendChild(header);
		container.appendChild(content);
		container.appendChild(input);

		this.updateMessageDisplay();
	}

	/**
	 * Sets the loading state
	 */
	private setLoadingState(loading: boolean): void {
		this.isLoading = loading;
		this.updateLoadingDisplay();
	}

	/**
	 * Adds a user message to the history
	 */
	private addUserMessage(content: string): void {
		this.messageHistory.addMessage({
			type: 'user',
			content,
			timestamp: Date.now()
		});
		this.updateMessageDisplay();
	}

	/**
	 * Adds an assistant message to the history
	 */
	private addAssistantMessage(content: string): void {
		this.messageHistory.addMessage({
			type: 'assistant',
			content,
			timestamp: Date.now()
		});
		this.updateMessageDisplay();
	}

	/**
	 * Updates the message display
	 */
	private updateMessageDisplay(): void {
		const container = document.querySelector('.ai-panel-content') as HTMLElement;
		if (container) {
			this.renderer.updateMessageHistory(container, this.messageHistory.getMessages());
		}
	}

	/**
	 * Updates the loading display
	 */
	private updateLoadingDisplay(): void {
		const container = document.querySelector('.ai-panel-content') as HTMLElement;
		if (container) {
			this.renderer.updateLoadingState(container, this.isLoading);
		}
	}

	/**
	 * Handles assistant response events
	 */
	private handleAssistantResponse(event: any): void {
		this.logService.trace('[AiPanelWidget] Assistant response received:', event);
	}

	/**
	 * Handles assistant error events
	 */
	private handleAssistantError(event: any): void {
		this.logService.error('[AiPanelWidget] Assistant error:', event);
		this.handleError(event.context, event.error);
	}

	/**
	 * Handles errors
	 */
	private handleError(context: string, error: Error): void {
		this._onError.fire({
			message: error.message,
			context,
			timestamp: Date.now()
		});

		this.addAssistantMessage(`Sorry, I encountered an error: ${error.message}`);
	}
}