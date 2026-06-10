import { Notice, normalizePath, Setting, Modal, ButtonComponent, App } from 'obsidian';

interface ManifestJson {
	version: string;
	minAppVersion?: string;
	[key: string]: unknown;
}
import type { PluginModule } from '../../core/types';
import type PluginLockerPlugin from '../../main';
import { t } from '../../i18n/locale';
import { CompatibilityModule } from '../compatibility';

export class SnapshotModule implements PluginModule {
	id = 'snapshot';
	name = t('SNAPSHOT_MODULE_NAME');
	description = t('SNAPSHOT_MODULE_DESC');

	constructor(private readonly plugin: PluginLockerPlugin) {}

	async onload(): Promise<void> {
		const snapshotDir = this.getSnapshotBaseDir();
		if (!(await this.plugin.app.vault.adapter.exists(snapshotDir))) {
			await this.plugin.app.vault.adapter.mkdir(snapshotDir);
		}
	}

	onunload(): void {}

	private getSnapshotBaseDir(): string {
		return normalizePath(`${this.plugin.manifest.dir}/snapshots`);
	}

	private getPluginSnapshotDir(pluginId: string): string {
		return normalizePath(`${this.getSnapshotBaseDir()}/${pluginId}`);
	}

	async takeSnapshot(pluginId: string): Promise<void> {
		const pluginPath = normalizePath(`${this.plugin.app.vault.configDir}/plugins/${pluginId}`);
		if (!(await this.plugin.app.vault.adapter.exists(pluginPath))) {
			console.error(`Plugin ${pluginId} not found at ${pluginPath}`);
			return;
		}

		const snapshotPath = this.getPluginSnapshotDir(pluginId);
		if (!(await this.plugin.app.vault.adapter.exists(snapshotPath))) {
			await this.plugin.app.vault.adapter.mkdir(snapshotPath);
		}

		const filesToBackup = ['main.js', 'styles.css', 'manifest.json'];
		for (const file of filesToBackup) {
			const src = normalizePath(`${pluginPath}/${file}`);
			const dest = normalizePath(`${snapshotPath}/${file}`);
			if (await this.plugin.app.vault.adapter.exists(src)) {
				const content = await this.plugin.app.vault.adapter.readBinary(src);
				await this.plugin.app.vault.adapter.writeBinary(dest, content);
			}
		}

		// 更新记录
		const manifest = this.plugin.app.plugins.manifests[pluginId];
		const version = manifest?.version || 'unknown';
		
		// 移除旧记录并新增
		this.plugin.settings.snapshots = this.plugin.settings.snapshots.filter(s => s.pluginId !== pluginId);
		this.plugin.settings.snapshots.push({
			pluginId,
			version,
			timestamp: Date.now()
		});
		await this.plugin.saveSettings();

		new Notice(t('SNAPSHOT_CREATED', { pluginId, version }));
	}

	async restoreSnapshot(pluginId: string): Promise<void> {
		const snapshotPath = this.getPluginSnapshotDir(pluginId);
		const pluginPath = normalizePath(`${this.plugin.app.vault.configDir}/plugins/${pluginId}`);

		if (!(await this.plugin.app.vault.adapter.exists(snapshotPath))) {
			new Notice(t('NO_SNAPSHOTS'));
			return;
		}

		// 检查快照兼容性
		const manifestContent = await this.plugin.app.vault.adapter.read(normalizePath(`${snapshotPath}/manifest.json`));
		const manifest = JSON.parse(manifestContent) as ManifestJson;
		const compatModule = this.plugin.moduleManager.getAll().find(m => m.id === 'compatibility') as CompatibilityModule;

		if (compatModule && this.plugin.moduleManager.isEnabled('compatibility')) {
			const { compatible } = compatModule.checkCompatibility(manifest.minAppVersion);
			if (!compatible) {
				new ConfirmModal(this.plugin.app, t('CONFIRM_INCOMPATIBLE_RESTORE', { pluginVersion: manifest.version }), async () => {
					await this.performRestore(snapshotPath, pluginPath, pluginId);
				}).open();
				return;
			}
		}

		await this.performRestore(snapshotPath, pluginPath, pluginId);
	}

	private async performRestore(snapshotPath: string, pluginPath: string, pluginId: string) {
		const files = ['main.js', 'styles.css', 'manifest.json'];
		for (const file of files) {
			const src = normalizePath(`${snapshotPath}/${file}`);
			const dest = normalizePath(`${pluginPath}/${file}`);
			if (await this.plugin.app.vault.adapter.exists(src)) {
				const content = await this.plugin.app.vault.adapter.readBinary(src);
				await this.plugin.app.vault.adapter.writeBinary(dest, content);
			}
		}
		new Notice(t('SNAPSHOT_RESTORED', { pluginId }));
	}

	renderSettings(containerEl: HTMLElement): void {
		if (this.plugin.settings.snapshots.length === 0) {
			containerEl.createEl('p', { text: t('NO_SNAPSHOTS'), cls: 'pul-no-plugins-found' });
			return;
		}

		this.plugin.settings.snapshots.forEach(snapshot => {
			const date = new Date(snapshot.timestamp).toLocaleString();
			new Setting(containerEl)
				.setName(snapshot.pluginId)
				.setDesc(`v${snapshot.version} - ${date}`)
				.addButton(btn => btn
					.setButtonText(t('RESTORE_SNAPSHOT'))
					.onClick(async () => {
						await this.restoreSnapshot(snapshot.pluginId);
					}));
		});
	}
}

class ConfirmModal extends Modal {
	constructor(app: App, private message: string, private onConfirm: () => Promise<void>) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('p', { text: this.message });
		const btns = contentEl.createDiv({ cls: 'pul-modal-buttons' });
		// eslint-disable-next-line @typescript-eslint/no-deprecated
		new ButtonComponent(btns).setButtonText(t('CONFIRM_ACTION')).setWarning().onClick(async () => {
			await this.onConfirm();
			this.close();
		});
		new ButtonComponent(btns).setButtonText(t('CANCEL_ACTION')).onClick(() => this.close());
	}
}
