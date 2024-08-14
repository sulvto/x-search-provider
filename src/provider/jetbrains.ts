import St from "gi://St";
import Gio from "gi://Gio";
import Glib from "gi://GLib";
import Shell from "gi://Shell";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import {
    AppSearchProvider,
    ResultMeta,
} from "resource:///org/gnome/shell/ui/appDisplay.js";
import { file_ls, read_file } from "../util.js";

class JetBrainsProviderDefinition {
    name: string;
    desktop_name: string;
    dir_prefix: string;

    constructor(
        name: string,
        desktop_name: string,
        dir_prefix: string | null = null,
    ) {
        this.name = name;
        this.desktop_name = desktop_name.startsWith("jetbrains-")
            ? desktop_name
            : `jetbrains-${desktop_name}`;
        this.dir_prefix = dir_prefix == null ? this.name : dir_prefix;
    }
}

class JetBrainsSearchProvider<T extends Extension>
    implements AppSearchProvider
{
    _extension: T;
    _app: Shell.App | null = null;
    appInfo: Gio.DesktopAppInfo | undefined;
    _provider: JetBrainsProviderDefinition;
    _recent_projects: Record<string, { name: string; path: string }> = {};

    constructor(extension: T, provider: JetBrainsProviderDefinition) {
        this._extension = extension;
        this._recent_projects = {};
        this._provider = provider;
        this.findApp();
        this.loadRecentProjects();
        this.appInfo = this._app?.appInfo;
        console.debug("JetBrainsSearchProvider init.");
    }

    findApp() {
        this._app = Shell.AppSystem.get_default().lookup_app(
            `${this._provider.desktop_name}.desktop`,
        );

        if (!this._app) {
            console.error("Failed to find JetBrains application");
        }
    }

    /**
     * IdeaIC2023.1
     * IdeaIC2023.3
     * IdeaIC2024.1 <--
     *
     *
     * @returns {String | undefined}
     */
    findLatestConfigDir(
        provider: JetBrainsProviderDefinition,
    ): string | undefined {
        const dir = file_ls(`${Glib.get_user_config_dir()}/JetBrains/`);
        let latest_version = 0;
        let latest_config_dir_name = null;
        for (const file of dir) {
            const file_name = file.get_name();
            if (file_name.startsWith(provider.dir_prefix)) {
                console.debug(
                    `Found ${provider.name} config dir: ${file_name}`,
                );
                const version = Number.parseFloat(
                    file_name.replace(provider.dir_prefix, ""),
                );
                if (version > latest_version) {
                    latest_version = version;
                    latest_config_dir_name = file_name;
                }
            }
        }

        if (latest_version === 0) {
            return;
        }
        return `${Glib.get_user_config_dir()}/JetBrains/${latest_config_dir_name}`;
    }

    loadRecentProjects() {
        if (this._app) {
            const config_dir = this.findLatestConfigDir(this._provider);
            if (!config_dir) {
                console.warn(this._provider.name, "config dir not found.");
                return;
            }
            // TODO: cache recent projects
            const recent_projects_content = read_file(
                `${config_dir}/options/recentProjects.xml`,
            );
            if (recent_projects_content) {
                this.parseRecentProjects(recent_projects_content);
            } else {
                console.debug("recentProjects.xml is empty.");
            }
        }
    }

    parseRecentProjects(content: string) {
        // example: <entry key="$USER_HOME$/development/leetcode">
        const recent_projects = content.matchAll(/<entry key="([^"]+)">/g);
        while (true) {
            const match = recent_projects.next();
            if (match.done) {
                break;
            }

            const id = `recent_project_${Object.keys(this._recent_projects).length}`;
            const path = match.value[1].replace(
                "$USER_HOME$",
                Glib.get_home_dir(),
            );
            const name = path.split("/").pop();

            this._recent_projects[id] = {
                path: path,
                name: name ? name : path,
            };
        }

        if (Object.keys(this._recent_projects).length == 0) {
            console.debug("No recent projects found.");
        }
    }

    activateResult(result: string): void {
        if (this._app) {
            const path = this._recent_projects[result].path;
            this._app?.app_info.launch([Gio.file_new_for_path(path)], null);
        }
    }

    filterResults(results: string[], maxResults: number) {
        if (results.length <= maxResults) return results;
        return results.slice(0, maxResults);
    }

    async getInitialResultSet(terms: string[]): Promise<string[]> {
        this.loadRecentProjects();
        const searchTerm = terms.join("").toLowerCase();
        return Object.keys(this._recent_projects).filter((id) => {
            const recent_project = this._recent_projects[id];
            return recent_project.name.toLowerCase().includes(searchTerm);
        });
    }

    async getSubsearchResultSet(results: string[], terms: string[]) {
        if (results.length === 0) {
            return this.getInitialResultSet(terms);
        } else {
            const searchTerm = terms.join("").toLowerCase();
            return results.filter((id) => {
                const recent_project = this._recent_projects[id];
                return recent_project.name.toLowerCase().includes(searchTerm);
            });
        }
    }

    async getResultMetas(ids: string[]) {
        return ids.map((id) => ({
            id,
            name: this._recent_projects[id].name,
            description: this._recent_projects[id].path,
            createIcon: (size: number) => this._app?.create_icon_texture(size),
        }));
    }
}

export class CLionSearchProvider<
    T extends Extension,
> extends JetBrainsSearchProvider<T> {
    constructor(extension: T) {
        super(
            extension,
            new JetBrainsProviderDefinition("CLion", "jetbrains-clion"),
        );
    }
}

export class GoLandSearchProvider<
    T extends Extension,
> extends JetBrainsSearchProvider<T> {
    constructor(extension: T) {
        super(
            extension,
            new JetBrainsProviderDefinition("GoLand", "jetbrains-goland"),
        );
    }
}

export class IdeaSearchProvider<
    T extends Extension,
> extends JetBrainsSearchProvider<T> {
    constructor(extension: T) {
        super(
            extension,
            new JetBrainsProviderDefinition("IDEA", "jetbrains-idea", "Idea"),
        );
    }
}

export class IdeaICSearchProvider<
    T extends Extension,
> extends JetBrainsSearchProvider<T> {
    constructor(extension: T) {
        super(
            extension,
            new JetBrainsProviderDefinition(
                "IDEA Community Edition",
                "jetbrains-idea-ce",
                "IdeaIC",
            ),
        );
    }
}

export class PyCharmSearchProvider<
    T extends Extension,
> extends JetBrainsSearchProvider<T> {
    constructor(extension: T) {
        super(
            extension,
            new JetBrainsProviderDefinition("PyCharm", "jetbrains-pycharm"),
        );
    }
}

export class PyCharmCESearchProvider<
    T extends Extension,
> extends JetBrainsSearchProvider<T> {
    constructor(extension: T) {
        super(
            extension,
            new JetBrainsProviderDefinition(
                "PyCharm Community Edition",
                "jetbrains-pycharm-ce",
                "PyCharmCE",
            ),
        );
    }
}

export class PHPStormSearchProvider<
    T extends Extension,
> extends JetBrainsSearchProvider<T> {
    constructor(extension: T) {
        super(
            extension,
            new JetBrainsProviderDefinition("PHPStorm", "jetbrains-phpstorm"),
        );
    }
}

export class RiderSearchProvider<
    T extends Extension,
> extends JetBrainsSearchProvider<T> {
    constructor(extension: T) {
        super(
            extension,
            new JetBrainsProviderDefinition("Rider", "jetbrains-rider"),
        );
    }
}

export class RubyMineSearchProvider<
    T extends Extension,
> extends JetBrainsSearchProvider<T> {
    constructor(extension: T) {
        super(
            extension,
            new JetBrainsProviderDefinition("RubyMine", "jetbrains-rubymine"),
        );
    }
}

export class RustRoverSearchProvider<
    T extends Extension,
> extends JetBrainsSearchProvider<T> {
    constructor(extension: T) {
        super(
            extension,
            new JetBrainsProviderDefinition("RustRover", "jetbrains-rustrover"),
        );
    }
}
