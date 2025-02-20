{pkgs, ...}: let
  inherit (builtins.fromJSON (builtins.readFile ../package.json)) version;
  yarn = callPackage ./packages/yarn.nix {};
  wiki = callPackage ./wiki.nix {};
  wow-ui-source = callPackage ./wow-ui-source.nix {};
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
      ${yarn.bin} install --immutable
      ./scripts/combine-sources.ts --wow-ui-source=${wow-ui-source} --wiki=${wiki}
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
      description = "Typesafe API declarations for developers that seek a laid-back AddOn developer experience.";
      platforms = platforms.linux ++ platforms.darwin;
    };
  }
