import { Notice, normalizePath, Setting, debounce, PluginManifest, Modal, MarkdownRenderer, setIcon, Component } from 'obsidian';

interface ManifestJson {
	version: string;
	[key: string]: unknown;
}
import type { PluginModule, ConflictInfo } from '../../core/types';
import { ConflictType } from '../../core/types';
import type PluginLockerPlugin from '../../main';
import { t } from '../../i18n/locale';
import { SnapshotModule } from '../snapshot';
import { ChangelogModule } from '../changelog';
import { CompatibilityModule } from '../compatibility';

export class LockerModule implements PluginModule {
	id = 'locker';
	name = t('LOCKER_MODULE_NAME');
	description = t('LOCKER_MODULE_DESC');

	private lockOperations = new Set<string>();
	public conflicts: ConflictInfo[] = [];
	private filterString: string = '';
	private sortBy: 'name' | 'status' = 'name';
	private groupByStatus: boolean = true;
	private originalPluginList: PluginManifest[] = [];

	constructor(private readonly plugin: PluginLockerPlugin) {}

	async onload(): Promise<void> {
		this.originalPluginList = Object.values(this.plugin.app.plugins.manifests)
			.filter(manifest => manifest.id !== this.plugin.manifest.id);

		this.plugin.app.workspace.onLayoutReady(() => {
			if (this.plugin.settings.autoCheckConflicts) {
				void this.checkConflicts();
			}
		});
	}

	onunload(): void {
		// 清理逻辑
		this.lockOperations.clear();
		this.conflicts = [];
	}

	async checkConflicts() {
		const manifests = this.plugin.app.plugins.manifests;
		const newConflicts: ConflictInfo[] = [];

		for (const pluginId in manifests) {
			const manifest = manifests[pluginId];
			const isLockedInSettings = this.isPluginLocked(pluginId);
			const isVersionLocked = manifest.version.startsWith('9999.');

			if (isLockedInSettings && !isVersionLocked) {
				newConflicts.push({
					pluginId,
					type: ConflictType.VERSION_MISMATCH,
					actualVersion: manifest.version,
					expectedVersion: this.plugin.settings.lockedPlugins.find(p => p.pluginId === pluginId)?.updatedVersion
				});
			} else if (!isLockedInSettings && isVersionLocked) {
				newConflicts.push({
					pluginId,
					type: ConflictType.ORPHAN_LOCK,
					actualVersion: manifest.version
				});
			}
		}

		this.conflicts = newConflicts;
		if (this.conflicts.length > 0) {
			new Notice(t('CONFLICTS_DETECTED', { count: this.conflicts.length.toString() }));
		}
	}

	isPluginLocked(pluginId: string): boolean {
		return this.plugin.settings.lockedPlugins.some(plugin => plugin.pluginId === pluginId);
	}

	async togglePluginLock(pluginId: string) {
		if (this.lockOperations.has(pluginId)) {
			new Notice(t('OPERATION_IN_PROGRESS'));
			return;
		}

		this.lockOperations.add(pluginId);
		try {
			await this.performToggle(pluginId);
		} finally {
			this.lockOperations.delete(pluginId);
		}
	}

	private async performToggle(pluginId: string) {
		const manifestPath = normalizePath(`${this.plugin.app.vault.configDir}/plugins/${pluginId}/manifest.json`);

		try {
			if (this.isPluginLocked(pluginId)) {
				const index = this.plugin.settings.lockedPlugins.findIndex(plugin => plugin.pluginId === pluginId);
				if (index !== -1) {
					const {originalVersion} = this.plugin.settings.lockedPlugins[index];
					await this.restorePluginVersion(pluginId, originalVersion);
					this.plugin.settings.lockedPlugins.splice(index, 1);
					await this.plugin.saveSettings();
					new Notice(t('UNLOCKED_NOTICE', { pluginId }));
				}
			} else {
				// 锁定前自动创建快照
				const snapshotModule = this.plugin.moduleManager.getAll().find(m => m.id === 'snapshot') as SnapshotModule;
				if (snapshotModule && this.plugin.moduleManager.isEnabled('snapshot')) {
					await snapshotModule.takeSnapshot(pluginId);
				}

				const manifestContent = await this.plugin.app.vault.adapter.read(manifestPath);
				const manifest = JSON.parse(manifestContent) as ManifestJson;
				const originalVersion = manifest.version;

				if (originalVersion.startsWith('9999.')) {
					new Notice(t('PLUGIN_LOCKED_ALREADY', { pluginId }));
					return;
				}

				const updatedVersion = `9999.${originalVersion}`;
				this.plugin.settings.lockedPlugins.push({pluginId, originalVersion, updatedVersion});
				await this.updatePluginManifestVersion(pluginId, updatedVersion);
				await this.plugin.saveSettings();
				new Notice(t('LOCKED_NOTICE', { pluginId }));
			}
		} catch (error) {
			console.error(`Failed to toggle lock for ${pluginId}:`, error);
			new Notice(t('FAILED_TOGGLE', { pluginId }));
		}
	}

	async batchToggle(pluginIds: string[], shouldLock: boolean) {
		let affectedCount = 0;
		for (const pluginId of pluginIds) {
			if (this.isPluginLocked(pluginId) !== shouldLock) {
				await this.performToggle(pluginId);
				affectedCount++;
			}
		}
		if (affectedCount > 0) {
			new Notice(t('BATCH_COMPLETE', { count: affectedCount.toString() }));
		}
	}

	async fixConflict(conflict: ConflictInfo) {
		if (conflict.type === ConflictType.VERSION_MISMATCH) {
			await this.togglePluginLock(conflict.pluginId);
			await this.togglePluginLock(conflict.pluginId);
		} else if (conflict.type === ConflictType.ORPHAN_LOCK) {
			const originalVersion = conflict.actualVersion.replace('9999.', '');
			await this.restorePluginVersion(conflict.pluginId, originalVersion);
		}
		await this.checkConflicts();
	}

	private async updatePluginManifestVersion(pluginId: string, version: string) {
		const manifestPath = normalizePath(`${this.plugin.app.vault.configDir}/plugins/${pluginId}/manifest.json`);
		const manifestContent = await this.plugin.app.vault.adapter.read(manifestPath);
		const manifest = JSON.parse(manifestContent) as ManifestJson;
		manifest.version = version;
		await this.plugin.app.vault.adapter.write(manifestPath, JSON.stringify(manifest, null, 2));
		if (this.plugin.app.plugins.manifests[pluginId]) {
			this.plugin.app.plugins.manifests[pluginId].version = version;
		}
	}

	private async restorePluginVersion(pluginId: string, version: string) {
		const manifestPath = normalizePath(`${this.plugin.app.vault.configDir}/plugins/${pluginId}/manifest.json`);
		const manifestContent = await this.plugin.app.vault.adapter.read(manifestPath);
		const manifest = JSON.parse(manifestContent) as ManifestJson;
		manifest.version = version;
		await this.plugin.app.vault.adapter.write(manifestPath, JSON.stringify(manifest, null, 2));
		if (this.plugin.app.plugins.manifests[pluginId]) {
			this.plugin.app.plugins.manifests[pluginId].version = version;
		}
	}

	// ---------------------------------------------------------------------------
	// Settings Rendering
	// ---------------------------------------------------------------------------

	renderSettings(containerEl: HTMLElement): void {
		// 自动检查开关
		new Setting(containerEl)
			.setName(t('AUTO_CHECK_CONFLICTS'))
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.autoCheckConflicts)
					.onChange(async value => {
						this.plugin.settings.autoCheckConflicts = value;
						await this.plugin.saveSettings();
					});
			});

		// 搜索与过滤
		new Setting(containerEl)
			.setName(t('SEARCH_PLUGINS'))
			.addSearch(searchComponent => {
				searchComponent.setValue(this.filterString);
				searchComponent.onChange(
					debounce((value: string) => {
						this.filterString = value.toLowerCase().trim();
						this.refreshList(listContainer);
					}, 250, true)
				);
				searchComponent.setPlaceholder(t('SEARCH_PLACEHOLDER'));
			});

		const controlsDiv = containerEl.createDiv({cls: 'pul-controls'});
		
		new Setting(controlsDiv)
			.setName(t('GROUP_BY_STATUS'))
			.addToggle(toggle => {
				toggle
					.setValue(this.groupByStatus)
					.onChange(value => {
						this.groupByStatus = value;
						this.refreshList(listContainer);
					});
			});

		new Setting(controlsDiv)
			.setName(t('SORT_BY'))
			.addDropdown(dropdown => {
				dropdown
					.addOption('name', t('SORT_NAME'))
					.addOption('status', t('SORT_STATUS'))
					.setValue(this.sortBy)
					.onChange((value: string) => {
						this.sortBy = value as 'name' | 'status';
						this.refreshList(listContainer);
					});
			});

		const batchDiv = controlsDiv.createDiv({cls: 'pul-batch-actions'});
		new Setting(batchDiv)
			.addButton(btn => btn
				.setButtonText(t('LOCK_ALL'))
				.onClick(async () => {
					await this.batchToggle(this.getVisibleIds(), true);
					this.refreshList(listContainer);
				}))
			.addButton(btn => btn
				.setButtonText(t('UNLOCK_ALL'))
				.onClick(async () => {
					await this.batchToggle(this.getVisibleIds(), false);
					this.refreshList(listContainer);
				}))
			.addButton(btn => btn
				.setButtonText(t('MANUAL_SCAN'))
				.onClick(async () => {
					await this.checkConflicts();
					this.refreshList(listContainer);
				}));

		const listContainer = containerEl.createDiv();
		this.refreshList(listContainer);
	}

	private getVisibleIds(): string[] {
		return this.originalPluginList
			.filter(p => this.matchesFilter(p))
			.map(p => p.id);
	}

	private matchesFilter(p: PluginManifest): boolean {
		return this.filterString === '' || 
			   p.name.toLowerCase().includes(this.filterString) || 
			   p.id.toLowerCase().includes(this.filterString);
	}

	private refreshList(containerEl: HTMLElement) {
		containerEl.empty();
		let filtered = this.originalPluginList.filter(p => this.matchesFilter(p));

		if (filtered.length === 0) {
			containerEl.createEl('p', { text: t('NO_MATCHING_PLUGINS'), cls: 'pul-no-plugins-found' });
			return;
		}

		if (this.groupByStatus) {
			const locked = filtered.filter(p => this.isPluginLocked(p.id));
			const unlocked = filtered.filter(p => !this.isPluginLocked(p.id));
			if (this.sortBy === 'name') {
				locked.sort((a, b) => a.name.localeCompare(b.name));
				unlocked.sort((a, b) => a.name.localeCompare(b.name));
			}
			if (locked.length > 0) {
				const headerEl = containerEl.createDiv({ cls: 'pul-group-header' });
				const iconEl = headerEl.createSpan({ cls: 'pul-group-header-icon' });
				setIcon(iconEl, 'lock');
				headerEl.createSpan({ text: t('LOCKED_GROUP_LABEL', { count: locked.length.toString() }) });
				locked.forEach(m => this.renderEntry(containerEl, m));
			}
			if (unlocked.length > 0) {
				const headerEl = containerEl.createDiv({ cls: 'pul-group-header' });
				const iconEl = headerEl.createSpan({ cls: 'pul-group-header-icon' });
				setIcon(iconEl, 'unlock');
				headerEl.createSpan({ text: t('UNLOCKED_GROUP_LABEL', { count: unlocked.length.toString() }) });
				unlocked.forEach(m => this.renderEntry(containerEl, m));
			}
		} else {
			if (this.sortBy === 'name') {
				filtered.sort((a, b) => a.name.localeCompare(b.name));
			} else {
				filtered.sort((a, b) => {
					const al = this.isPluginLocked(a.id), bl = this.isPluginLocked(b.id);
					return al === bl ? a.name.localeCompare(b.name) : (al ? -1 : 1);
				});
			}
			filtered.forEach(m => this.renderEntry(containerEl, m));
		}
	}

	private renderEntry(containerEl: HTMLElement, manifest: PluginManifest) {
		const lockInfo = this.plugin.settings.lockedPlugins.find(p => p.pluginId === manifest.id);
		const conflict = this.conflicts.find(c => c.pluginId === manifest.id);
		const snapshot = this.plugin.settings.snapshots.find(s => s.pluginId === manifest.id);

		const setting = new Setting(containerEl);
		
		// 插件名称点击查看 Changelog
		const nameEl = setting.nameEl.createSpan({ cls: 'pul-plugin-name-link' });
		nameEl.setText(manifest.name);
		nameEl.onClickEvent(async () => {
			const changelogModule = this.plugin.moduleManager.getAll().find(m => m.id === 'changelog') as ChangelogModule;
			if (changelogModule && this.plugin.moduleManager.isEnabled('changelog')) {
				const release = await changelogModule.fetchLatestReleaseForManifest(manifest);
				if (release) {
						new ReleaseNotesModal(this.plugin, manifest.name, release.tag_name, release.body).open();
				} else {
					new Notice(t('FETCH_ERROR', { pluginId: manifest.id }));
				}
			}
		});

		if (lockInfo) {
			const badge = setting.nameEl.createSpan({ cls: 'pul-version-badge' });
			badge.setText(lockInfo.originalVersion);
			setting.settingEl.addClass('pul-locked');
		}

		// 显示快照状态
		if (snapshot) {
			const snapshotDate = new Date(snapshot.timestamp).toLocaleDateString();
			const snapshotEl = setting.nameEl.createSpan({
				cls: 'pul-status-icon',
				attr: { title: t('SNAPSHOT_TOOLTIP', { version: snapshot.version, date: snapshotDate }) }
			});
			setIcon(snapshotEl, 'camera');
			setting.nameEl.createSpan({ 
				cls: 'pul-status-text',
				text: snapshot.version,
			});
		}

		// 异步获取最新版本并显示差异
		const changelogModule = this.plugin.moduleManager.getAll().find(m => m.id === 'changelog') as ChangelogModule;
		if (changelogModule && this.plugin.moduleManager.isEnabled('changelog')) {
			void changelogModule.fetchLatestReleaseForManifest(manifest).then(release => {
				if (release && release.tag_name.replace('v', '') !== manifest.version.replace('9999.', '')) {
					const diffSpan = setting.descEl.createSpan({ cls: 'pul-version-diff' });
					diffSpan.setText(` (${t('NEW_RELEASE_AVAILABLE', { version: release.tag_name })})`);
				}
			});
		}

		// 兼容性检查
		const compatModule = this.plugin.moduleManager.getAll().find(m => m.id === 'compatibility') as CompatibilityModule;
			if (compatModule && this.plugin.moduleManager.isEnabled('compatibility')) {
			const { compatible, current } = compatModule.checkCompatibility(manifest.minAppVersion);
			if (!compatible) {
				const warn = setting.nameEl.createSpan({ 
					cls: 'pul-compat-warn', 
					attr: { title: t('INCOMPATIBLE_WARNING', { minVersion: manifest.minAppVersion || '', currentVersion: current }) } 
				});
				setIcon(warn, 'alert-triangle');
			}
		}

		if (conflict) {
			setting.setDesc(conflict.type === ConflictType.VERSION_MISMATCH 
				? t('CONFLICT_MISMATCH', { version: conflict.actualVersion }) 
				: t('CONFLICT_ORPHAN'));
			setting.settingEl.addClass('pul-conflict');
			// eslint-disable-next-line @typescript-eslint/no-deprecated
		setting.addButton(btn => btn.setButtonText(t('FIX_CONFLICT')).setWarning().onClick(async () => {
				await this.fixConflict(conflict);
				this.refreshList(containerEl.parentElement!.querySelector(':scope > div:last-child') as HTMLElement);
			}));
		} else {
			setting.setDesc(lockInfo 
				? t('LOCKED_VERSION_DESC', { updatedVersion: lockInfo.updatedVersion, originalVersion: lockInfo.originalVersion })
				: t('CURRENT_VERSION_DESC', { version: manifest.version }))
			.addToggle(toggle => {
				toggle.setValue(!!lockInfo).onChange(async () => {
					await this.togglePluginLock(manifest.id);
					this.refreshList(containerEl.parentElement!.querySelector(':scope > div:last-child') as HTMLElement);
				});
			});
		}
	}
}

class ReleaseNotesModal extends Modal {
	constructor(
		private readonly plugin: PluginLockerPlugin,
		private name: string,
		private tag: string,
		private body: string
	) {
		super(plugin.app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createDiv({ cls: 'pul-release-notes-title', text: `${this.name} ${this.tag}` });
		const bodyEl = contentEl.createDiv({ cls: 'pul-release-notes' });
		void MarkdownRenderer.render(this.app, this.body, bodyEl, '', this as unknown as Component);
	}

	onClose() {
		this.contentEl.empty();
	}
}
