import Gio from "gi://Gio";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { AppSearchProvider } from "resource:///org/gnome/shell/ui/appDisplay.js";
// import DemoSearchProvider from "./provider/demo.js";
import VSCodeSearchProvider from "./provider/vscode.js";
import {
    IdeaICSearchProvider,
    PyCharmCESearchProvider,
} from "./provider/jetbrains.js";

export default function provider<
    E extends Extension & { _settings: Gio.Settings | null },
>(extension: E): Array<AppSearchProvider> {
    return [
        // new DemoSearchProvider(extension),
        new VSCodeSearchProvider(extension),
        new IdeaICSearchProvider(extension),
        new PyCharmCESearchProvider(extension),
    ];
}
