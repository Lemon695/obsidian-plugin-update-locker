import { FuzzySuggestModal, Notice, Setting, TFile, normalizePath } from 'obsidian';
import type { PluginModule, PluginLockInfo } from '../../core/types';
import type PluginLockerPlugin from '../../main';
import { t } from '../../i18n/locale';

interface LockerConfigPayload {
	lockedPlugins?: unknown;
	autoCheckConflicts?: unknown;
}

const EXPORT_FOLDER = 'Plugin Update Locker';
const EXPORT_PREFIX = 'locker-config-';

export class SyncModule implements PluginModule {
	id = 'sync';
	name = t('SYNC_MODULE_NAME');
	description = t('SYNC_MODULE_DESC');

	constructor(private readonly plugin: PluginLockerPlugin) {}

	async onload(): Promise<void> {}
	onunload(): void {}

	async exportConfig(): Promise<void> {
		await this.ensureFolderExists(EXPORT_FOLDER);

		const filePath = normalizePath(
			`${EXPORT_FOLDER}/${EXPORT_PREFIX}${new Date().toISOString().split('T')[0]}.json`
		);
		const config = JSON.stringify(
			{
				lockedPlugins: this.plugin.settings.lockedPlugins,
				autoCheckConflicts: this.plugin.settings.autoCheckConflicts,
			},
			null,
			2
		);

		const existing = this.plugin.app.vault.getAbstractFileByPath(filePath);
		if (existing instanceof TFile) {
			await this.plugin.app.vault.modify(existing, config);
		} else {
			await this.plugin.app.vault.create(filePath, config);
		}

		new Notice(t('EXPORT_SUCCESS', { path: filePath }));
	}

	async importConfig(file: TFile): Promise<void> {
		try {
			const raw = await this.plugin.app.vault.read(file);
			const config = JSON.parse(raw) as LockerConfigPayload;

			if (!Array.isArray(config.lockedPlugins)) {
				new Notice(t('IMPORT_ERROR'));
				return;
			}

			this.plugin.settings.lockedPlugins = config.lockedPlugins as PluginLockInfo[];
			if (typeof config.autoCheckConflicts === 'boolean') {
				this.plugin.settings.autoCheckConflicts = config.autoCheckConflicts;
			}

			await this.plugin.saveSettings();
			new Notice(t('IMPORT_SUCCESS', { count: config.lockedPlugins.length.toString() }));
		} catch {
			new Notice(t('IMPORT_ERROR'));
		}
	}

	renderSettings(containerEl: HTMLElement): void {
		containerEl.createEl('p', { text: t('SYNC_VAULT_NOTE') });

		new Setting(containerEl)
			.setName(t('EXPORT_CONFIG'))
			.addButton(btn => btn
				.setButtonText(t('EXPORT_BUTTON'))
				.onClick(async () => {
					await this.exportConfig();
				}));

		new Setting(containerEl)
			.setName(t('IMPORT_CONFIG'))
			.addButton(btn => btn
				.setButtonText(t('IMPORT_BUTTON'))
				.onClick(() => {
					this.openImportModal();
				}));
	}

	private openImportModal(): void {
		const files = this.getImportCandidates();
		if (files.length === 0) {
			new Notice(t('IMPORT_PICKER_EMPTY'));
			return;
		}

		new ConfigImportModal(this.plugin, files).open();
	}

	private getImportCandidates(): TFile[] {
		return this.plugin.app.vault
			.getFiles()
			.filter(file => file.extension === 'json')
			.sort((a, b) => b.stat.mtime - a.stat.mtime);
	}

	private async ensureFolderExists(folderPath: string): Promise<void> {
		const normalized = normalizePath(folderPath);
		if (normalized === '' || normalized === '/') {
			return;
		}

		const segments = normalized.split('/').filter(Boolean);
		let currentPath = '';

		for (const segment of segments) {
			currentPath = currentPath ? `${currentPath}/${segment}` : segment;
			const existing = this.plugin.app.vault.getAbstractFileByPath(currentPath);
			if (!existing) {
				await this.plugin.app.vault.createFolder(currentPath);
			}
		}
	}
}

class ConfigImportModal extends FuzzySuggestModal<TFile> {
	constructor(
		private readonly plugin: PluginLockerPlugin,
		private readonly files: TFile[]
	) {
		super(plugin.app);
		this.setPlaceholder(t('IMPORT_PICKER_HINT'));
		this.emptyStateText = t('IMPORT_PICKER_EMPTY');
		this.initializeTitle();
	}

	getItems(): TFile[] {
		return this.files;
	}

	getItemText(item: TFile): string {
		return item.path;
	}

	renderSuggestion(match: { item: TFile }, el: HTMLElement): void {
		const { item } = match;
		el.createDiv({ text: item.basename });
		el.createEl('small', {
			text: t('IMPORT_DESC', {
				path: item.path,
				date: new Date(item.stat.mtime).toLocaleString(),
			}),
		});
	}

	onChooseItem(item: TFile): void {
		const syncModule = this.plugin.moduleManager
			.getAll()
			.find((module): module is SyncModule => module instanceof SyncModule);
		void syncModule?.importConfig(item);
	}

	private initializeTitle(): void {
		this.titleEl.setText(t('IMPORT_PICKER_TITLE'));
	}
}
