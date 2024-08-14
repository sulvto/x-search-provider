import Glib from "gi://GLib";
import Gio from "gi://Gio";
import Shell from "gi://Shell";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { AppSearchProvider } from "resource:///org/gnome/shell/ui/appDisplay.js";
import { read_file, file_exists } from "../util.js";

interface VSStorage {
    profileAssociations: {
        workspaces: Record<string, string>;
    };
}

export default class VSCodeSearchProvider<
    T extends Extension & { _settings: Gio.Settings | null },
> implements AppSearchProvider
{
    _workspaces: Record<string, { name: string; path: string }> = {};
    _extension: T;
    _app: Shell.App | null = null;
    appInfo: Gio.DesktopAppInfo | undefined;

    constructor(extension: T) {
        this._extension = extension;
        this.findApp();
        this.loadWorkspaces();
        this.appInfo = this._app?.appInfo;
        console.debug("VSCodeSearchProvider init.");
    }

    loadWorkspaces() {
        const globalStorage = this.readCodeStorage();
        if (!globalStorage) {
            console.error("Failed to read vscode storage.json");
            return;
        }

        const paths = Object.keys(
            globalStorage.profileAssociations.workspaces,
        ).sort();

        this._workspaces = {};
        for (const path of paths.map(decodeURIComponent)) {
            if (path.startsWith("vscode-remote://dev-container")) {
                continue;
            }
            const name = path.split("/").pop()!;
            const id = `code-workspace-${Object.keys(this._workspaces).length}`;
            this._workspaces[id] = {
                name: name.replace(".code-workspace", " Workspace"),
                path: path.replace("file://", ""),
            };
        }
    }

    readCodeStorage(): VSStorage | undefined {
        const configDirs = [
            Glib.get_user_config_dir(),
            `${Glib.get_home_dir()}/.var/app`,
        ];

        const appDirs = [
            // XDG_CONFIG_DIRS
            "Code",
            "Code - Insiders",
            "VSCodium",
            "VSCodium - Insiders",

            // Flatpak
            "com.vscodium.codium/config/VSCodium",
            "com.vscodium.codium-insiders/config/VSCodium - Insiders",
        ];

        for (const configDir of configDirs) {
            for (const appDir of appDirs) {
                const path = `${configDir}/${appDir}/User/globalStorage/storage.json`;
                if (!file_exists(path)) {
                    continue;
                }

                const storage = read_file(path);

                if (storage) {
                    return JSON.parse(storage);
                }
            }
        }
    }

    findApp() {
        const names = [
            "code",
            "code-insiders",
            "code-oss",
            "com.vscodium.codium",
            "com.vscodium.codium-insiders",
        ];

        for (let i = 0; !this._app && i < names.length; i++) {
            this._app = Shell.AppSystem.get_default().lookup_app(
                names[i] + ".desktop",
            );
        }

        if (!this._app) {
            console.error("Failed to find vscode application");
        }
    }

    customSuffix(path: string) {
        if (!this._extension?._settings?.get_boolean("suffix")) {
            return "";
        }

        const prefixes = {
            "vscode-remote://codespaces": "[Codespaces]",
            "vscode-remote://": "[Remote]",
            "vscode-vfs://github": "[Github]",
        };

        for (const prefix of Object.keys(prefixes)) {
            if (path.startsWith(prefix)) {
                return " " + prefixes[prefix as keyof typeof prefixes];
            }
        }

        return "";
    }

    activateResult(result: string): void {
        if (this._app) {
            const path = this._workspaces[result].path;
            if (
                path.startsWith("vscode-remote://") ||
                path.startsWith("vscode-vfs://")
            ) {
                const lastSegment = path.split("/").pop();
                const type = lastSegment?.slice(1)?.includes(".")
                    ? "file"
                    : "folder";

                const command =
                    this._app?.app_info.get_executable() +
                    " --" +
                    type +
                    "-uri " +
                    path;
                Glib.spawn_command_line_async(command);
            } else {
                this._app?.app_info.launch([Gio.file_new_for_path(path)], null);
            }
        }
    }

    filterResults(results: string[], maxResults: number) {
        return results.slice(0, maxResults);
    }

    async getInitialResultSet(terms: string[]) {
        this.loadWorkspaces();
        const searchTerm = terms.join("").toLowerCase();
        return Object.keys(this._workspaces).filter((id) =>
            this._workspaces[id].name.toLowerCase().includes(searchTerm),
        );
    }

    async getSubsearchResultSet(previousResults: string[], terms: string[]) {
        if (previousResults.length === 0) {
            return this.getInitialResultSet(terms);
        } else {
            const searchTerm = terms.join("").toLowerCase();
            return previousResults.filter((id) =>
                this._workspaces[id].name.toLowerCase().includes(searchTerm),
            );
        }
    }

    async getResultMetas(ids: string[]) {
        return ids.map((id) => ({
            id,
            name:
                this._workspaces[id].name +
                this.customSuffix(this._workspaces[id].path),
            description: this._workspaces[id].path,
            createIcon: (size: number) => this._app?.create_icon_texture(size),
        }));
    }
}
