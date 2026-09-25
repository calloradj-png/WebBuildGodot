# Godot 4 SCons build options for minimal 2D Web export template
# Usage:
# Place this file as `custom.py` in the root of the Godot source tree,
# or run SCons with: scons platform=web profile=custom.py

platform = "web"
target = "template_release"
arch = "wasm32"

# Aggressive size optimization and Link Time Optimization (LTO)
optimize = "size"
lto = "full"
use_closure_compiler = "no"
debug_symbols = "no"

# Single-threaded mode:
# 1. Instant startup (no WebWorker initialization lag)
# 2. Runs everywhere without Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy (COOP/COEP) headers
# 3. Compatible with itch.io, Yandex Games, VK Games, Telegram Mini Apps, GitHub Pages
threads = "no"

# Disable GDExtension dynamic linking (saves ~2-3 MB WASM size)
dlink_enabled = "no"

# Core 2D-only flags: Completely strip all 3D engine components
disable_3d = "yes"
disable_physics_3d = "yes"

# Text Server: Use Fallback Text Server instead of heavy ICU + HarfBuzz Advanced Text Server.
# RichTextLabel and BBCode ([b], [color], [font_size], [shake], etc.) work completely!
module_text_server_adv_enabled = "no"
module_text_server_fb_enabled = "yes"

# Disable 3D Physics and Navigation
module_godot_physics_3d_enabled = "no"
module_jolt_enabled = "no"
module_navigation_3d_enabled = "no"
module_raycast_enabled = "no"

# Disable 3D import/export modules
module_gltf_enabled = "no"
module_fbx_enabled = "no"
module_csg_enabled = "no"
module_gridmap_enabled = "no"
module_meshoptimizer_enabled = "no"
module_vhacd_enabled = "no"

# Disable VR / XR modules
module_openxr_enabled = "no"
module_webxr_enabled = "no"
module_mobile_vr_enabled = "no"

# Disable unused texture compressors (for 2D Web, PNG and WebP are optimal)
module_astcenc_enabled = "no"
module_basis_universal_enabled = "no"
module_bcdec_enabled = "no"
module_dds_enabled = "no"
module_etcpak_enabled = "no"
module_ktx_enabled = "no"
module_tinyexr_enabled = "no"
module_tga_enabled = "no"
module_bmp_enabled = "no"
module_hdr_enabled = "no"

# Disable unused networking and video modules
module_camera_enabled = "no"
module_webrtc_enabled = "no"
module_upnp_enabled = "no"
module_enet_enabled = "no"
module_multiplayer_enabled = "no"
module_theora_enabled = "no"
module_zip_enabled = "no"
