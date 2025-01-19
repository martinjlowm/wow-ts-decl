{
  pkgs,
  yarn,
  ...
}: let
  inherit (builtins.fromJSON (builtins.readFile ../package.json)) version;
  nodejs = import ./packages/nodejs.nix;
  yarn = import ./packages/yarn.nix;
  jq = "${pkgs.jq}/bin/jq";
in
  stdenvNoCC.mkDerivation {
    name = "wow-ts-decl-wow-ui-source-${version}";

    src = lib.fileset.toSource {
      root = ../.;
      fileset = lib.fileset.unions [
        ../src
        ../scripts
        ../package.json
        ../.npmrc
        ../tsconfig.json
        ../yarn.lock
        ../.yarnrc.yml
        ../.yarn/releases
        ../.yarn/sdks
        ../README.md
      ];
    };

    buildInputs = [pkgs.cacert nodejs.pkg];

    dontStrip = true;

    configurePhase = ''
      export HOME="$TMP";
      export yarn_global_folder="$TMP";
      mkdir -p .yarn/cache
    '';

    buildPhase = ''
      ${yarn.bin} install --immutable
      ./scripts/scrape-warcraft-wiki.ts --out-dir=$out
    '';

    installPhase = ''
      mkdir -p $out

      ${jq} '.imports."#@/*" |= ["./dist/*", "./dist/*.js"]' package.json | ${jq} 'del(.workspaces)' > $out/package.json
      mv dist $out/
      mv README.md $out/
      mv .npmrc $out/
    '';

    meta = with lib; {
      homepage = "https://github.com/martinjlowm/wow-ts-decl";
      description = "Grafana CDK constructs for defining dashboards as typesafe Infrastructure as Code, IaC.";
      platforms = platforms.linux ++ platforms.darwin;
    };
  }
