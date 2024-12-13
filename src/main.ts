import {App, Plugin, PluginSettingTab, Setting} from 'obsidian';
import * as fs from 'fs';

interface PluginLockerSettings {
	lockedPlugins: string[];
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
		return this.settings.lockedPlugins.includes(pluginId);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	togglePluginLock(pluginId: string) {
		const index = this.settings.lockedPlugins.indexOf(pluginId);
		if (index > -1) {
			this.settings.lockedPlugins.splice(index, 1);
			// 恢复插件的原始 version（可选实现）
			this.restorePluginVersion(pluginId);
		} else {
			this.settings.lockedPlugins.push(pluginId);
			// 更新插件的 version 为更高版本
			this.updatePluginManifestVersion(pluginId);
		}
		this.saveSettings();
	}

	/**
	 * 更新插件的 manifest.json 的 version
	 */
	updatePluginManifestVersion(pluginId: string) {
		const pluginDir = (this.app.vault.adapter as any).getBasePath() + `/.obsidian/plugins/${pluginId}`;
		const manifestPath = `${pluginDir}/manifest.json`;

		try {
			if (fs.existsSync(manifestPath)) {
				const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
				// 更新版本号到一个足够大的值
				manifest.version = '9999.0.0';
				fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
				console.log(`已更新 ${pluginId} 的版本号到 9999.0.0`);
			}
		} catch (error) {
			console.error(`无法更新 ${pluginId} 的版本号:`, error);
		}
	}

	/**
	 * 恢复插件的原始 manifest.json 的 version（可选实现）
	 */
	restorePluginVersion(pluginId: string) {
		console.log(`恢复插件 ${pluginId} 的版本号为原始状态`);
	}
}

class PluginLockerSettingTab extends PluginSettingTab {
	plugin: PluginLockerPlugin;

	constructor(app: App, plugin: PluginLockerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		//插件更新锁定器
		containerEl.createEl('h2', {text: 'Plugin Update Locker'});

		const installedPlugins = Object.keys(
			(this.app as any).plugins.manifests || {}
		).filter(
			(pluginId) =>
				!(this.app as any).plugins.manifests[pluginId].isBuiltin &&
				pluginId !== this.plugin.manifest.id
		);

		installedPlugins.forEach((pluginId) => {
			const manifest = (this.app as any).plugins.manifests[pluginId];

			new Setting(containerEl)
				.setName(manifest.name || pluginId)
				.setDesc(`锁定后将阻止 ${manifest.name || pluginId} 插件更新`)
				.addToggle((toggle) => {
					const isLocked = this.plugin.settings.lockedPlugins.includes(pluginId);

					toggle
						.setValue(isLocked)
						.onChange(() => {
							this.plugin.togglePluginLock(pluginId);
						});
				});
		});
	}
}
