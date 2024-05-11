import * as vscode from "vscode";
import { QuickPickItem, FileType } from "vscode";
import { Action } from "./action";
import { config, ConfigItem } from "./extension";

export class FileItem implements QuickPickItem {
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
    this.alwaysShow = config(ConfigItem.HideDotfiles)
      ? !name.startsWith(".")
      : true;
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

export function itemIsDir(item: FileItem): boolean {
  if (item.fileType === undefined) {
    return false;
  }
  return !!(item.fileType | FileType.Directory);
}

export function fileRecordCompare(
  left: [string, FileType],
  right: [string, FileType]
): -1 | 0 | 1 {
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
