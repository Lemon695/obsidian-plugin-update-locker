import { Plugin } from 'obsidian';
import { ModuleManager } from './core/module-manager';
import { PluginLockerSettingTab } from './core/settings-tab';
import { DEFAULT_SETTINGS, PluginLockerSettings } from './core/types';
import { LockerModule } from './modules/locker';
import { SnapshotModule } from './modules/snapshot';
import { ChangelogModule } from './modules/changelog';
import { CompatibilityModule } from './modules/compatibility';
import { SyncModule } from './modules/sync';

/**
 * PluginLockerPlugin - Obsidian 插件入口
 */
export default class PluginLockerPlugin extends Plugin {
	settings!: PluginLockerSettings;
	moduleManager!: ModuleManager;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.moduleManager = new ModuleManager(this);

		// ----- 注册模块 ------------------------------------------------------
		this.moduleManager.register(new LockerModule(this));
		this.moduleManager.register(new SnapshotModule(this));
		this.moduleManager.register(new ChangelogModule(this));
		this.moduleManager.register(new CompatibilityModule(this));
		this.moduleManager.register(new SyncModule(this));
		// --------------------------------------------------------------------

		await this.moduleManager.loadAll();

		this.addSettingTab(new PluginLockerSettingTab(this.app, this));
	}

	onunload(): void {
		this.moduleManager.onunload();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<PluginLockerSettings>
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
