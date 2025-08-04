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

export class AiPanelWidget extends Disposable implements IAiPanelService {
	readonly _serviceBrand: undefined;

	private _container: HTMLElement | undefined;
	private _isVisible: boolean = false;
	private _isLoading: boolean = false;
	private _messageHistory: AiPanelMessage[] = [];
	private _currentRequestId: string | undefined;

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

		this._register(this.aiAssistantService.onAssistantResponse(this.handleAssistantResponse, this));
		this._register(this.aiAssistantService.onAssistantError(this.handleAssistantError, this));
	}

	showPanel(): void {
		if (this._isVisible) {
			return;
		}

		this._isVisible = true;
		this.createPanel();
		this._onPanelVisibilityChanged.fire(true);
	}

	hidePanel(): void {
		if (!this._isVisible) {
			return;
		}

		this._isVisible = false;
		this.destroyPanel();
		this._onPanelVisibilityChanged.fire(false);
	}

	togglePanel(): void {
		if (this._isVisible) {
			this.hidePanel();
		} else {
			this.showPanel();
		}
	}

	isVisible(): boolean {
		return this._isVisible;
	}

	async explainCode(code: string): Promise<void> {
		if (this._isLoading) {
			return;
		}

		this._isLoading = true;
		this.updateLoadingState();

		try {
			const stopwatch = StopWatch.create();
			const explanation = await this.aiAssistantService.explainCode(code);
			
			const response: AiPanelResponse = {
				type: 'explain',
				content: explanation,
				codeBlocks: [],
				suggestions: [],
				timestamp: Date.now(),
				duration: stopwatch.elapsed()
			};

			this.addMessage({
				type: 'user',
				content: `Explain this code:\n\n${code}`,
				timestamp: Date.now()
			});

			this.addMessage({
				type: 'assistant',
				content: explanation,
				timestamp: Date.now()
			});

			this._onResponseReceived.fire(response);
		} catch (error) {
			this.handleError('explainCode', error as Error);
		} finally {
			this._isLoading = false;
			this.updateLoadingState();
		}
	}

	async refactorCode(code: string, instruction: string): Promise<void> {
		if (this._isLoading) {
			return;
		}

		this._isLoading = true;
		this.updateLoadingState();

		try {
			const stopwatch = StopWatch.create();
			const refactoredCode = await this.aiAssistantService.refactorCode(code, instruction);
			
			const response: AiPanelResponse = {
				type: 'refactor',
				content: refactoredCode,
				codeBlocks: [refactoredCode],
				suggestions: [],
				timestamp: Date.now(),
				duration: stopwatch.elapsed()
			};

			this.addMessage({
				type: 'user',
				content: `Refactor this code: ${instruction}\n\n${code}`,
				timestamp: Date.now()
			});

			this.addMessage({
				type: 'assistant',
				content: refactoredCode,
				timestamp: Date.now()
			});

			this._onResponseReceived.fire(response);
		} catch (error) {
			this.handleError('refactorCode', error as Error);
		} finally {
			this._isLoading = false;
			this.updateLoadingState();
		}
	}

	async fixBug(code: string, error?: string): Promise<void> {
		if (this._isLoading) {
			return;
		}

		this._isLoading = true;
		this.updateLoadingState();

		try {
			const stopwatch = StopWatch.create();
			const fixedCode = await this.aiAssistantService.fixBug(code, error);
			
			const response: AiPanelResponse = {
				type: 'fix',
				content: fixedCode,
				codeBlocks: [fixedCode],
				suggestions: [],
				timestamp: Date.now(),
				duration: stopwatch.elapsed()
			};

			this.addMessage({
				type: 'user',
				content: `Fix this bug${error ? `: ${error}` : ''}\n\n${code}`,
				timestamp: Date.now()
			});

			this.addMessage({
				type: 'assistant',
				content: fixedCode,
				timestamp: Date.now()
			});

			this._onResponseReceived.fire(response);
		} catch (error) {
			this.handleError('fixBug', error as Error);
		} finally {
			this._isLoading = false;
			this.updateLoadingState();
		}
	}

	async generateTests(code: string, framework?: string): Promise<void> {
		if (this._isLoading) {
			return;
		}

		this._isLoading = true;
		this.updateLoadingState();

		try {
			const stopwatch = StopWatch.create();
			const tests = await this.aiAssistantService.generateTests(code, framework);
			
			const response: AiPanelResponse = {
				type: 'test',
				content: tests,
				codeBlocks: [tests],
				suggestions: [],
				timestamp: Date.now(),
				duration: stopwatch.elapsed()
			};

			this.addMessage({
				type: 'user',
				content: `Generate tests${framework ? ` using ${framework}` : ''} for this code:\n\n${code}`,
				timestamp: Date.now()
			});

			this.addMessage({
				type: 'assistant',
				content: tests,
				timestamp: Date.now()
			});

			this._onResponseReceived.fire(response);
		} catch (error) {
			this.handleError('generateTests', error as Error);
		} finally {
			this._isLoading = false;
			this.updateLoadingState();
		}
	}

	async reviewCode(code: string): Promise<void> {
		if (this._isLoading) {
			return;
		}

		this._isLoading = true;
		this.updateLoadingState();

		try {
			const stopwatch = StopWatch.create();
			const review = await this.aiAssistantService.reviewCode(code);
			
			const response: AiPanelResponse = {
				type: 'review',
				content: review.summary,
				codeBlocks: [],
				suggestions: review.suggestions.map(s => s.message),
				timestamp: Date.now(),
				duration: stopwatch.elapsed()
			};

			this.addMessage({
				type: 'user',
				content: `Review this code:\n\n${code}`,
				timestamp: Date.now()
			});

			this.addMessage({
				type: 'assistant',
				content: review.summary,
				timestamp: Date.now()
			});

			this._onResponseReceived.fire(response);
		} catch (error) {
			this.handleError('reviewCode', error as Error);
		} finally {
			this._isLoading = false;
			this.updateLoadingState();
		}
	}

	async optimizePerformance(code: string): Promise<void> {
		if (this._isLoading) {
			return;
		}

		this._isLoading = true;
		this.updateLoadingState();

		try {
			const stopwatch = StopWatch.create();
			const optimization = await this.aiAssistantService.optimizePerformance(code);
			
			const response: AiPanelResponse = {
				type: 'performance',
				content: optimization.summary,
				codeBlocks: [],
				suggestions: optimization.optimizations.map(o => o.description),
				timestamp: Date.now(),
				duration: stopwatch.elapsed()
			};

			this.addMessage({
				type: 'user',
				content: `Optimize performance of this code:\n\n${code}`,
				timestamp: Date.now()
			});

			this.addMessage({
				type: 'assistant',
				content: optimization.summary,
				timestamp: Date.now()
			});

			this._onResponseReceived.fire(response);
		} catch (error) {
			this.handleError('optimizePerformance', error as Error);
		} finally {
			this._isLoading = false;
			this.updateLoadingState();
		}
	}

	async analyzeSecurity(code: string): Promise<void> {
		if (this._isLoading) {
			return;
		}

		this._isLoading = true;
		this.updateLoadingState();

		try {
			const stopwatch = StopWatch.create();
			const security = await this.aiAssistantService.analyzeSecurity(code);
			
			const response: AiPanelResponse = {
				type: 'security',
				content: security.summary,
				codeBlocks: [],
				suggestions: security.recommendations.map(r => r.description),
				timestamp: Date.now(),
				duration: stopwatch.elapsed()
			};

			this.addMessage({
				type: 'user',
				content: `Analyze security of this code:\n\n${code}`,
				timestamp: Date.now()
			});

			this.addMessage({
				type: 'assistant',
				content: security.summary,
				timestamp: Date.now()
			});

			this._onResponseReceived.fire(response);
		} catch (error) {
			this.handleError('analyzeSecurity', error as Error);
		} finally {
			this._isLoading = false;
			this.updateLoadingState();
		}
	}

	async sendMessage(message: string): Promise<void> {
		if (this._isLoading || !message.trim()) {
			return;
		}

		this._isLoading = true;
		this.updateLoadingState();

		try {
			const stopwatch = StopWatch.create();
			const response = await this.aiAssistantService.chat(message);
			
			const aiResponse: AiPanelResponse = {
				type: 'chat',
				content: response.message,
				codeBlocks: response.codeBlocks.map(block => block.code),
				suggestions: response.suggestions,
				timestamp: Date.now(),
				duration: stopwatch.elapsed()
			};

			this.addMessage({
				type: 'user',
				content: message,
				timestamp: Date.now()
			});

			this.addMessage({
				type: 'assistant',
				content: response.message,
				timestamp: Date.now()
			});

			this._onMessageSent.fire(message);
			this._onResponseReceived.fire(aiResponse);
		} catch (error) {
			this.handleError('sendMessage', error as Error);
		} finally {
			this._isLoading = false;
			this.updateLoadingState();
		}
	}

	clearHistory(): void {
		this._messageHistory = [];
		this.updateMessageHistory();
	}

	private createPanel(): void {
		if (this._container) {
			return;
		}

		this._container = document.createElement('div');
		this._container.className = 'ai-panel';
		this._container.style.cssText = `
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

		this.createHeader();
		this.createContent();
		this.createInput();

		document.body.appendChild(this._container);
	}

	private createHeader(): void {
		const header = document.createElement('div');
		header.className = 'ai-panel-header';
		header.style.cssText = `
			padding: 10px 15px;
			border-bottom: 1px solid var(--vscode-panel-border);
			display: flex;
			justify-content: space-between;
			align-items: center;
			background: var(--vscode-panel-background);
		`;

		const title = document.createElement('h3');
		title.textContent = 'AI Assistant';
		title.style.cssText = `
			margin: 0;
			color: var(--vscode-foreground);
			font-size: 14px;
			font-weight: 600;
		`;

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
		closeButton.onclick = () => this.hidePanel();

		header.appendChild(title);
		header.appendChild(closeButton);
		this._container!.appendChild(header);
	}

	private createContent(): void {
		const content = document.createElement('div');
		content.className = 'ai-panel-content';
		content.style.cssText = `
			flex: 1;
			overflow-y: auto;
			padding: 15px;
			display: flex;
			flex-direction: column;
			gap: 15px;
		`;

		this._container!.appendChild(content);
		this.updateMessageHistory();
	}

	private createInput(): void {
		const inputContainer = document.createElement('div');
		inputContainer.className = 'ai-panel-input';
		inputContainer.style.cssText = `
			padding: 15px;
			border-top: 1px solid var(--vscode-panel-border);
			background: var(--vscode-panel-background);
		`;

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

		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				this.sendMessage(input.value);
				input.value = '';
			}
		});

		const buttonContainer = document.createElement('div');
		buttonContainer.style.cssText = `
			display: flex;
			gap: 8px;
			margin-top: 8px;
		`;

		const sendButton = document.createElement('button');
		sendButton.textContent = 'Send';
		sendButton.style.cssText = `
			padding: 6px 12px;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: inherit;
		`;
		sendButton.onclick = () => {
			this.sendMessage(input.value);
			input.value = '';
		};

		const clearButton = document.createElement('button');
		clearButton.textContent = 'Clear';
		clearButton.style.cssText = `
			padding: 6px 12px;
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: inherit;
		`;
		clearButton.onclick = () => this.clearHistory();

		buttonContainer.appendChild(sendButton);
		buttonContainer.appendChild(clearButton);
		inputContainer.appendChild(input);
		inputContainer.appendChild(buttonContainer);
		this._container!.appendChild(inputContainer);
	}

	private destroyPanel(): void {
		if (this._container) {
			this._container.remove();
			this._container = undefined;
		}
	}

	private addMessage(message: AiPanelMessage): void {
		this._messageHistory.push(message);
		this.updateMessageHistory();
	}

	private updateMessageHistory(): void {
		if (!this._container) {
			return;
		}

		const content = this._container.querySelector('.ai-panel-content') as HTMLElement;
		if (!content) {
			return;
		}

		content.innerHTML = '';

		this._messageHistory.forEach(message => {
			const messageElement = this.createMessageElement(message);
			content.appendChild(messageElement);
		});

		content.scrollTop = content.scrollHeight;
	}

	private createMessageElement(message: AiPanelMessage): HTMLElement {
		const messageContainer = document.createElement('div');
		messageContainer.className = `ai-message ai-message-${message.type}`;
		messageContainer.style.cssText = `
			padding: 10px;
			border-radius: 8px;
			margin-bottom: 10px;
			max-width: 100%;
			word-wrap: break-word;
		`;

		if (message.type === 'user') {
			messageContainer.style.cssText += `
				background: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
				margin-left: 20px;
			`;
		} else {
			messageContainer.style.cssText += `
				background: var(--vscode-editor-background);
				color: var(--vscode-foreground);
				border: 1px solid var(--vscode-panel-border);
				margin-right: 20px;
			`;
		}

		const content = document.createElement('div');
		content.innerHTML = this.formatMessageContent(message.content);
		content.style.cssText = `
			line-height: 1.4;
			white-space: pre-wrap;
		`;

		const timestamp = document.createElement('div');
		timestamp.textContent = new Date(message.timestamp).toLocaleTimeString();
		timestamp.style.cssText = `
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			margin-top: 4px;
			text-align: right;
		`;

		messageContainer.appendChild(content);
		messageContainer.appendChild(timestamp);

		return messageContainer;
	}

	private formatMessageContent(content: string): string {
		// Simple markdown-like formatting
		return content
			.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.*?)\*/g, '<em>$1</em>')
			.replace(/`(.*?)`/g, '<code>$1</code>')
			.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
	}

	private updateLoadingState(): void {
		if (!this._container) {
			return;
		}

		const content = this._container.querySelector('.ai-panel-content') as HTMLElement;
		if (!content) {
			return;
		}

		const loadingElement = content.querySelector('.ai-loading');
		if (this._isLoading && !loadingElement) {
			const loading = document.createElement('div');
			loading.className = 'ai-loading';
			loading.innerHTML = `
				<div style="display: flex; align-items: center; gap: 8px; padding: 10px;">
					<div style="width: 16px; height: 16px; border: 2px solid var(--vscode-progressBar-background); border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
					<span>AI is thinking...</span>
				</div>
			`;
			loading.style.cssText = `
				background: var(--vscode-editor-background);
				border: 1px solid var(--vscode-panel-border);
				border-radius: 8px;
				margin: 10px 0;
			`;
			content.appendChild(loading);
		} else if (!this._isLoading && loadingElement) {
			loadingElement.remove();
		}
	}

	private handleAssistantResponse(event: any): void {
		// Handle assistant response events
		this.logService.trace('[AiPanelWidget] Assistant response received:', event);
	}

	private handleAssistantError(event: any): void {
		// Handle assistant error events
		this.logService.error('[AiPanelWidget] Assistant error:', event);
		this.handleError(event.context, event.error);
	}

	private handleError(context: string, error: Error): void {
		this._onError.fire({
			message: error.message,
			context,
			timestamp: Date.now()
		});

		this.addMessage({
			type: 'assistant',
			content: `Sorry, I encountered an error: ${error.message}`,
			timestamp: Date.now()
		});
	}
}

interface AiPanelMessage {
	type: 'user' | 'assistant';
	content: string;
	timestamp: number;
}