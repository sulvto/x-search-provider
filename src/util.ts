import Gio from "gi://Gio";
import Glib from "gi://GLib";

export const file_exists = (filename: string): boolean => {
    return Glib.file_test(filename, Glib.FileTest.EXISTS);
};

export const file_ls = (
    path: string,
    filter?: (value: Gio.FileInfo) => unknown | null,
): Array<Gio.FileInfo> => {
    const directory = Gio.File.new_for_path(path);
    const enumerator = directory.enumerate_children(
        "standard::*", // 我们请求关于文件的标准信息
        Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, // 不跟踪符号链接
        null, // 没有使用 GCancellable
    );

    let info;
    const children = [];
    while ((info = enumerator.next_file(null)) !== null) {
        if (filter ? filter(info) : true) {
            children.push(info);
        }
    }

    enumerator.close(null);
    return children;
};

export const read_file = (filename: string): string | undefined => {
    const [ok, data] = Glib.file_get_contents(filename);
    return ok ? new TextDecoder().decode(data) : undefined;
};
