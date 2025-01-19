{
  pkgs,
  lib,
  ...
}: let
  nodejs = pkgs.callPackage ./nodejs.nix {};
  yarn = pkgs.yarn-berry.override {nodejs = nodejs.pkg;};
in {
  pkg = yarn;
  bin = "${yarn}/bin/yarn";
}
