{
  callPackage,
  jq,
  cacert,
  ...
}: let
  inherit (builtins.fromJSON (builtins.readFile ../package.json)) version;
  nodejs = callPackage ./packages/nodejs.nix {};
  yarn = callPackage ./packages/yarn.nix {};
  jq = "${jq}/bin/jq";
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

    buildInputs = [cacert nodejs.pkg];

    dontStrip = true;

    configurePhase = ''
      export HOME="$TMP";
      export yarn_global_folder="$TMP";
      mkdir -p .yarn/cache
    '';

    buildPhase = ''
      ${yarn.bin} install --immutable
      ./scripts/scrape-wow-ui-source.ts 1.15.4 --out-dir=$out
      ./scripts/scrape-wow-ui-source.ts 11.0.7 --out-dir=$out
      ./scripts/scrape-wow-ui-source.ts 4.4.1 --out-dir=$out
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
