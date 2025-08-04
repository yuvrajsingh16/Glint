/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import { Disposable, DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ICodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { isCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { IEditorContribution } from '../../../../editor/common/editorCommon.js';
import { IPosition, Position } from '../../../../editor/common/core/position.js';
import { IRange, Range } from '../../../../editor/common/core/range.js';
import { ISelection } from '../../../../editor/common/core/selection.js';
import { URI } from '../../../../base/common/uri.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { StopWatch } from '../../../../base/common/stopwatch.js';
import { IAiAssistantService } from '../../services/aiAssistant/common/aiAssistantService.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const IAiInlineService = createDecorator<IAiInlineService>('IAiInlineService');

export interface IAiInlineService {
	readonly _serviceBrand: undefined;

	// Inline AI operations
	showInlineChat(editor: ICodeEditor, position: IPosition): Promise<void>;
	showInlineCompletion(editor: ICodeEditor, position: IPosition): Promise<void>;
	showInlineEdit(editor: ICodeEditor, range: IRange, instruction: string): Promise<void>;
	showInlineExplanation(editor: ICodeEditor, range: IRange): Promise<void>;
	showInlineRefactor(editor: ICodeEditor, range: IRange, type: string): Promise<void>;
	hideInlineWidget(editor: ICodeEditor): void;

	// Events
	readonly onInlineWidgetShown: Event<AiInlineWidgetEvent>;
	readonly onInlineWidgetHidden: Event<AiInlineWidgetEvent>;
	readonly onInlineResponse: Event<AiInlineResponseEvent>;
	readonly onInlineError: Event<AiInlineErrorEvent>;
}

export interface AiInlineWidgetEvent {
	editor: ICodeEditor;
	position: IPosition;
	type: 'chat' | 'completion' | 'edit' | 'explanation' | 'refactor';
}

export interface AiInlineResponseEvent {
	editor: ICodeEditor;
	position: IPosition;
	response: string;
	type: string;
	duration: number;
}

export interface AiInlineErrorEvent {
	editor: ICodeEditor;
	error: Error;
	context: string;
}

export interface AiInlineWidgetOptions {
	theme?: 'light' | 'dark' | 'auto';
	position?: 'above' | 'below' | 'inline';
	size?: 'small' | 'medium' | 'large';
	showSuggestions?: boolean;
	enableVoice?: boolean;
}

export class AiInlineEditor extends Disposable implements IAiInlineService {
	readonly _serviceBrand: undefined;

	private readonly _widgets: Map<ICodeEditor, AiInlineWidget> = new Map();
	private readonly _isLoading: Map<ICodeEditor, boolean> = new Map();

	private readonly _onInlineWidgetShown = this._register(new Emitter<AiInlineWidgetEvent>());
	readonly onInlineWidgetShown: Event<AiInlineWidgetEvent> = this._onInlineWidgetShown.event;

	private readonly _onInlineWidgetHidden = this._register(new Emitter<AiInlineWidgetEvent>());
	readonly onInlineWidgetHidden: Event<AiInlineWidgetEvent> = this._onInlineWidgetHidden.event;

	private readonly _onInlineResponse = this._register(new Emitter<AiInlineResponseEvent>());
	readonly onInlineResponse: Event<AiInlineResponseEvent> = this._onInlineResponse.event;

	private readonly _onInlineError = this._register(new Emitter<AiInlineErrorEvent>());
	readonly onInlineError: Event<AiInlineErrorEvent> = this._onInlineError.event;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
		@IThemeService private readonly themeService: IThemeService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ICommandService private readonly commandService: ICommandService,
		@IEditorService private readonly editorService: IEditorService,
		@IAiAssistantService private readonly aiAssistantService: IAiAssistantService
	) {
		super();

		this._register(this.aiAssistantService.onAssistantResponse(this.handleAssistantResponse, this));
		this._register(this.aiAssistantService.onAssistantError(this.handleAssistantError, this));
	}

	async showInlineChat(editor: ICodeEditor, position: IPosition): Promise<void> {
		const widget = this.getOrCreateWidget(editor);
		await widget.showChat(position);
	}

	async showInlineCompletion(editor: ICodeEditor, position: IPosition): Promise<void> {
		const widget = this.getOrCreateWidget(editor);
		await widget.showCompletion(position);
	}

	async showInlineEdit(editor: ICodeEditor, range: IRange, instruction: string): Promise<void> {
		const widget = this.getOrCreateWidget(editor);
		await widget.showEdit(range, instruction);
	}

	async showInlineExplanation(editor: ICodeEditor, range: IRange): Promise<void> {
		const widget = this.getOrCreateWidget(editor);
		await widget.showExplanation(range);
	}

	async showInlineRefactor(editor: ICodeEditor, range: IRange, type: string): Promise<void> {
		const widget = this.getOrCreateWidget(editor);
		await widget.showRefactor(range, type);
	}

	hideInlineWidget(editor: ICodeEditor): void {
		const widget = this._widgets.get(editor);
		if (widget) {
			widget.hide();
		}
	}

	private getOrCreateWidget(editor: ICodeEditor): AiInlineWidget {
		let widget = this._widgets.get(editor);
		if (!widget) {
			widget = this.instantiationService.createInstance(AiInlineWidget, editor);
			this._widgets.set(editor, widget);
			
			this._register(widget.onShown((event) => {
				this._onInlineWidgetShown.fire({
					editor,
					position: event.position,
					type: event.type
				});
			}));

			this._register(widget.onHidden((event) => {
				this._onInlineWidgetHidden.fire({
					editor,
					position: event.position,
					type: event.type
				});
			}));

			this._register(widget.onResponse((event) => {
				this._onInlineResponse.fire({
					editor,
					position: event.position,
					response: event.response,
					type: event.type,
					duration: event.duration
				});
			}));

			this._register(widget.onError((event) => {
				this._onInlineError.fire({
					editor,
					error: event.error,
					context: event.context
				});
			}));
		}
		return widget;
	}

	private handleAssistantResponse(event: any): void {
		this.logService.trace('[AiInlineEditor] Assistant response received:', event);
	}

	private handleAssistantError(event: any): void {
		this.logService.error('[AiInlineEditor] Assistant error:', event);
	}
}

export class AiInlineWidget extends Disposable {
	private _container: HTMLElement | undefined;
	private _isVisible: boolean = false;
	private _isLoading: boolean = false;
	private _currentPosition: IPosition | undefined;
	private _currentType: string | undefined;

	private readonly _onShown = this._register(new Emitter<AiInlineWidgetEvent>());
	readonly onShown: Event<AiInlineWidgetEvent> = this._onShown.event;

	private readonly _onHidden = this._register(new Emitter<AiInlineWidgetEvent>());
	readonly onHidden: Event<AiInlineWidgetEvent> = this._onHidden.event;

	private readonly _onResponse = this._register(new Emitter<AiInlineResponseEvent>());
	readonly onResponse: Event<AiInlineResponseEvent> = this._onResponse.event;

	private readonly _onError = this._register(new Emitter<AiInlineErrorEvent>());
	readonly onError: Event<AiInlineErrorEvent> = this._onError.event;

	constructor(
		private readonly editor: ICodeEditor,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
		@IAiAssistantService private readonly aiAssistantService: IAiAssistantService
	) {
		super();

		this._register(this.editor.onDidChangeCursorPosition(() => {
			if (this._isVisible) {
				this.updatePosition();
			}
		}));

		this._register(this.editor.onDidChangeModelContent(() => {
			if (this._isVisible) {
				this.updatePosition();
			}
		}));
	}

	async showChat(position: IPosition): Promise<void> {
		this._currentPosition = position;
		this._currentType = 'chat';
		this.showWidget(position, 'chat');
	}

	async showCompletion(position: IPosition): Promise<void> {
		this._currentPosition = position;
		this._currentType = 'completion';
		this.showWidget(position, 'completion');
	}

	async showEdit(range: IRange, instruction: string): Promise<void> {
		this._currentPosition = new Position(range.startLineNumber, range.startColumn);
		this._currentType = 'edit';
		this.showWidget(this._currentPosition, 'edit');
	}

	async showExplanation(range: IRange): Promise<void> {
		this._currentPosition = new Position(range.startLineNumber, range.startColumn);
		this._currentType = 'explanation';
		this.showWidget(this._currentPosition, 'explanation');
	}

	async showRefactor(range: IRange, type: string): Promise<void> {
		this._currentPosition = new Position(range.startLineNumber, range.startColumn);
		this._currentType = 'refactor';
		this.showWidget(this._currentPosition, 'refactor');
	}

	hide(): void {
		if (!this._isVisible) {
			return;
		}

		this._isVisible = false;
		this.destroyWidget();
		this._onHidden.fire({
			position: this._currentPosition!,
			type: this._currentType!
		});
	}

	private showWidget(position: IPosition, type: string): void {
		if (this._isVisible) {
			this.destroyWidget();
		}

		this._isVisible = true;
		this.createWidget(position, type);
		this._onShown.fire({
			position,
			type
		});
	}

	private createWidget(position: IPosition, type: string): void {
		this._container = document.createElement('div');
		this._container.className = 'ai-inline-widget';
		this._container.style.cssText = `
			position: absolute;
			background: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 6px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
			z-index: 1000;
			min-width: 300px;
			max-width: 500px;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-foreground);
		`;

		this.createHeader(type);
		this.createContent(type);
		this.createInput(type);

		this.updatePosition();
		this.editor.getDomNode()?.appendChild(this._container);
	}

	private createHeader(type: string): void {
		const header = document.createElement('div');
		header.className = 'ai-inline-header';
		header.style.cssText = `
			padding: 8px 12px;
			border-bottom: 1px solid var(--vscode-panel-border);
			display: flex;
			justify-content: space-between;
			align-items: center;
			background: var(--vscode-panel-background);
			border-radius: 6px 6px 0 0;
		`;

		const title = document.createElement('span');
		title.textContent = this.getTitle(type);
		title.style.cssText = `
			font-weight: 600;
			font-size: 12px;
		`;

		const closeButton = document.createElement('button');
		closeButton.innerHTML = '✕';
		closeButton.style.cssText = `
			background: none;
			border: none;
			color: var(--vscode-foreground);
			cursor: pointer;
			font-size: 12px;
			padding: 0;
			width: 16px;
			height: 16px;
			display: flex;
			align-items: center;
			justify-content: center;
		`;
		closeButton.onclick = () => this.hide();

		header.appendChild(title);
		header.appendChild(closeButton);
		this._container!.appendChild(header);
	}

	private createContent(type: string): void {
		const content = document.createElement('div');
		content.className = 'ai-inline-content';
		content.style.cssText = `
			padding: 12px;
			max-height: 200px;
			overflow-y: auto;
		`;

		const placeholder = document.createElement('div');
		placeholder.textContent = this.getPlaceholder(type);
		placeholder.style.cssText = `
			color: var(--vscode-descriptionForeground);
			font-style: italic;
			text-align: center;
			padding: 20px;
		`;

		content.appendChild(placeholder);
		this._container!.appendChild(content);
	}

	private createInput(type: string): void {
		const inputContainer = document.createElement('div');
		inputContainer.className = 'ai-inline-input';
		inputContainer.style.cssText = `
			padding: 8px 12px;
			border-top: 1px solid var(--vscode-panel-border);
			background: var(--vscode-panel-background);
			border-radius: 0 0 6px 6px;
		`;

		const input = document.createElement('textarea');
		input.placeholder = this.getInputPlaceholder(type);
		input.style.cssText = `
			width: 100%;
			min-height: 40px;
			padding: 6px 8px;
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
				this.handleInput(input.value, type);
				input.value = '';
			}
		});

		const buttonContainer = document.createElement('div');
		buttonContainer.style.cssText = `
			display: flex;
			gap: 6px;
			margin-top: 6px;
		`;

		const sendButton = document.createElement('button');
		sendButton.textContent = 'Send';
		sendButton.style.cssText = `
			padding: 4px 8px;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 11px;
		`;
		sendButton.onclick = () => {
			this.handleInput(input.value, type);
			input.value = '';
		};

		const cancelButton = document.createElement('button');
		cancelButton.textContent = 'Cancel';
		cancelButton.style.cssText = `
			padding: 4px 8px;
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 11px;
		`;
		cancelButton.onclick = () => this.hide();

		buttonContainer.appendChild(sendButton);
		buttonContainer.appendChild(cancelButton);
		inputContainer.appendChild(input);
		inputContainer.appendChild(buttonContainer);
		this._container!.appendChild(inputContainer);
	}

	private destroyWidget(): void {
		if (this._container) {
			this._container.remove();
			this._container = undefined;
		}
	}

	private updatePosition(): void {
		if (!this._container || !this._currentPosition) {
			return;
		}

		const editorDomNode = this.editor.getDomNode();
		if (!editorDomNode) {
			return;
		}

		const editorRect = editorDomNode.getBoundingClientRect();
		const position = this.editor.getScrolledVisiblePosition(this._currentPosition);
		
		if (!position) {
			return;
		}

		const top = position.top + position.height;
		const left = position.left;

		this._container.style.top = `${top}px`;
		this._container.style.left = `${left}px`;
	}

	private async handleInput(input: string, type: string): Promise<void> {
		if (!input.trim() || this._isLoading) {
			return;
		}

		this._isLoading = true;
		this.updateLoadingState();

		try {
			const stopwatch = StopWatch.create();
			let response: string;

			switch (type) {
				case 'chat':
					const chatResponse = await this.aiAssistantService.chat(input);
					response = chatResponse.message;
					break;
				case 'completion':
					response = await this.aiAssistantService.explainCode(input);
					break;
				case 'edit':
					response = await this.aiAssistantService.refactorCode(input, 'Improve this code');
					break;
				case 'explanation':
					response = await this.aiAssistantService.explainCode(input);
					break;
				case 'refactor':
					response = await this.aiAssistantService.refactorCode(input, 'Refactor this code');
					break;
				default:
					response = await this.aiAssistantService.chat(input);
			}

			this._onResponse.fire({
				position: this._currentPosition!,
				response,
				type,
				duration: stopwatch.elapsed()
			});

			this.updateContent(response);
		} catch (error) {
			this._onError.fire({
				error: error as Error,
				context: `handleInput-${type}`
			});
			this.updateContent(`Error: ${(error as Error).message}`);
		} finally {
			this._isLoading = false;
			this.updateLoadingState();
		}
	}

	private updateContent(content: string): void {
		if (!this._container) {
			return;
		}

		const contentElement = this._container.querySelector('.ai-inline-content') as HTMLElement;
		if (contentElement) {
			contentElement.innerHTML = this.formatContent(content);
		}
	}

	private updateLoadingState(): void {
		if (!this._container) {
			return;
		}

		const contentElement = this._container.querySelector('.ai-inline-content') as HTMLElement;
		if (!contentElement) {
			return;
		}

		if (this._isLoading) {
			contentElement.innerHTML = `
				<div style="display: flex; align-items: center; gap: 6px; padding: 10px;">
					<div style="width: 12px; height: 12px; border: 2px solid var(--vscode-progressBar-background); border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
					<span style="font-size: 11px;">AI is thinking...</span>
				</div>
			`;
		}
	}

	private formatContent(content: string): string {
		// Simple markdown-like formatting
		return content
			.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.*?)\*/g, '<em>$1</em>')
			.replace(/`(.*?)`/g, '<code>$1</code>')
			.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
			.replace(/\n/g, '<br>');
	}

	private getTitle(type: string): string {
		switch (type) {
			case 'chat': return 'AI Chat';
			case 'completion': return 'AI Completion';
			case 'edit': return 'AI Edit';
			case 'explanation': return 'AI Explanation';
			case 'refactor': return 'AI Refactor';
			default: return 'AI Assistant';
		}
	}

	private getPlaceholder(type: string): string {
		switch (type) {
			case 'chat': return 'Ask me anything about your code...';
			case 'completion': return 'AI will help complete your code...';
			case 'edit': return 'AI will help edit your code...';
			case 'explanation': return 'AI will explain your code...';
			case 'refactor': return 'AI will refactor your code...';
			default: return 'AI Assistant is ready to help...';
		}
	}

	private getInputPlaceholder(type: string): string {
		switch (type) {
			case 'chat': return 'Type your message...';
			case 'completion': return 'Describe what you want to complete...';
			case 'edit': return 'Describe the changes you want...';
			case 'explanation': return 'Ask specific questions about the code...';
			case 'refactor': return 'Describe the refactoring you want...';
			default: return 'Type your message...';
		}
	}
}

interface AiInlineWidgetEvent {
	position: IPosition;
	type: string;
}

interface AiInlineResponseEvent {
	position: IPosition;
	response: string;
	type: string;
	duration: number;
}

interface AiInlineErrorEvent {
	error: Error;
	context: string;
}