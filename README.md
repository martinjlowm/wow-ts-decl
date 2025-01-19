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
npm i --save-dev @martinjlowm/wow-ts-decl
```

and add the desired declarations for your project, depending on what you develop for:

```jsonc
{
  // ...
  "compilerOptions": {
    "types": [
      // 1.12.x
      // NOTE: Not emitted at this time!
      //   Earlier versions can be implemented from https://warcraft.wiki.gg/wiki/World_of_Warcraft_API?oldid=559358
      "@martinjlowm/wow-ts-decl/1.12.x",
      // 1.15.x
      "@martinjlowm/wow-ts-decl/1.15.x"
    ]
  }
}
```

## Usage

```typescript
const frame = CreateFrame('Frame');
frame.GetParent();
```

## Contributing

All tools you'll need are set up with Nix, if you don't yet have it - you can
install it with the following command.

```bash
# Install Nix using the Determinate Systems installer
curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install

# Install devenv
nix-env --install --attr devenv -f https://github.com/NixOS/nixpkgs/tarball/nixpkgs-unstable

# Enter a development shell with all the tooling available
devenv shell
```

Alternatively, you can install direnv to automate the shell initialization
whenever you enter the project.

```bash
# Install direnv and nix-direnv
nix profile install -f '<nixpkgs>' direnv nix-direnv

# Enable nix-direnv's caching capabilities for direnv
mkdir -p ~/.config/direnv
echo "source $HOME/.nix-profile/share/nix-direnv/direnvrc" > ~/.config/direnv/direnvrc

# Hook direnv into your shell
SHELL_BIN=$(basename $SHELL)
echo "eval \"\$(direnv hook $SHELL_BIN)\"" >> ~/.${SHELL_BIN}rc
eval "$(direnv hook $SHELL_BIN)"
unset SHELL_BIN
```

Scripts for scraping documentation information for both source reside in
`scripts/`.

To generate the intermediate structures run the scripts as such,

```bash
./scripts/scrape-wow-ui-source.ts <git-ref>
# and
./scripts/scrape-warcraft-wiki.ts
```

For example,

```bash
./scripts/scrape-wow-ui-source.ts classic_era
./scripts/scrape-wow-ui-source.ts 1.15.4
./scripts/scrape-wow-ui-source.ts live
```
