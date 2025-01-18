# Install direnv, nix-direnv and cachix
nix profile install -f '<nixpkgs>' direnv nix-direnv

# Enable nix-direnv's caching capabilities for direnv
mkdir -p ~/.config/direnv
echo "source $HOME/.nix-profile/share/nix-direnv/direnvrc" > ~/.config/direnv/direnvrc

# Hook direnv into your shell
SHELL_BIN=$(basename $SHELL)
echo "eval \"\$(direnv hook $SHELL_BIN)\"" >> ~/.${SHELL_BIN}rc
echo "export DIRENV_WARN_TIMEOUT=0" >> ~/.${SHELL_BIN}rc
mkdir -p ~/.config/direnv
cat <<EOF >> ~/.config/direnv/direnv.toml
[global]
hide_env_diff = true
EOF
eval "$(direnv hook $SHELL_BIN)"
unset SHELL_BIN
