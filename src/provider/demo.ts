import St from "gi://St";
import Gio from "gi://Gio";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import {
    AppSearchProvider,
    ResultMeta,
} from "resource:///org/gnome/shell/ui/appDisplay.js";

export default class DemoSearchProvider<
    T extends Extension & { _settings: Gio.Settings | null },
> implements AppSearchProvider
{
    _extension: T;
    appInfo: Gio.DesktopAppInfo | undefined;

    constructor(extension: T) {
        this._extension = extension;
    }

    activateResult(result: string, terms: string[]): void {
        console.debug(`activateResult(${result}, [${terms}])`);
    }

    filterResults(results: string[], maxResults: number) {
        console.debug(`filterResults([${results}], ${maxResults})`);

        if (results.length <= maxResults) return results;

        return results.slice(0, maxResults);
    }

    getInitialResultSet(
        terms: string[],
        cancellable: Gio.Cancellable,
    ): Promise<string[]> {
        console.debug(`getInitialResultSet([${terms}])`);

        return new Promise((resolve, reject) => {
            const cancelledId = cancellable.connect(() =>
                reject(Error("Search Cancelled")),
            );

            const identifiers = ["result-01", "result-02", "result-03"];

            cancellable.disconnect(cancelledId);
            if (!cancellable.is_cancelled()) resolve(identifiers);
        });
    }

    async getSubsearchResultSet(
        results: string[],
        terms: string[],
        cancellable: Gio.Cancellable,
    ) {
        console.debug(`getSubsearchResultSet([${results}], [${terms}])`);

        if (cancellable.is_cancelled()) throw Error("Search Cancelled");

        return this.getInitialResultSet(terms, cancellable);
    }

    getResultMetas(
        results: string[],
        cancellable: Gio.Cancellable,
    ): Promise<ResultMeta[]> {
        console.debug(`getResultMetas([${results}])`);

        const { scaleFactor } = St.ThemeContext.get_for_stage(
            global.get_stage(),
        );

        return new Promise((resolve, reject) => {
            const cancelledId = cancellable.connect(() =>
                reject(Error("Operation Cancelled")),
            );

            const resultMetas = [];

            for (const identifier of results) {
                const meta = {
                    id: identifier,
                    name: "Result Name",
                    description: "The result description",
                    clipboardText: "Content for the clipboard",
                    createIcon: (size: number) => {
                        return new St.Icon({
                            icon_name: "dialog-information",
                            width: size * scaleFactor,
                            height: size * scaleFactor,
                        });
                    },
                };

                resultMetas.push(meta);
            }

            cancellable.disconnect(cancelledId);
            if (!cancellable.is_cancelled()) resolve(resultMetas);
        });
    }
}
