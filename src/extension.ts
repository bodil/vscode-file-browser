import * as vscode from "vscode";
import { Uri, QuickPickItem, FileType, QuickInputButton, ThemeIcon, ViewColumn } from "vscode";
import * as Path from "path";
import * as OS from "os";

import { Result, None, Option, Some } from "./rust";

let active: Option<FileBrowser> = None;

enum Action {
    NewFile,
    NewFolder,
    OpenFile,
    OpenFileBeside,
    RenameFile,
    DeleteFile,
    OpenFolder,
}

function action(label: string, action: Action) {
    return {
        label,
        name: "",
        action,
        alwaysShow: true,
    };
}

function setContext(state: boolean) {
    vscode.commands.executeCommand("setContext", "inFileBrowser", state);
}

function splitPath(filePath: string): string[] {
    let resolvedPath = Path.resolve(filePath);
    return [Path.parse(resolvedPath).root,
            ...resolvedPath.split(Path.sep).slice(1).filter((it:string) => it)];
}

function joinPath(pathElems: string[]): string {
    return Path.join(...pathElems);
}

function fileRecordCompare(left: [string, FileType], right: [string, FileType]): -1 | 0 | 1 {
    const [leftName, leftDir] = [
        left[0].toLowerCase(),
        (left[1] & FileType.Directory) === FileType.Directory,
    ];
    const [rightName, rightDir] = [
        right[0].toLowerCase(),
        (right[1] & FileType.Directory) === FileType.Directory,
    ];
    if (leftDir && !rightDir) {
        return -1;
    }
    if (rightDir && !leftDir) {
        return 1;
    }
    return leftName > rightName ? 1 : leftName === rightName ? 0 : -1;
}
interface AutoCompletion {
    index: number;
    items: FileItem[];
}

class FileItem implements QuickPickItem {
    name: string;
    label: string;
    alwaysShow: boolean;
    detail?: string;
    description?: string;
    fileType?: FileType;
    action?: Action;

    constructor(record: [string, FileType]) {
        const [name, fileType] = record;
        this.name = name;
        this.fileType = fileType;
        this.alwaysShow = !name.startsWith(".");
        switch (this.fileType) {
            case FileType.Directory:
                this.label = `$(folder) ${name}`;
                break;
            case FileType.Directory | FileType.SymbolicLink:
                this.label = `$(file-symlink-directory) ${name}`;
                break;
            case FileType.File | FileType.SymbolicLink:
                this.label = `$(file-symlink-file) ${name}`;
            default:
                this.label = `$(file) ${name}`;
                break;
        }
    }
}

class FileBrowser {
    current: vscode.QuickPick<FileItem>;
    path: string[];
    file: string | undefined;
    items: FileItem[] = [];
    pathHistory: { [path: string]: string | undefined };
    inActions: boolean = false;
    keepAlive: boolean = false;
    autoCompletion?: AutoCompletion;

    actionsButton: QuickInputButton = {
        iconPath: new ThemeIcon("ellipsis"),
        tooltip: "Actions on selected file",
    };
    stepOutButton: QuickInputButton = {
        iconPath: new ThemeIcon("arrow-left"),
        tooltip: "Step out of folder",
    };
    stepInButton: QuickInputButton = {
        iconPath: new ThemeIcon("arrow-right"),
        tooltip: "Step into folder",
    };

    constructor(filePath: string) {
        this.path = splitPath(filePath);
        this.file = this.path.pop();
        this.pathHistory = { [joinPath(this.path)]: this.file };
        this.current = vscode.window.createQuickPick();
        this.current.buttons = [this.actionsButton, this.stepOutButton, this.stepInButton];
        this.current.placeholder = "Type a file name here to search or open a new file";
        this.current.onDidHide(() => {
            if (!this.keepAlive) {
                this.dispose();
            }
        });
        this.current.onDidAccept(this.onDidAccept.bind(this));
        this.current.onDidChangeValue(this.onDidChangeValue.bind(this));
        this.current.onDidTriggerButton(this.onDidTriggerButton.bind(this));
        this.update().then(() => this.current.show());
    }

    dispose() {
        setContext(false);
        this.current.dispose();
        active = None;
    }

    async update() {
        this.current.enabled = false;
        this.current.title = joinPath(this.path);
        this.current.value = "";

        const stat = (
            await Result.try(vscode.workspace.fs.stat(Uri.file(this.current.title)))
        ).unwrap();
        if (stat && this.inActions && (stat.type & FileType.File) === FileType.File) {
            this.items = [
                action("$(file) Open this file", Action.OpenFile),
                action("$(split-horizontal) Open this file to the side", Action.OpenFileBeside),
                action("$(edit) Rename this file", Action.RenameFile),
                action("$(trash) Delete this file", Action.DeleteFile),
            ];
            this.current.items = this.items;
        } else if (
            stat &&
            this.inActions &&
            (stat.type & FileType.Directory) === FileType.Directory
        ) {
            this.items = [
                action("$(folder-opened) Open this folder", Action.OpenFolder),
                action("$(edit) Rename this folder", Action.RenameFile),
                action("$(trash) Delete this folder", Action.DeleteFile),
            ];
            this.current.items = this.items;
        } else if (stat && (stat.type & FileType.Directory) === FileType.Directory) {
            let items: FileItem[];
            const records = await vscode.workspace.fs.readDirectory(Uri.file(joinPath(this.path)));
            records.sort(fileRecordCompare);
            items = records.map((entry) => new FileItem(entry));
            this.items = items;
            this.current.items = items;
            this.current.activeItems = items.filter((item) => item.name === this.file);
        } else {
            this.items = [action("$(new-folder) Create this folder", Action.NewFolder)];
            this.current.items = this.items;
        }
        this.current.enabled = true;
    }

    onDidChangeValue(value: string, isAutoComplete = false) {
        if (this.inActions) {
            return;
        }

        if (!isAutoComplete) {
            this.autoCompletion = undefined;
        }

        const existingItem = this.items.find((item) => item.name === value);
        if (value === "") {
            this.current.items = this.items;
            this.current.activeItems = [];
        } else if (existingItem !== undefined) {
            this.current.items = this.items;
            this.current.activeItems = [existingItem];
        } else if (value.endsWith("/")) {
            const path = value.slice(0, -1);
            if (path === "~") {
                this.path = splitPath(OS.homedir());
            } else if (path === "..") {
                this.path.pop();
            } else if (path.length > 0 && path !== ".") {
                this.path.push(path);
            }
            this.file = undefined;
            this.update();
        } else {
            const newItem = {
                label: `$(new-file) ${value}`,
                name: value,
                description: "Open as new file",
                alwaysShow: true,
                action: Action.NewFile,
            };
            this.current.items = [newItem, ...this.items];
            this.current.activeItems = [newItem];
        }
    }

    onDidTriggerButton(button: QuickInputButton) {
        if (button === this.stepInButton) {
            this.stepIn();
        } else if (button === this.stepOutButton) {
            this.stepOut();
        } else if (button === this.actionsButton) {
            this.actions();
        }
    }

    activeItem(): Option<FileItem> {
        return new Option(this.current.activeItems[0]);
    }

    async stepIn() {
        this.activeItem().ifSome(async (item) => {
            if (item.action !== undefined) {
                this.runAction(item);
            } else if (item.fileType !== undefined) {
                if ((item.fileType & FileType.Directory) === FileType.Directory) {
                    this.path.push(item.name);
                    this.file = this.pathHistory[joinPath(this.path)];
                    await this.update();
                } else if ((item.fileType & FileType.File) === FileType.File) {
                    this.path.push(item.name);
                    this.file = undefined;
                    this.inActions = true;
                    await this.update();
                }
            }
        });
    }

    async stepOut() {
        this.inActions = false;
        if (this.path.length > 1) {
            this.pathHistory[joinPath(this.path)] = this.activeItem()
                .map((item) => item.name)
                .unwrap();
            this.file = this.path.pop();
            await this.update();
        }
    }

    async actions() {
        if (this.inActions) {
            return;
        }
        await this.activeItem().match(
            async (item) => {
                this.inActions = true;
                this.path.push(item.name);
                this.file = undefined;
                await this.update();
            },
            async () => {
                this.inActions = true;
                this.file = undefined;
                await this.update();
            }
        );
    }

    tabCompletion(tabNext: boolean) {
        if (this.inActions) {
            return;
        }

        if (this.autoCompletion) {
            const length = this.autoCompletion.items.length;
            const step = tabNext ? 1 : -1;
            this.autoCompletion.index = (this.autoCompletion.index + length + step) % length;
        } else {
            const items = this.items.filter((i) =>
                i.name.toLowerCase().startsWith(this.current.value.toLowerCase())
            );
            this.autoCompletion = {
                index: tabNext ? 0 : items.length - 1,
                items,
            };
        }

        const newIndex = this.autoCompletion.index;
        const length = this.autoCompletion.items.length;
        if (newIndex < length) {
            // This also checks out when items is empty
            const item = this.autoCompletion.items[newIndex];
            this.current.value = item.name;
            if (length === 1 && item.fileType === FileType.Directory) {
                this.current.value += Path.sep;
            }

            this.onDidChangeValue(this.current.value, true);
        }
    }

    onDidAccept() {
        this.autoCompletion = undefined;
        this.activeItem().ifSome((item) => {
            if (item.action !== undefined) {
                this.runAction(item);
            } else if (
                item.fileType !== undefined &&
                (item.fileType & FileType.Directory) === FileType.Directory
            ) {
                this.stepIn();
            } else {
                const fileName = joinPath([...this.path, item.name]);
                const uri = Uri.file(fileName);
                this.openFile(uri);
            }
        });
    }

    openFile(uri: Uri, column: ViewColumn = ViewColumn.Active) {
        this.dispose();
        vscode.workspace
            .openTextDocument(uri)
            .then((doc) => vscode.window.showTextDocument(doc, column));
    }

    async runAction(item: FileItem) {
        switch (item.action) {
            case Action.NewFolder: {
                await vscode.workspace.fs.createDirectory(Uri.file(joinPath(this.path)));
                await this.update();
                break;
            }
            case Action.NewFile: {
                const uri = Uri.file(joinPath([...this.path, item.name]));
                this.openFile(uri.with({ scheme: "untitled" }));
                break;
            }
            case Action.OpenFile: {
                const path = this.path.slice();
                if (item.name && item.name.length > 1) {
                    path.push(item.name);
                }
                const uri = Uri.file(joinPath(this.path));
                this.openFile(uri);
                break;
            }
            case Action.OpenFileBeside: {
                const path = this.path.slice();
                if (item.name && item.name.length > 1) {
                    path.push(item.name);
                }
                const uri = Uri.file(joinPath(this.path));
                this.openFile(uri, ViewColumn.Beside);
                break;
            }
            case Action.RenameFile: {
                this.keepAlive = true;
                this.current.hide();
                const uri = Uri.file(joinPath(this.path));
                const stat = await vscode.workspace.fs.stat(uri);
                const isDir = (stat.type & FileType.Directory) === FileType.Directory;
                const fileName = this.path.pop() || "";
                const fileType = isDir ? "folder" : "file";
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)?.uri;
                const relPath = workspaceFolder
                    ? Path.relative(workspaceFolder.path, uri.path)
                    : uri.path;
                const extension = Path.extname(relPath);
                const startSelection = relPath.length - fileName.length;
                const endSelection = startSelection + (fileName.length - extension.length);
                const result = await vscode.window.showInputBox({
                    prompt: `Enter the new ${fileType} name`,
                    value: relPath,
                    valueSelection: [startSelection, endSelection],
                });
                this.file = fileName;
                if (result !== undefined) {
                    const newUri = workspaceFolder
                        ? Uri.joinPath(workspaceFolder, result)
                        : Uri.file(result);
                    if ((await Result.try(vscode.workspace.fs.rename(uri, newUri))).isOk()) {
                        this.file = Path.basename(result);
                    } else {
                        vscode.window.showErrorMessage(
                            `Failed to rename ${fileType} "${fileName}"`
                        );
                    }
                }
                this.current.show();
                this.keepAlive = false;
                this.inActions = false;
                this.update();
                break;
            }
            case Action.DeleteFile: {
                this.keepAlive = true;
                this.current.hide();
                const uri = Uri.file(joinPath(this.path));
                const stat = await vscode.workspace.fs.stat(uri);
                const isDir = (stat.type & FileType.Directory) === FileType.Directory;
                const fileName = this.path.pop() || "";
                const fileType = isDir ? "folder" : "file";
                const goAhead = `$(trash) Delete the ${fileType} "${fileName}"`;
                const result = await vscode.window.showQuickPick(["$(close) Cancel", goAhead], {});
                if (result === goAhead) {
                    const delOp = await Result.try(
                        vscode.workspace.fs.delete(uri, { recursive: isDir })
                    );
                    if (delOp.isErr()) {
                        vscode.window.showErrorMessage(
                            `Failed to delete ${fileType} "${fileName}"`
                        );
                    }
                }
                this.current.show();
                this.keepAlive = false;
                this.inActions = false;
                this.update();
                break;
            }
            case Action.OpenFolder: {
                const uri = Uri.file(joinPath(this.path));
                vscode.commands.executeCommand("vscode.openFolder", uri);
                break;
            }
            default:
                throw new Error(`Unhandled action ${item.action}`);
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    setContext(false);

    context.subscriptions.push(
        vscode.commands.registerCommand("file-browser.open", () => {
            const document = vscode.window.activeTextEditor?.document;
            let path = (vscode.workspace.rootPath || OS.homedir()) + Path.sep;
            if (document && !document.isUntitled) {
                path = document.fileName;
            }
            active = Some(new FileBrowser(path));
            setContext(true);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("file-browser.stepIn", () =>
            active.ifSome((active) => active.stepIn())
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("file-browser.stepOut", () =>
            active.ifSome((active) => active.stepOut())
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("file-browser.actions", () =>
            active.ifSome((active) => active.actions())
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("file-browser.tabNext", () =>
            active.ifSome((active) => active.tabCompletion(true))
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("file-browser.tabPrev", () =>
            active.ifSome((active) => active.tabCompletion(false))
        )
    );
}

export function deactivate() {}
