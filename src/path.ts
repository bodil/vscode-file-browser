import * as vscode from "vscode";
import {
  Uri,
  WorkspaceFolder,
  FileStat,
  FileType,
  FileSystemError,
} from "vscode";
import * as OSPath from "path";
import { Option, None, Some, Result, Err, Ok } from "./rust";

export class Path {
  private pathUri: Uri;

  constructor(uri: Uri) {
    this.pathUri = uri;
  }

  static fromFilePath(filePath: string): Path {
    return new Path(Uri.file(filePath));
  }

  get uri(): Uri {
    return this.pathUri;
  }

  /**
   * Get a unique identifier string for the [[Path]]. Do not display this to the user.
   */
  get id(): string {
    return this.pathUri.toString(false);
  }

  get fsPath(): string {
    return this.pathUri.fsPath;
  }

  /**
   * Get the path component of the [[Path]] as a string.
   */
  // get pathString(): string {
  //     return this.pathUri.path;
  // }

  /**
   * Make a copy of this path.
   */
  clone(): Path {
    return new Path(this.pathUri);
  }

  equals(other: Path) {
    return this.id === other.id;
  }

  /**
   * Test if the path is at its root.
   */
  atTop(): boolean {
    return this.pathUri === Uri.joinPath(this.pathUri, "..");
  }

  /**
   * Get the root of the file system the [[Path]] resides in.
   */
  root(): Uri {
    return this.pathUri.with({ path: "/" });
  }

  /**
   * Return a new path with the provided segments appended.
   */
  append(...pathSegments: string[]): Path {
    return new Path(Uri.joinPath(this.pathUri, ...pathSegments));
  }

  /**
   * Return the parent of a path.
   *
   * This always succeeds; if the path has no parent, it returns itself.
   * Use [[`Path.atTop`]] to check whether a path has a parent.
   */
  parent(): Path {
    return this.append("..");
  }

  /**
   * Push `pathSegments` onto the end of the path.
   */
  push(...pathSegments: string[]) {
    this.pathUri = Uri.joinPath(this.pathUri, ...pathSegments);
  }

  /**
   * Pop the last path segment off the path.
   *
   * @returns [[None]] if the path has no more segments to pop.
   */
  pop(): Option<string> {
    if (this.atTop()) {
      return None;
    }
    const current = new Path(this.pathUri);
    this.pathUri = Uri.joinPath(this.pathUri, "..");
    return current.relativeTo(this.pathUri);
  }

  getWorkspaceFolder(): Option<WorkspaceFolder> {
    return new Option(vscode.workspace.getWorkspaceFolder(this.pathUri));
  }

  relativeTo(other: Uri): Option<string> {
    if (
      this.pathUri.authority !== other.authority ||
      this.pathUri.scheme !== other.scheme
    ) {
      return None;
    }
    const relPath = OSPath.relative(other.fsPath, this.pathUri.fsPath);
    return Some(relPath);
  }

  async stat(): Promise<Result<FileStat, Error>> {
    return Result.try(vscode.workspace.fs.stat(this.pathUri));
  }

  async isDir(): Promise<boolean> {
    const stat = await this.stat();
    return stat.match(
      (stat) => !!(stat.type | FileType.Directory),
      () => false
    );
  }

  async isFile(): Promise<boolean> {
    const stat = await this.stat();
    return stat.match(
      (stat) => !!(stat.type | FileType.File),
      () => false
    );
  }
}

/**
 * If a string ends with a path separator, return the string with the path separator removed.
 * Otherwise, return [[None]].
 */
export function endsWithPathSeparator(value: string): Option<string> {
  if (value.endsWith("/")) {
    return Some(value.slice(0, value.length - 1));
  }
  if (value.endsWith(OSPath.sep)) {
    return Some(value.slice(0, value.length - OSPath.sep.length));
  }
  return None;
}

/**
 * Given a list of file names, try to find one of them in the provided path,
 * then step up one folder at a time and repeat the search until we find something
 * or run out of parents.
 *
 * If no file is found, we return [[FileSystemError.FileNotFound]].
 *
 * If `uri` points to a file, we immediately return [[FileSystemError.FileNotADirectory]].
 *
 * Returns either the [[Uri]] of the first file found, or [[None]].
 */
export async function lookUpwards(
  uri: Uri,
  files: string[]
): Promise<Result<Uri, FileSystemError>> {
  const path = new Path(uri);
  if (!(await path.isDir())) {
    return Err(FileSystemError.FileNotADirectory(uri));
  }
  while (true) {
    for (const file of files) {
      let filePath = path.append(file);
      if (await filePath.isFile()) {
        return Ok(filePath.uri);
      }
    }
    if (path.pop().isNone()) {
      return Err(FileSystemError.FileNotFound());
    }
  }
}
