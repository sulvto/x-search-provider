import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { AppSearchProvider } from "resource:///org/gnome/shell/ui/appDisplay.js";
import provider from "./provider.js";

export default class XSearchProviderExtension extends Extension {
    _settings: Gio.Settings | null = null;
    _provider_list: Array<AppSearchProvider> | null = null;

    enable() {
        this._settings = this.getSettings();
        this._provider_list = provider(this);
        for (const provider of this._provider_list) {
            Main.overview.searchController.addProvider(provider);
        }
    }

    disable() {
        this._settings = null;
        if (this._provider_list) {
            for (const provider of this._provider_list) {
                Main.overview.searchController.removeProvider(provider);
            }
            this._provider_list = null;
        }
    }
}
