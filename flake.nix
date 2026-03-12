{
  description = "Cargo Cleaner - Automated Rust project cleanup tool for macOS";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, rust-overlay, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };

        # Pin to the Rust version used in development
        rustToolchain = pkgs.rust-bin.stable."1.92.0".default.override {
          extensions = [ "rust-src" "clippy" "rustfmt" "rust-analyzer" ];
        };

        # macOS-only: bzip2/xz needed by some Rust crates on Darwin
        # (frameworks are provided automatically by the nixpkgs macOS stdenv
        # since darwin.apple_sdk_11_0/12_3 were removed in nixpkgs 25.11)
        darwinBuildInputs = pkgs.lib.optionals pkgs.stdenv.isDarwin [
          pkgs.bzip2
          pkgs.xz
        ];
      in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            rustToolchain
            pkgs.bun
            pkgs.pkg-config
          ] ++ darwinBuildInputs;

          # .cargo/config.toml points CC/CXX to /usr/bin/clang and LIBRARY_PATH
          # to the Xcode CLI SDK, which avoids conflicts with Nix-provided GCC.
          # macOS frameworks are resolved automatically by the nixpkgs stdenv.
          env = {
            RUST_SRC_PATH = "${rustToolchain}/lib/rustlib/src/rust/library";
            RUST_BACKTRACE = "1";
          };

          shellHook = ''
            echo "🦀 Cargo Cleaner dev environment"
            echo "   Rust: $(rustc --version)"
            echo "   Bun:  $(bun --version)"
            echo ""
            echo "Commands:"
            echo "   cargo check --workspace      check all crates"
            echo "   cargo run -p cargo-cleaner   run CLI"
            echo "   bun run tauri dev            run GUI (Vite + Tauri)"
            echo "   bun run build                build frontend only"
          '';
        };
      }
    );
}
