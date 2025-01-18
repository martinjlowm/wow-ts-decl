{
  pkgs,
  yarn,
  nodejs,
  ...
}: let
  inherit (builtins.fromJSON (builtins.readFile ../package.json)) version;
  yarn = "${yarn}/bin/yarn";
  jq = "${pkgs.jq}/bin/jq";
in
  stdenvNoCC.mkDerivation {
    name = "wow-ts-decl-${version}";

    src = lib.fileset.toSource {
      root = ../.;
      fileset = lib.fileset.unions [
        ../src
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

    buildInputs = [pkgs.cacert];

    dontStrip = true;

    configurePhase = ''
      export HOME="$TMP";
      export yarn_global_folder="$TMP";
      mkdir -p .yarn/cache
    '';

    buildPhase = ''
      ${yarn} install --immutable
      ${yarn} tsc
    '';

    installPhase = ''
      mkdir -p $out

      ${_jq} '.imports."#@/*" |= ["./dist/*", "./dist/*.js"]' package.json | ${_jq} 'del(.workspaces)' > $out/package.json
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
