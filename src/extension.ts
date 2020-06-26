import * as vscode from "vscode";
import { Uri, QuickPickItem, FileType, QuickInputButton, ThemeIcon, ViewColumn } from "vscode";
import * as Path from "path";
import * as OS from "os";

let active: FileBrowser | undefined = undefined;

enum Action {
    NewFile,
    NewFolder,
    OpenFile,
    OpenFileBeside,
    RenameFile,
    DeleteFile,
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

function splitPath(path: string): string[] {
    return path.split(Path.sep);
}

function joinPath(path: string[]): string {
    return path.join(Path.sep);
}

function fileRecordCompare(left: [string, FileType], right: [string, FileType]) {
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
        active = undefined;
    }

    async update() {
        this.current.enabled = false;
        this.current.title = joinPath(this.path);
        this.current.value = "";
        let stat;
        try {
            stat = await vscode.workspace.fs.stat(Uri.file(this.current.title));
        } catch (err) {
            stat = undefined;
        }
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

    onDidChangeValue(value: string) {
        if (this.inActions) {
            return;
        }
        const existingItem = this.items.find((item) => item.name === value);
        if (existingItem !== undefined) {
            this.current.items = this.items;
            this.current.activeItems = [existingItem];
        } else if (value.endsWith("/")) {
            const path = value.slice(0, -1);
            if (path === "~") {
                this.path = splitPath(OS.homedir());
            } else {
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

    activeItem(): FileItem | undefined {
        return this.current.activeItems[0];
    }

    async stepIn() {
        let item = this.activeItem();
        if (item?.action !== undefined) {
            this.runAction(item);
        } else if (item?.fileType !== undefined) {
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
    }

    async stepOut() {
        this.inActions = false;
        if (this.path.length > 1) {
            this.pathHistory[joinPath(this.path)] = this.activeItem()?.name;
            this.file = this.path.pop();
            await this.update();
        }
    }

    async actions() {
        if (this.inActions) {
            return;
        }
        let item = this.activeItem();
        if (item === undefined) {
            return;
        }
        this.inActions = true;
        this.path.push(item.name);
        this.file = undefined;
        await this.update();
    }

    onDidAccept() {
        const item = this.activeItem();
        if (item !== undefined) {
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
        }
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
                    try {
                        await vscode.workspace.fs.rename(uri, newUri);
                        this.file = Path.basename(result);
                    } catch (err) {
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
                    try {
                        await vscode.workspace.fs.delete(uri, { recursive: isDir });
                    } catch (err) {
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
            active = new FileBrowser(path);
            setContext(true);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("file-browser.stepIn", () => {
            if (active !== undefined) {
                active.stepIn();
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("file-browser.stepOut", () => {
            if (active !== undefined) {
                active.stepOut();
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("file-browser.actions", () => {
            if (active !== undefined) {
                active.actions();
            }
        })
    );
}

export function deactivate() {}
