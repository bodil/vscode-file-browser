import * as vscode from "vscode";
import { Uri, QuickPickItem, FileType, QuickInputButton } from "vscode";
import * as userHome from "user-home";
import * as Path from "path";

let active: FileBrowser | undefined = undefined;

enum Action {
    NewFile,
    NewFolder,
}

async function setContext(state: boolean) {
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
    items: FileItem[];
    pathHistory: { [path: string]: string | undefined };
    stepInButton: QuickInputButton;
    stepOutButton: QuickInputButton;

    constructor(filePath: string) {
        console.log("Opening file browser:", filePath);
        let path = splitPath(filePath);
        let file = path.pop();
        if (file) {
            this.file = file;
            this.path = path;
        } else {
            this.path = splitPath(vscode.workspace.rootPath || "");
            this.file = undefined;
        }
        this.items = [];
        this.pathHistory = { [joinPath(this.path)]: this.file };
        this.stepOutButton = {
            iconPath: new vscode.ThemeIcon("arrow-left"),
            tooltip: "Step out of folder",
        };
        this.stepInButton = {
            iconPath: new vscode.ThemeIcon("arrow-right"),
            tooltip: "Step into folder",
        };
        this.current = vscode.window.createQuickPick();
        this.current.buttons = [this.stepOutButton, this.stepInButton];
        this.current.placeholder = "Type a file name here to search or open a new file";
        this.current.onDidHide(this.dispose.bind(this));
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
        let items: FileItem[];
        try {
            const records = await vscode.workspace.fs.readDirectory(Uri.file(joinPath(this.path)));
            records.sort(fileRecordCompare);
            items = records.map((entry) => new FileItem(entry));
        } catch (err) {
            items = [
                {
                    label: "$(new-folder) Create this folder",
                    name: "",
                    action: Action.NewFolder,
                    alwaysShow: true,
                },
            ];
        }
        this.items = items;
        this.current.items = items;
        this.current.activeItems = items.filter((item) => item.name === this.file);
        this.current.enabled = true;
    }

    onDidChangeValue(value: string) {
        const existingItem = this.items.find((item) => item.name === value);
        if (existingItem !== undefined) {
            this.current.items = this.items;
            this.current.activeItems = [existingItem];
        } else if (value.endsWith("/")) {
            const path = value.slice(0, -1);
            if (path === "~") {
                this.path = splitPath(userHome);
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
        }
    }

    activeItem(): FileItem | undefined {
        return this.current.activeItems[0];
    }

    async stepIn() {
        let item = this.activeItem();
        if (
            item &&
            item.fileType !== undefined &&
            (item.fileType & FileType.Directory) === FileType.Directory
        ) {
            this.path.push(item.name);
            this.file = this.pathHistory[joinPath(this.path)];
            await this.update();
        }
    }

    async stepOut() {
        if (this.path.length > 1) {
            this.pathHistory[joinPath(this.path)] = this.activeItem()?.name;
            this.file = this.path.pop();
            await this.update();
        }
    }

    onDidAccept() {
        const item = this.activeItem();
        if (item !== undefined) {
            // TODO maybe add an option for opening a folder as an editor instead of stepping in?
            if (
                item.fileType !== undefined &&
                (item.fileType & FileType.Directory) === FileType.Directory
            ) {
                this.stepIn();
            } else if (item.action === Action.NewFolder) {
                vscode.workspace.fs.createDirectory(Uri.file(joinPath(this.path)));
                this.update();
            } else {
                const fileName = joinPath([...this.path, item.name]);
                let uri = Uri.file(fileName);
                if (item.action === Action.NewFile) {
                    uri = Uri.file(fileName).with({ scheme: "untitled" });
                }
                this.dispose();
                vscode.workspace
                    .openTextDocument(uri)
                    .then((doc) => vscode.window.showTextDocument(doc));
            }
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    setContext(false);

    const open = vscode.commands.registerCommand("file-browser.open", async () => {
        const pick = new FileBrowser(vscode.window.activeTextEditor?.document.fileName || "");
        await setContext(true);
        active = pick;
    });
    context.subscriptions.push(open);

    const stepInCmd = vscode.commands.registerCommand("file-browser.stepIn", () => {
        if (active !== undefined) {
            active.stepIn();
        }
    });
    context.subscriptions.push(stepInCmd);
    const stepOutCmd = vscode.commands.registerCommand("file-browser.stepOut", () => {
        if (active !== undefined) {
            active.stepOut();
        }
    });
    context.subscriptions.push(stepOutCmd);

    console.log("******* FILEBROWSER: ", vscode.workspace.fs.stat(Uri.file("~")));
}

export function deactivate() {}
