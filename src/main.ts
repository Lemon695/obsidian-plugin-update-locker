import {App, Plugin, PluginSettingTab, Setting, debounce, FileSystemAdapter} from 'obsidian';
import * as fs from 'fs';

interface PluginLockInfo {
	pluginId: string;
	originalVersion: string;
	updatedVersion: string;
}

interface PluginLockerSettings {
	lockedPlugins: PluginLockInfo[];
}

const DEFAULT_SETTINGS: PluginLockerSettings = {
	lockedPlugins: [],
};

export interface PluginManifest {
	dir?: string;
	id: string;
	name: string;
	author: string;
	version: string;
	minAppVersion: string;
	description: string;
	authorUrl?: string;
	isDesktopOnly?: boolean;
}

interface PluginSystem {
	manifests: Record<string, PluginManifest>;
}

declare module 'obsidian' {
	interface App {
		plugins: PluginSystem;
	}
}

export abstract class BasePlugin extends Plugin {
	app: App;
	manifest: PluginManifest;
}

export default class PluginLockerPlugin extends Plugin {
	settings: PluginLockerSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new PluginLockerSettingTab(this.app, this));
	}

	isPluginLocked(pluginId: string): boolean {
		return this.settings.lockedPlugins.some(plugin => plugin.pluginId === pluginId);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	togglePluginLock(pluginId: string) {
		if (this.app.vault.adapter instanceof FileSystemAdapter) {
			const pluginDir = `${this.app.vault.adapter.getBasePath()}/${this.app.vault.configDir}/plugins/${pluginId}`;
			const manifestPath = `${pluginDir}/manifest.json`;

			if (this.isPluginLocked(pluginId)) {
				const index = this.settings.lockedPlugins.findIndex(plugin => plugin.pluginId === pluginId);
				if (index !== -1) {
					const {originalVersion} = this.settings.lockedPlugins[index];
					this.restorePluginVersion(pluginId, originalVersion);
					this.settings.lockedPlugins.splice(index, 1);
				}
			} else {
				try {
					if (fs.existsSync(manifestPath)) {
						const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as PluginManifest;
						const originalVersion = manifest.version;
						const updatedVersion = `9999.${originalVersion}`;
						this.settings.lockedPlugins.push({pluginId, originalVersion, updatedVersion});
						this.updatePluginManifestVersion(pluginId, updatedVersion);
					}
				} catch (error) {
					console.error(`Failed to process version information for ${pluginId}:`, error);
				}
			}
			this.saveSettings();
		}
	}

	updatePluginManifestVersion(pluginId: string, version: string) {
		if (this.app.vault.adapter instanceof FileSystemAdapter) {
			const pluginDir = `${this.app.vault.adapter.getBasePath()}/${this.app.vault.configDir}/plugins/${pluginId}`;
			const manifestPath = `${pluginDir}/manifest.json`;

			try {
				if (fs.existsSync(manifestPath)) {
					const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as PluginManifest;
					manifest.version = version;
					fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
					console.log(`Updated version of ${pluginId} to ${version}`);
				}
			} catch (error) {
				console.error(`Failed to update version for ${pluginId}:`, error);
			}
		}
	}

	restorePluginVersion(pluginId: string, version: string) {
		if (this.app.vault.adapter instanceof FileSystemAdapter) {
			const pluginDir = `${this.app.vault.adapter.getBasePath()}/${this.app.vault.configDir}/plugins/${pluginId}`;
			const manifestPath = `${pluginDir}/manifest.json`;

			try {
				if (fs.existsSync(manifestPath)) {
					const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as PluginManifest;
					manifest.version = version;
					fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
					console.log(`Restored version of ${pluginId} to ${version}`);
				}
			} catch (error) {
				console.error(`Failed to restore version for ${pluginId}:`, error);
			}
		}
	}
}

class PluginLockerSettingTab extends PluginSettingTab {
	plugin: PluginLockerPlugin;
	filterString: string = '';
	settingsContainerEl: HTMLElement;
	originalPluginList: PluginManifest[];

	constructor(app: App, plugin: PluginLockerPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		// 获取插件列表并缓存
		const pluginManifests = this.app.plugins.manifests;
		this.originalPluginList = Object.values(pluginManifests)
			.filter(manifest => !manifest.isDesktopOnly && manifest.id !== this.plugin.manifest.id);
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		containerEl.createEl('h2', {text: 'Plugin Update Locker'});

		// 搜索框
		new Setting(containerEl)
			.setName('Search Plugins')
			.addSearch(searchComponent => {
				searchComponent.setValue(this.filterString);
				searchComponent.onChange(
					debounce((value: string) => {
						this.filterString = value.toLowerCase().trim();
						this.filterPluginList();
					}, 250, true)
				);
				searchComponent.setPlaceholder('Search plugins...');
			});

		// 插件列表容器
		this.settingsContainerEl = containerEl.createDiv();

		// 初始渲染插件列表
		this.filterPluginList();
	}

	filterPluginList() {
		const filteredPlugins = this.originalPluginList.filter(plugin => {
			return (
				this.filterString === '' ||
				plugin.name.toLowerCase().includes(this.filterString)
			);
		});

		// 清空之前的列表
		this.settingsContainerEl.empty();

		if (filteredPlugins.length === 0) {
			this.settingsContainerEl.createEl('p', {
				text: 'No matching plugins found',
				cls: 'no-plugins-found'
			});
			return;
		}

		filteredPlugins.forEach(manifest => {
			const lockInfo = this.plugin.settings.lockedPlugins.find(
				plugin => plugin.pluginId === manifest.id
			);

			new Setting(this.settingsContainerEl)
				.setName(manifest.name)
				.setDesc(
					lockInfo
						? `Locked version: ${lockInfo.updatedVersion}, Original version: ${lockInfo.originalVersion}`
						: `Locking will prevent ${manifest.name} from updating`
				)
				.addToggle(toggle => {
					toggle
						.setValue(!!lockInfo)
						.onChange(() => {
							this.plugin.togglePluginLock(manifest.id);
							this.display(); // 重新渲染界面
						});
				});
		});
	}
}
