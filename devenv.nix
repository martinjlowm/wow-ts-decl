{
  pkgs,
  lib,
  config,
  inputs,
  ...
}: let
  nodejs = pkgs.callPackage ./nix/packages/nodejs.nix {};
  yarn = pkgs.callPackage ./nix/packages/yarn.nix {};
  browsers = pkgs.playwright-driver.passthru.browsers.overrideAttrs (attrs: {
    # This is not really an attribute, but arch is not part of the derivation,
    # so the hash is shared between arm64 and x86_64 - let's generate a new hash
    # and download the browsers instead of relying on cache
    arch = "x86_64";
  });
in {
  packages = [nodejs.pkg yarn.pkg];

  # Make sure this is in sync with the version via Yarn
  env.PLAYWRIGHT_BROWSERS_PATH = browsers;
  env.NODE_OPTIONS = "--disable-warning=ExperimentalWarning";

  scripts = {
    publish.exec = ''
      nix build .#dist --impure -L
      (cd result; npm publish --access public)
    '';
    snippets = {
      exec = builtins.readFile ./docs/snippets/substitute.ts;
      package = nodejs.pkg;
      binary = "node --experimental-transform-types";
    };
    typescript-language-server.exec = ''
      ${yarn.bin} node ${pkgs.typescript-language-server}/lib/node_modules/typescript-language-server/lib/cli.mjs "$@"
    '';
  };

  git-hooks.hooks = {
    alejandra.enable = true;
    statix = {
      enable = true;
      pass_filenames = true;
      # https://github.com/oppiliappan/statix/issues/69
      entry = "bash -c 'echo \"$@\" | xargs -n1 ${pkgs.statix}/bin/statix check'";
    };
    biome = {
      package = pkgs.biome;
      enable = true;
      entry = "${pkgs.biome}/bin/biome check --apply --colors=off --no-errors-on-unmatched --diagnostic-level=error";
    };
    typos = {
      enable = true;
      entry = "${pkgs.typos}/bin/typos --force-exclude --exclude .git/*";
    };
    readme = {
      enable = true;
      name = "README.md";
      entry = ''bash -c "snippets docs/README.tpl.md > README.md"'';
      files = "(docs\/README.tpl.md|docs\/snippets\/.*)";
    };
  };

  outputs = {
    dist = pkgs.callPackage ./nix/dist.nix {};
  };
}
