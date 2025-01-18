# TypeScript types for the World of Warcraft LUA API

Typesafe API declarations for developers that seek a laid-back AddOn developer
experience.

This project is a revisit of
[wow-classic-declarations](https://github.com/wartoshika/wow-classic-declarations)
by [@wartoshika](https://github.com/wartoshika).

Unlike the predecessor, this project is automatically generated from the
following sources and merged together:

- [wow-ui-source](https://github.com/Gethe/wow-ui-source)
- [warcraft.wiki.gg](https://warcraft.wiki.gg/wiki/World_of_Warcraft_API)

The generated declarations primarily relies on
[TypeScriptToLua](https://github.com/TypeScriptToLua/TypeScriptToLua) to
introduce intermediate types that enable a somewhat seamless experience by
transpiling TypeScript to Lua.

## Installation

Install the package as a dependency,

```bash
$embed: ./snippets/steps/installation-package.sh$
```

and add the desired declarations for your project, depending on what you develop for:

```jsonc
$embed: ./snippets/steps/installation-tsconfig.json$
```

## Usage

```typescript
$embed: ./snippets/steps/usage.ts$
```

## Contributing

All tools you'll need are set up with Nix, if you don't yet have it - you can
install it with the following command.

```bash
$embed: ./snippets/steps/contributing-install-nix.sh$
```

Alternatively, you can install direnv to automate the shell initialization
whenever you enter the project.

```bash
$embed: ./snippets/steps/contributing-install-direnv.sh$
```

Scripts for scraping documentation information for both source reside in
`scripts/`.
