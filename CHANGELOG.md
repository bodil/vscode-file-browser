# Change Log

All notable changes to the "file-browser" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this
file.

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
