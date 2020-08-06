<p align="center">
  <a href="https://zalo.github.io/CascadeStudio/"><img src="https://zalo.github.io/CascadeStudio/icon/CascadeStudioBanner-1257x519.png" href></a>

  ![Github Pages Deployment](https://img.shields.io/github/deployments/zalo/CascadeStudio/github-pages?label=Github%20Pages%20Deployment)
  ![Vercel Deployment](https://img.shields.io/github/deployments/zalo/CascadeStudio/Production?label=Vercel%20Deployment)
  ![Last Commit Date](https://img.shields.io/github/last-commit/zalo/CascadeStudio)
  ![License: GPL v3](https://img.shields.io/badge/license-GPL%20v3-brightgreen)
</p>

## A Full Live-Scripted CAD Kernel and IDE in the Browser.

Use code to create 3D Models with features ranging from simple primitives + CSG to complex revolves, sweeps, and fillets.  Cascade Studio exposes the full power of the [OpenCascade](http://opencascade.com/) kernel, while providing a concise standard library for simple operations.

Save your completed models to .step, .stl. or .obj, or copy the url and share it with the community.

### [Examples](https://github.com/zalo/CascadeStudio/issues/5)

## Screenshot

<p align="center">
  <a href="https://zalo.github.io/CascadeStudio/"><img src="https://zalo.github.io/CascadeStudio/icon/CascadeStudioScreenshot.png" href></a>
</p>

## [Community](https://github.com/zalo/CascadeStudio/issues)

Model code is saved to the URL upon every successful evaluation, so you can copy and paste that link to others to view your model.  Use the "Issues" tab to share your creations and examples, as well as to report bugs and comments.

## Contributing

Cascade Studio is entirely static assets and vanilla javascript, so running it locally is as simple as running a server from the root directory (such as the [VS Code Live Server](https://github.com/ritwickdey/vscode-live-server), [Python live-server](https://pypi.org/project/live-server/), or [Node live-server](https://www.npmjs.com/package/live-server) ).

Pull Requests to this repo are automatically hosted to Vercel instances, so other users will be able to test and benefit from your modifications as soon as the PR is submitted.

## Credits

Cascade Studio uses:

 - [opencascade.js](https://github.com/donalffons/opencascade.js) (CAD Kernel)
 - [Golden Layout](https://github.com/golden-layout/golden-layout) (Windowing System)
 - [three.js](https://github.com/mrdoob/three.js/) (3D Rendering Engine)
 - [controlkit.js](https://github.com/automat/controlkit.js) (Buttons/Sliders),
 - [Monaco Editor](https://github.com/microsoft/monaco-editor) (Text Editing and Intellisense)
 - [opentype.js](https://github.com/opentypejs/opentype.js) (Font Parsing)
