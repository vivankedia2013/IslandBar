fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").map(|o| o == "macos").unwrap_or(false) {
        println!("cargo:rerun-if-changed=src/mr.m");
        cc::Build::new().file("src/mr.m").flag("-fobjc-arc").compile("islandmr");
        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rustc-link-lib=framework=AppKit");
        println!("cargo:rustc-link-lib=framework=QuartzCore");
    }
    tauri_build::build()
}
