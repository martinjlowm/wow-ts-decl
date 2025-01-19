{
  pkgs,
  lib,
  ...
}: let
  nodejs = pkgs.nodejs_23;
in {
  pkg = nodejs;
  bin = "${nodejs}/bin/node";
}
