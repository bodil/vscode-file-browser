# Change Log

All notable changes to the "file-browser" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this
file.

## [0.1.1] - 2020-06-22

### FIXED

-   Removed the `isActive` setting in favour of `setContext`. Keybindings for the file browser
    should now use `"when": "inFileBrowser"`.
-   Open at a sensible path (either the workspace root or the user's home directory, in order of
    preference) if launched from an untitled document.

## [0.1.0] - 2020-06-21

-   Initial release
