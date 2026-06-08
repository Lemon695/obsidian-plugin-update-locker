import { requestUrl, PluginManifest } from 'obsidian';
import type { PluginModule } from '../../core/types';
import type PluginLockerPlugin from '../../main';
import { t } from '../../i18n/locale';

interface GitHubRelease {
	tag_name: string;
	body: string;
	published_at: string;
}

export class ChangelogModule implements PluginModule {
	id = 'changelog';
	name = t('CHANGELOG_MODULE_NAME');
	description = t('CHANGELOG_MODULE_DESC');

	private cache: Map<string, { release: GitHubRelease, expiry: number }> = new Map();
	private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour

	constructor(private readonly plugin: PluginLockerPlugin) {}

	async onload(): Promise<void> {}
	onunload(): void {}

	async fetchLatestReleaseForManifest(manifest: PluginManifest): Promise<GitHubRelease | null> {
		const repoCandidates = this.resolveRepoCandidates(manifest);

		for (const repo of repoCandidates) {
			const release = await this.fetchLatestReleaseByRepo(repo);
			if (release) {
				return release;
			}
		}

		return null;
	}

	async fetchLatestRelease(author: string, pluginId: string): Promise<GitHubRelease | null> {
		return this.fetchLatestReleaseByRepo(`${author}/${pluginId}`);
	}

	private resolveRepoCandidates(manifest: PluginManifest): string[] {
		const candidates: string[] = [];
		const authorUrl = typeof manifest.authorUrl === 'string' ? manifest.authorUrl : '';
		const githubPath = this.extractGitHubPath(authorUrl);

		if (githubPath) {
			const parts = githubPath.split('/').filter(Boolean);
			if (parts.length >= 2) {
				candidates.push(`${parts[0]}/${parts[1]}`);
			} else if (parts.length === 1) {
				candidates.push(`${parts[0]}/${manifest.id}`);
			}
		}

		if (/^[A-Za-z0-9_.-]+$/.test(manifest.author)) {
			candidates.push(`${manifest.author}/${manifest.id}`);
		}

		return [...new Set(candidates)];
	}

	private extractGitHubPath(url: string): string | null {
		try {
			const parsed = new URL(url);
			if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') {
				return null;
			}

			return parsed.pathname.replace(/^\/+|\/+$/g, '');
		} catch {
			return null;
		}
	}

	private async fetchLatestReleaseByRepo(repo: string): Promise<GitHubRelease | null> {
		const cacheKey = repo;
		const cached = this.cache.get(cacheKey);
		if (cached && cached.expiry > Date.now()) {
			return cached.release;
		}

		try {
			const url = `https://api.github.com/repos/${repo}/releases/latest`;
			const response = await requestUrl({ url });
			
			if (response.status === 200) {
				const release = response.json as GitHubRelease;
				this.cache.set(cacheKey, { 
					release, 
					expiry: Date.now() + this.CACHE_TTL 
				});
				return release;
			}
		} catch (e) {
			console.error(`Failed to fetch GitHub release for ${repo}`, e);
		}
		return null;
	}

	renderSettings(containerEl: HTMLElement): void {
		containerEl.createEl('p', { text: this.description });
	}
}
