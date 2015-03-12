# Sitrec Chrome Extension

Capture screenshots on a chrome tab during loading a site, and then save a HAR file after loaded.
The screenshots and the har file will be automatically uploaded to [sitrec-server](https://github.com/naoak/sitrec-server).

## Install

Install polymer components.
```
$ bower install
```

Concatenate a set of polymer components into one file.
```
$ vulcanize --inline --csp main-panel.html
```

Specify this extension directory from Chrome `Extensions`.
