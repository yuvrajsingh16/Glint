/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ICodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { isCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { IPosition, Position } from '../../../../editor/common/core/position.js';
import { IRange, Range } from '../../../../editor/common/core/range.js';
import { Extensions as ActionExtensions, IWorkbenchActionRegistry, Action2, MenuId } from '../../../../platform/actions/common/actions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';

// Import AI Services
import { IAiCoreService, AiCoreService } from '../../services/aiCore/common/aiCoreService.js';
import { IAiAssistantService, AiAssistantService } from '../../services/aiAssistant/common/aiAssistantService.js';
import { IAiPanelService, AiPanelWidget } from '../aiPanel/browser/aiPanelWidget.js';
import { IAiInlineService, AiInlineEditor } from '../aiInline/browser/aiInlineEditor.js';

// Register AI Services
registerSingleton(IAiCoreService, AiCoreService, InstantiationType.Delayed);
registerSingleton(IAiAssistantService, AiAssistantService, InstantiationType.Delayed);
registerSingleton(IAiPanelService, AiPanelWidget, InstantiationType.Delayed);
registerSingleton(IAiInlineService, AiInlineEditor, InstantiationType.Delayed);

// AI Commands
class AiCommands extends Disposable {
	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ICommandService private readonly commandService: ICommandService,
		@IAiPanelService private readonly aiPanelService: IAiPanelService,
		@IAiInlineService private readonly aiInlineService: IAiInlineService,
		@IAiAssistantService private readonly aiAssistantService: IAiAssistantService,
		@IEditorService private readonly editorService: IEditorService,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@IDialogService private readonly dialogService: IDialogService,
		@INotificationService private readonly notificationService: INotificationService
	) {
		super();

		this.registerCommands();
	}

	private registerCommands(): void {
		// Toggle AI Panel
		this._register(new Action2({
			id: 'ai.panel.toggle',
			title: { value: nls.localize('ai.panel.toggle', 'Toggle AI Panel'), original: 'Toggle AI Panel' },
			category: { value: nls.localize('ai.category', 'AI'), original: 'AI' },
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyA,
				when: ContextKeyExpr.true(),
				weight: 100
			},
			menu: [
				{
					id: MenuId.CommandPalette
				},
				{
					id: MenuId.MenubarEditMenu,
					group: '1_modify',
					order: 1.5
				}
			],
			run: async (accessor: ServicesAccessor) => {
				this.aiPanelService.togglePanel();
			}
		}));

		// Show Inline Chat
		this._register(new Action2({
			id: 'ai.inline.chat',
			title: { value: nls.localize('ai.inline.chat', 'Show Inline Chat'), original: 'Show Inline Chat' },
			category: { value: nls.localize('ai.category', 'AI'), original: 'AI' },
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyI,
				when: ContextKeyExpr.has('editorTextFocus'),
				weight: 100
			},
			menu: [
				{
					id: MenuId.EditorContext,
					group: 'ai',
					order: 1
				}
			],
			run: async (accessor: ServicesAccessor) => {
				const editor = this.getActiveEditor();
				if (!editor) {
					this.notificationService.warn('No active editor found');
					return;
				}

				const position = editor.getPosition();
				if (!position) {
					this.notificationService.warn('No cursor position');
					return;
				}

				await this.aiInlineService.showInlineChat(editor, position);
			}
		}));

		// Show Inline Completion
		this._register(new Action2({
			id: 'ai.inline.completion',
			title: { value: nls.localize('ai.inline.completion', 'Show Inline Completion'), original: 'Show Inline Completion' },
			category: { value: nls.localize('ai.category', 'AI'), original: 'AI' },
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyC,
				when: ContextKeyExpr.has('editorTextFocus'),
				weight: 100
			},
			menu: [
				{
					id: MenuId.EditorContext,
					group: 'ai',
					order: 2
				}
			],
			run: async (accessor: ServicesAccessor) => {
				const editor = this.getActiveEditor();
				if (!editor) {
					this.notificationService.warn('No active editor found');
					return;
				}

				const position = editor.getPosition();
				if (!position) {
					this.notificationService.warn('No cursor position');
					return;
				}

				await this.aiInlineService.showInlineCompletion(editor, position);
			}
		}));

		// Show Inline Edit
		this._register(new Action2({
			id: 'ai.inline.edit',
			title: { value: nls.localize('ai.inline.edit', 'Show Inline Edit'), original: 'Show Inline Edit' },
			category: { value: nls.localize('ai.category', 'AI'), original: 'AI' },
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyE,
				when: ContextKeyExpr.and(
					ContextKeyExpr.has('editorTextFocus'),
					ContextKeyExpr.has('editorHasSelection')
				),
				weight: 100
			},
			menu: [
				{
					id: MenuId.EditorContext,
					group: 'ai',
					order: 3
				}
			],
			run: async (accessor: ServicesAccessor) => {
				const editor = this.getActiveEditor();
				if (!editor) {
					this.notificationService.warn('No active editor found');
					return;
				}

				const selection = editor.getSelection();
				if (!selection) {
					this.notificationService.warn('No text selected');
					return;
				}

				const instruction = await this.quickInputService.input({
					prompt: 'What would you like to edit?',
					placeholder: 'e.g., Fix this code, Improve readability, etc.'
				});

				if (instruction) {
					await this.aiInlineService.showInlineEdit(editor, selection, instruction);
				}
			}
		}));

		// Show Inline Explanation
		this._register(new Action2({
			id: 'ai.inline.explanation',
			title: { value: nls.localize('ai.inline.explanation', 'Show Inline Explanation'), original: 'Show Inline Explanation' },
			category: { value: nls.localize('ai.category', 'AI'), original: 'AI' },
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyX,
				when: ContextKeyExpr.and(
					ContextKeyExpr.has('editorTextFocus'),
					ContextKeyExpr.has('editorHasSelection')
				),
				weight: 100
			},
			menu: [
				{
					id: MenuId.EditorContext,
					group: 'ai',
					order: 4
				}
			],
			run: async (accessor: ServicesAccessor) => {
				const editor = this.getActiveEditor();
				if (!editor) {
					this.notificationService.warn('No active editor found');
					return;
				}

				const selection = editor.getSelection();
				if (!selection) {
					this.notificationService.warn('No text selected');
					return;
				}

				await this.aiInlineService.showInlineExplanation(editor, selection);
			}
		}));

		// Show Inline Refactor
		this._register(new Action2({
			id: 'ai.inline.refactor',
			title: { value: nls.localize('ai.inline.refactor', 'Show Inline Refactor'), original: 'Show Inline Refactor' },
			category: { value: nls.localize('ai.category', 'AI'), original: 'AI' },
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyR,
				when: ContextKeyExpr.and(
					ContextKeyExpr.has('editorTextFocus'),
					ContextKeyExpr.has('editorHasSelection')
				),
				weight: 100
			},
			menu: [
				{
					id: MenuId.EditorContext,
					group: 'ai',
					order: 5
				}
			],
			run: async (accessor: ServicesAccessor) => {
				const editor = this.getActiveEditor();
				if (!editor) {
					this.notificationService.warn('No active editor found');
					return;
				}

				const selection = editor.getSelection();
				if (!selection) {
					this.notificationService.warn('No text selected');
					return;
				}

				const refactorType = await this.quickInputService.pick(
					['Extract Method', 'Extract Variable', 'Extract Class', 'Rename', 'Move', 'Inline', 'Simplify'],
					{
						placeHolder: 'Select refactoring type',
						canPickMany: false
					}
				);

				if (refactorType) {
					await this.aiInlineService.showInlineRefactor(editor, selection, refactorType);
				}
			}
		}));

		// Hide Inline Widget
		this._register(new Action2({
			id: 'ai.inline.hide',
			title: { value: nls.localize('ai.inline.hide', 'Hide Inline Widget'), original: 'Hide Inline Widget' },
			category: { value: nls.localize('ai.category', 'AI'), original: 'AI' },
			keybinding: {
				primary: KeyCode.Escape,
				when: ContextKeyExpr.has('aiInlineWidgetVisible'),
				weight: 100
			},
			menu: [
				{
					id: MenuId.EditorContext,
					group: 'ai',
					order: 6
				}
			],
			run: async (accessor: ServicesAccessor) => {
				const editor = this.getActiveEditor();
				if (!editor) {
					return;
				}

				this.aiInlineService.hideInlineWidget(editor);
			}
		}));

		// AI Chat
		this._register(new Action2({
			id: 'ai.chat',
			title: { value: nls.localize('ai.chat', 'AI Chat'), original: 'AI Chat' },
			category: { value: nls.localize('ai.category', 'AI'), original: 'AI' },
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyM,
				when: ContextKeyExpr.true(),
				weight: 100
			},
			menu: [
				{
					id: MenuId.CommandPalette
				},
				{
					id: MenuId.MenubarEditMenu,
					group: '1_modify',
					order: 1.7
				}
			],
			run: async (accessor: ServicesAccessor) => {
				this.aiPanelService.showPanel();
			}
		}));

		// AI Explain Code
		this._register(new Action2({
			id: 'ai.explain.code',
			title: { value: nls.localize('ai.explain.code', 'AI Explain Code'), original: 'AI Explain Code' },
			category: { value: nls.localize('ai.category', 'AI'), original: 'AI' },
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyY,
				when: ContextKeyExpr.and(
					ContextKeyExpr.has('editorTextFocus'),
					ContextKeyExpr.has('editorHasSelection')
				),
				weight: 100
			},
			menu: [
				{
					id: MenuId.EditorContext,
					group: 'ai',
					order: 7
				}
			],
			run: async (accessor: ServicesAccessor) => {
				const editor = this.getActiveEditor();
				if (!editor) {
					this.notificationService.warn('No active editor found');
					return;
				}

				const selection = editor.getSelection();
				if (!selection) {
					this.notificationService.warn('No text selected');
					return;
				}

				const code = editor.getModel()?.getValueInRange(selection) || '';
				if (!code.trim()) {
					this.notificationService.warn('No code selected');
					return;
				}

				this.aiPanelService.showPanel();
				await this.aiPanelService.explainCode(code);
			}
		}));

		// AI Refactor Code
		this._register(new Action2({
			id: 'ai.refactor.code',
			title: { value: nls.localize('ai.refactor.code', 'AI Refactor Code'), original: 'AI Refactor Code' },
			category: { value: nls.localize('ai.category', 'AI'), original: 'AI' },
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyF,
				when: ContextKeyExpr.and(
					ContextKeyExpr.has('editorTextFocus'),
					ContextKeyExpr.has('editorHasSelection')
				),
				weight: 100
			},
			menu: [
				{
					id: MenuId.EditorContext,
					group: 'ai',
					order: 8
				}
			],
			run: async (accessor: ServicesAccessor) => {
				const editor = this.getActiveEditor();
				if (!editor) {
					this.notificationService.warn('No active editor found');
					return;
				}

				const selection = editor.getSelection();
				if (!selection) {
					this.notificationService.warn('No text selected');
					return;
				}

				const code = editor.getModel()?.getValueInRange(selection) || '';
				if (!code.trim()) {
					this.notificationService.warn('No code selected');
					return;
				}

				const instruction = await this.quickInputService.input({
					prompt: 'What would you like to refactor?',
					placeholder: 'e.g., Extract method, Simplify logic, etc.'
				});

				if (instruction) {
					this.aiPanelService.showPanel();
					await this.aiPanelService.refactorCode(code, instruction);
				}
			}
		}));

		// AI Fix Bug
		this._register(new Action2({
			id: 'ai.fix.bug',
			title: { value: nls.localize('ai.fix.bug', 'AI Fix Bug'), original: 'AI Fix Bug' },
			category: { value: nls.localize('ai.category', 'AI'), original: 'AI' },
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyB,
				when: ContextKeyExpr.and(
					ContextKeyExpr.has('editorTextFocus'),
					ContextKeyExpr.has('editorHasSelection')
				),
				weight: 100
			},
			menu: [
				{
					id: MenuId.EditorContext,
					group: 'ai',
					order: 9
				}
			],
			run: async (accessor: ServicesAccessor) => {
				const editor = this.getActiveEditor();
				if (!editor) {
					this.notificationService.warn('No active editor found');
					return;
				}

				const selection = editor.getSelection();
				if (!selection) {
					this.notificationService.warn('No text selected');
					return;
				}

				const code = editor.getModel()?.getValueInRange(selection) || '';
				if (!code.trim()) {
					this.notificationService.warn('No code selected');
					return;
				}

				const error = await this.quickInputService.input({
					prompt: 'What error are you encountering? (optional)',
					placeholder: 'e.g., TypeError: Cannot read property...'
				});

				this.aiPanelService.showPanel();
				await this.aiPanelService.fixBug(code, error || undefined);
			}
		}));

		// AI Generate Tests
		this._register(new Action2({
			id: 'ai.generate.tests',
			title: { value: nls.localize('ai.generate.tests', 'AI Generate Tests'), original: 'AI Generate Tests' },
			category: { value: nls.localize('ai.category', 'AI'), original: 'AI' },
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyT,
				when: ContextKeyExpr.and(
					ContextKeyExpr.has('editorTextFocus'),
					ContextKeyExpr.has('editorHasSelection')
				),
				weight: 100
			},
			menu: [
				{
					id: MenuId.EditorContext,
					group: 'ai',
					order: 10
				}
			],
			run: async (accessor: ServicesAccessor) => {
				const editor = this.getActiveEditor();
				if (!editor) {
					this.notificationService.warn('No active editor found');
					return;
				}

				const selection = editor.getSelection();
				if (!selection) {
					this.notificationService.warn('No text selected');
					return;
				}

				const code = editor.getModel()?.getValueInRange(selection) || '';
				if (!code.trim()) {
					this.notificationService.warn('No code selected');
					return;
				}

				const framework = await this.quickInputService.pick(
					['Jest', 'Mocha', 'JUnit', 'PyTest', 'NUnit', 'xUnit', 'None'],
					{
						placeHolder: 'Select test framework (optional)',
						canPickMany: false
					}
				);

				this.aiPanelService.showPanel();
				await this.aiPanelService.generateTests(code, framework || undefined);
			}
		}));

		// AI Review Code
		this._register(new Action2({
			id: 'ai.review.code',
			title: { value: nls.localize('ai.review.code', 'AI Review Code'), original: 'AI Review Code' },
			category: { value: nls.localize('ai.category', 'AI'), original: 'AI' },
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyV,
				when: ContextKeyExpr.and(
					ContextKeyExpr.has('editorTextFocus'),
					ContextKeyExpr.has('editorHasSelection')
				),
				weight: 100
			},
			menu: [
				{
					id: MenuId.EditorContext,
					group: 'ai',
					order: 11
				}
			],
			run: async (accessor: ServicesAccessor) => {
				const editor = this.getActiveEditor();
				if (!editor) {
					this.notificationService.warn('No active editor found');
					return;
				}

				const selection = editor.getSelection();
				if (!selection) {
					this.notificationService.warn('No text selected');
					return;
				}

				const code = editor.getModel()?.getValueInRange(selection) || '';
				if (!code.trim()) {
					this.notificationService.warn('No code selected');
					return;
				}

				this.aiPanelService.showPanel();
				await this.aiPanelService.reviewCode(code);
			}
		}));

		// AI Optimize Performance
		this._register(new Action2({
			id: 'ai.optimize.performance',
			title: { value: nls.localize('ai.optimize.performance', 'AI Optimize Performance'), original: 'AI Optimize Performance' },
			category: { value: nls.localize('ai.category', 'AI'), original: 'AI' },
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyO,
				when: ContextKeyExpr.and(
					ContextKeyExpr.has('editorTextFocus'),
					ContextKeyExpr.has('editorHasSelection')
				),
				weight: 100
			},
			menu: [
				{
					id: MenuId.EditorContext,
					group: 'ai',
					order: 12
				}
			],
			run: async (accessor: ServicesAccessor) => {
				const editor = this.getActiveEditor();
				if (!editor) {
					this.notificationService.warn('No active editor found');
					return;
				}

				const selection = editor.getSelection();
				if (!selection) {
					this.notificationService.warn('No text selected');
					return;
				}

				const code = editor.getModel()?.getValueInRange(selection) || '';
				if (!code.trim()) {
					this.notificationService.warn('No code selected');
					return;
				}

				this.aiPanelService.showPanel();
				await this.aiPanelService.optimizePerformance(code);
			}
		}));

		// AI Analyze Security
		this._register(new Action2({
			id: 'ai.analyze.security',
			title: { value: nls.localize('ai.analyze.security', 'AI Analyze Security'), original: 'AI Analyze Security' },
			category: { value: nls.localize('ai.category', 'AI'), original: 'AI' },
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyS,
				when: ContextKeyExpr.and(
					ContextKeyExpr.has('editorTextFocus'),
					ContextKeyExpr.has('editorHasSelection')
				),
				weight: 100
			},
			menu: [
				{
					id: MenuId.EditorContext,
					group: 'ai',
					order: 13
				}
			],
			run: async (accessor: ServicesAccessor) => {
				const editor = this.getActiveEditor();
				if (!editor) {
					this.notificationService.warn('No active editor found');
					return;
				}

				const selection = editor.getSelection();
				if (!selection) {
					this.notificationService.warn('No text selected');
					return;
				}

				const code = editor.getModel()?.getValueInRange(selection) || '';
				if (!code.trim()) {
					this.notificationService.warn('No code selected');
					return;
				}

				this.aiPanelService.showPanel();
				await this.aiPanelService.analyzeSecurity(code);
			}
		}));
	}

	private getActiveEditor(): ICodeEditor | undefined {
		const activeEditor = this.editorService.activeEditor;
		if (activeEditor && isCodeEditor(activeEditor.getControl())) {
			return activeEditor.getControl() as ICodeEditor;
		}
		return undefined;
	}
}

// AI Contribution
class AiContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.ai';

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super();

		// Register AI Commands
		this._register(this.instantiationService.createInstance(AiCommands));
	}
}

// Register the contribution
registerWorkbenchContribution2(AiContribution.ID, AiContribution, WorkbenchPhase.Starting);

// Register actions
const actionRegistry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
actionRegistry.registerWorkbenchAction(AiCommands);