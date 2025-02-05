import {App, Plugin, PluginSettingTab, Setting, debounce, PluginManifest} from 'obsidian';

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

interface PluginSystem {
	manifests: Record<string, PluginManifest>;
}

declare module 'obsidian' {
	interface App {
		plugins: PluginSystem;
	}
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

	async togglePluginLock(pluginId: string) {
		const manifestPath = `${this.app.vault.configDir}/plugins/${pluginId}/manifest.json`;

		if (this.isPluginLocked(pluginId)) {
			const index = this.settings.lockedPlugins.findIndex(plugin => plugin.pluginId === pluginId);
			if (index !== -1) {
				const {originalVersion} = this.settings.lockedPlugins[index];
				await this.restorePluginVersion(pluginId, originalVersion);
				this.settings.lockedPlugins.splice(index, 1);
			}
		} else {
			try {
				const manifestContent = await this.app.vault.adapter.read(manifestPath);
				const manifest = JSON.parse(manifestContent);
				const originalVersion = manifest.version;
				const updatedVersion = `9999.${originalVersion}`;
				this.settings.lockedPlugins.push({pluginId, originalVersion, updatedVersion});
				await this.updatePluginManifestVersion(pluginId, updatedVersion);
			} catch (error) {
				console.error(`Failed to process version information for ${pluginId}:`, error);
			}
		}
		await this.saveSettings();
	}

	async updatePluginManifestVersion(pluginId: string, version: string) {
		const manifestPath = `${this.app.vault.configDir}/plugins/${pluginId}/manifest.json`;

		try {
			const manifestContent = await this.app.vault.adapter.read(manifestPath);
			const manifest = JSON.parse(manifestContent);
			manifest.version = version;
			await this.app.vault.adapter.write(
				manifestPath,
				JSON.stringify(manifest, null, 2)
			);
			console.log(`Updated version of ${pluginId} to ${version}`);
		} catch (error) {
			console.error(`Failed to update version for ${pluginId}:`, error);
		}
	}

	async restorePluginVersion(pluginId: string, version: string) {
		const manifestPath = `${this.app.vault.configDir}/plugins/${pluginId}/manifest.json`;

		try {
			const manifestContent = await this.app.vault.adapter.read(manifestPath);
			const manifest = JSON.parse(manifestContent);
			manifest.version = version;
			await this.app.vault.adapter.write(
				manifestPath,
				JSON.stringify(manifest, null, 2)
			);
			console.log(`Restored version of ${pluginId} to ${version}`);
		} catch (error) {
			console.error(`Failed to restore version for ${pluginId}:`, error);
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
			.filter(manifest => manifest.id !== this.plugin.manifest.id);
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		// 搜索框
		new Setting(containerEl)
			.setName('Search plugins')
			.addSearch(searchComponent => {
				searchComponent.setValue(this.filterString);
				searchComponent.onChange(
					debounce((value: string) => {
						this.filterString = value.toLowerCase().trim();
						this.filterPluginList();
					}, 250, true)
				);
				searchComponent.setPlaceholder('Type to search...');
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
						? `Locked version: ${lockInfo.updatedVersion} (original: ${lockInfo.originalVersion})`
						: `When locked, ${manifest.name} will not update automatically`
				)
				.addToggle(toggle => {
					toggle
						.setValue(!!lockInfo)
						.onChange(async () => {
							await this.plugin.togglePluginLock(manifest.id);
							this.display();
						});
				});
		});
	}
}
