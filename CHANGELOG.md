
# Change Log

All notable changes to the "file-browser" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this
file.


## [0.2.11]

### CHANGED

-   While loading the file list, show a 'busy' animation untill the files are ready to be shown.
    
## [0.2.10]

### CHANGED

-   The `file-browser.hideIgnoredFiles` setting is now off by default, as it can have a noticeable
    performance impact on certain filesystems. (#14)

## [0.2.9]

### ADDED

-   You can now toggle the labelling of `.gitignore`d files on or off in the settings.

## [0.2.8]

### ADDED

-   You now have the option to hide files matched by `.gitignore` and similar in addition to
    dotfiles when matching, or to remove these from the directory listing entirely.
-   The extension can now run as a local extension when using a remote, so that it will still be
    available if you have it installed locally but not on the remote. It will prefer the remote
    installation if one is available, because the local version will render paths the way the local
    OS thinks they should look, rather than how the remote OS would render them.

### FIXED

-   Paths are now stored as `vscode.Uri` internally, and using `Uri` for path manipulation as much
    as possible, which should lead to more robust cross platform path handling in general, and when
    dealing with local files open on a remote in particular.
-   You can now use the left and right arrow keys normally in the input box when renaming a file,
    where it would previously lead to unexpectedly reopening the file browser.

## [0.2.7]

### ADDED

-   You can now optionally open a folder in a new window instead of replacing the current project
    folder. (#11)

## [0.2.6]

### FIXED

-   Some path parsing bugs fixed, most notably that Windows root paths will no longer confuse the
    extension. (#7, #8)

## [0.2.5]

### ADDED

-   You can now start typing a file name and hit `Tab` to autocomplete it. If there are multiple
    matches, you can cycle through them with `Tab` and `Shift+Tab`. (#3)
-   If you're in an empty folder, `Ctrl+A` now works to open the folder actions. (#3)

## [0.2.4]

### ADDED

-   There is now an option to open the folder as a workspace if you hit `Ctrl+A` on a folder.

## [0.2.3]

### ADDED

-   You can now type `../` to step up to the parent directory. (#1)

### FIXED

-   Typing a single `/` will now be quietly ignored instead of causing unexpected behaviour.

## [0.2.1]

### ADDED

-   You can now bring up rename/delete actions on a folder with the "Ctrl+A" key or by using the new
    action menu button.
-   When you rename or delete a file or folder, the file browser now stays open.

### FIXED

-   Stepping into a folder that doesn't currently exist now correctly displays the "Create folder"
    action.

## [0.2.0]

### ADDED

-   You can now step into a file to access file operations such as rename and delete.

## [0.1.1] - 2020-06-22

### FIXED

-   Removed the `isActive` setting in favour of `setContext`. Keybindings for the file browser
    should now use `"when": "inFileBrowser"`.
-   Open at a sensible path (either the workspace root or the user's home directory, in order of
    preference) if launched from an untitled document.

## [0.1.0] - 2020-06-21

-   Initial release
