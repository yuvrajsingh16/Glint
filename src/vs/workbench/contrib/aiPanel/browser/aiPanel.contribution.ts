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
import { IEditorContribution } from '../../../../editor/common/editorCommon.js';
import { ISelection } from '../../../../editor/common/core/selection.js';
import { IRange } from '../../../../editor/common/core/range.js';
import { Extensions as ActionExtensions, IWorkbenchActionRegistry, Action2, MenuId } from '../../../../platform/actions/common/actions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IAiPanelService } from './aiPanelWidget.js';
import { IAiAssistantService } from '../../services/aiAssistant/common/aiAssistantService.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';

// Register AI Panel Service
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { AiPanelWidget } from './aiPanelWidget.js';

registerSingleton(IAiPanelService, AiPanelWidget, InstantiationType.Delayed);

// AI Panel Commands
class AiPanelCommands extends Disposable {
	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ICommandService private readonly commandService: ICommandService,
		@IAiPanelService private readonly aiPanelService: IAiPanelService,
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

		// Explain Code
		this._register(new Action2({
			id: 'ai.explain.code',
			title: { value: nls.localize('ai.explain.code', 'Explain Code'), original: 'Explain Code' },
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
					order: 1
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

		// Refactor Code
		this._register(new Action2({
			id: 'ai.refactor.code',
			title: { value: nls.localize('ai.refactor.code', 'Refactor Code'), original: 'Refactor Code' },
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
					order: 2
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

		// Fix Bug
		this._register(new Action2({
			id: 'ai.fix.bug',
			title: { value: nls.localize('ai.fix.bug', 'Fix Bug'), original: 'Fix Bug' },
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

		// Generate Tests
		this._register(new Action2({
			id: 'ai.generate.tests',
			title: { value: nls.localize('ai.generate.tests', 'Generate Tests'), original: 'Generate Tests' },
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

		// Review Code
		this._register(new Action2({
			id: 'ai.review.code',
			title: { value: nls.localize('ai.review.code', 'Review Code'), original: 'Review Code' },
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

				const code = editor.getModel()?.getValueInRange(selection) || '';
				if (!code.trim()) {
					this.notificationService.warn('No code selected');
					return;
				}

				this.aiPanelService.showPanel();
				await this.aiPanelService.reviewCode(code);
			}
		}));

		// Optimize Performance
		this._register(new Action2({
			id: 'ai.optimize.performance',
			title: { value: nls.localize('ai.optimize.performance', 'Optimize Performance'), original: 'Optimize Performance' },
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
					order: 6
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

		// Analyze Security
		this._register(new Action2({
			id: 'ai.analyze.security',
			title: { value: nls.localize('ai.analyze.security', 'Analyze Security'), original: 'Analyze Security' },
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
				await this.aiPanelService.analyzeSecurity(code);
			}
		}));

		// Chat with AI
		this._register(new Action2({
			id: 'ai.chat',
			title: { value: nls.localize('ai.chat', 'Chat with AI'), original: 'Chat with AI' },
			category: { value: nls.localize('ai.category', 'AI'), original: 'AI' },
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyC,
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
					order: 1.6
				}
			],
			run: async (accessor: ServicesAccessor) => {
				this.aiPanelService.showPanel();
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

// AI Panel Contribution
class AiPanelContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.aiPanel';

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super();

		// Register AI Panel Commands
		this._register(this.instantiationService.createInstance(AiPanelCommands));
	}
}

// Register the contribution
registerWorkbenchContribution2(AiPanelContribution.ID, AiPanelContribution, WorkbenchPhase.Starting);

// Register actions
const actionRegistry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
actionRegistry.registerWorkbenchAction(AiPanelCommands);