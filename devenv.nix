{
  pkgs,
  lib,
  config,
  inputs,
  ...
}: let
  nodejs = pkgs.nodejs_23;
  yarn = pkgs.yarn-berry.override {inherit nodejs;};
  yarnCLI = "${yarn}/bin/yarn";
in {
  packages = with pkgs; [nodejs yarn];

  scripts = {
    publish.exec = ''
      nix build .#dist --impure -L
      (cd result; npm publish --access public)
    '';
    snippets = {
      exec = builtins.readFile ./docs/snippets/substitute.ts;
      package = nodejs;
      binary = "node --experimental-transform-types";
    };
    typescript-language-server.exec = ''
      ${yarnCLI} node ${pkgs.typescript-language-server}/lib/node_modules/typescript-language-server/lib/cli.mjs "$@"
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
    dist = import ./nix/dist.nix {inherit pkgs yarn nodejs;};
  };
}
