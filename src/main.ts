import {App, Plugin, PluginSettingTab, Setting, debounce} from 'obsidian';
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
		const pluginDir = (this.app.vault.adapter as any).getBasePath() + `/.obsidian/plugins/${pluginId}`;
		const manifestPath = `${pluginDir}/manifest.json`;

		if (this.isPluginLocked(pluginId)) {
			const index = this.settings.lockedPlugins.findIndex(plugin => plugin.pluginId === pluginId);
			if (index !== -1) {
				const { originalVersion } = this.settings.lockedPlugins[index];
				this.restorePluginVersion(pluginId, originalVersion);
				this.settings.lockedPlugins.splice(index, 1);
			}
		} else {
			try {
				if (fs.existsSync(manifestPath)) {
					const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
					const originalVersion = manifest.version;
					const updatedVersion = `9999.${originalVersion}`;
					this.settings.lockedPlugins.push({ pluginId, originalVersion, updatedVersion });
					this.updatePluginManifestVersion(pluginId, updatedVersion);
				}
			} catch (error) {
				console.error(`Failed to process version information for ${pluginId}:`, error);
			}
		}
		this.saveSettings();
	}

	updatePluginManifestVersion(pluginId: string, version: string) {
		const pluginDir = (this.app.vault.adapter as any).getBasePath() + `/.obsidian/plugins/${pluginId}`;
		const manifestPath = `${pluginDir}/manifest.json`;

		try {
			if (fs.existsSync(manifestPath)) {
				const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
				manifest.version = version;
				fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
				console.log(`Updated version of ${pluginId} to ${version}`);
			}
		} catch (error) {
			console.error(`Failed to update version for ${pluginId}:`, error);
		}
	}

	restorePluginVersion(pluginId: string, version: string) {
		const pluginDir = (this.app.vault.adapter as any).getBasePath() + `/.obsidian/plugins/${pluginId}`;
		const manifestPath = `${pluginDir}/manifest.json`;

		try {
			if (fs.existsSync(manifestPath)) {
				const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
				manifest.version = version;
				fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
				console.log(`Restored version of ${pluginId} to ${version}`);
			}
		} catch (error) {
			console.error(`Failed to restore version for ${pluginId}:`, error);
		}
	}
}

class PluginLockerSettingTab extends PluginSettingTab {
	plugin: PluginLockerPlugin;
	filterString: string = '';
	settingsContainerEl: HTMLElement;
	originalPluginList: string[];

	constructor(app: App, plugin: PluginLockerPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		// 预先获取并缓存插件列表
		this.originalPluginList = Object.keys(
			(this.app as any).plugins.manifests || {}
		).filter(
			(pluginId) =>
				!(this.app as any).plugins.manifests[pluginId].isBuiltin &&
				pluginId !== this.plugin.manifest.id
		);
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		containerEl.createEl('h2', {text: 'Plugin Update Locker'});

		// 添加搜索设置
		new Setting(containerEl)
			.setName('Search Plugins')
			.addSearch((searchComponent) => {
				searchComponent.setValue(this.filterString);
				searchComponent.onChange(
					debounce((value: string) => {
						this.filterString = value.toLowerCase().trim();
						this.filterPluginList();
					}, 250, true)
				);
				searchComponent.setPlaceholder('Search plugins...');
			});

		// 创建插件列表容器
		this.settingsContainerEl = containerEl.createDiv();

		// 初始渲染插件列表
		this.filterPluginList();
	}

	filterPluginList() {
		const filteredPlugins = this.originalPluginList.filter((pluginId) => {
			const manifest = (this.app as any).plugins.manifests[pluginId];
			const pluginName = (manifest.name || pluginId).toLowerCase();
			return this.filterString === '' || pluginName.includes(this.filterString);
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

		filteredPlugins.forEach((pluginId) => {
			const manifest = (this.app as any).plugins.manifests[pluginId];
			const lockInfo = this.plugin.settings.lockedPlugins.find(plugin => plugin.pluginId === pluginId);

			new Setting(this.settingsContainerEl)
				.setName(manifest.name || pluginId)
				.setDesc(
					lockInfo
						? `Locked version: ${lockInfo.updatedVersion}, Original version: ${lockInfo.originalVersion}`
						: `Locking will prevent ${manifest.name || pluginId} from updating`
				)
				.addToggle((toggle) => {
					toggle
						.setValue(!!lockInfo)
						.onChange(() => {
							this.plugin.togglePluginLock(pluginId);
							this.display(); // 重新渲染整个设置界面
						});
				});
		});
	}
}
