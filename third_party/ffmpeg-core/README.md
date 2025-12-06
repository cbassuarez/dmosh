# FFmpeg in dmosh

dmosh uses [FFmpeg](https://ffmpeg.org) via the
[@ffmpeg/ffmpeg](https://www.npmjs.com/package/@ffmpeg/ffmpeg) WebAssembly build
for in-browser media processing.

## License

FFmpeg is licensed under the LGPLv2.1 or later (and GPL for optional components).
dmosh is configured to avoid GPL-only or nonfree components so that dmosh itself
can remain under the MIT License.

FFmpeg is a trademark of Fabrice Bellard, originator of the FFmpeg project.

## Corresponding Source

The FFmpeg project publishes source code for all official releases at:

- https://ffmpeg.org/download.html#releases
- https://ffmpeg.org/releases/

The version of FFmpeg used by `@ffmpeg/ffmpeg` is documented in that project’s
repository and release notes. You can obtain the corresponding FFmpeg source
code by downloading the appropriate `ffmpeg-X.Y.Z.tar.bz2` archive from
https://ffmpeg.org/releases/.

If dmosh adopts a custom FFmpeg build in the future (e.g., using a specific
configure line or patches), the configure options and any patch files should be
stored alongside this README (for example as `configure-args.txt` and
`patches/*.patch`) so that the exact build can be reconstructed.

## Future CLI/Desktop Builds

If a CLI or desktop binary for dmosh is distributed in the future and it links
against or bundles FFmpeg, the corresponding FFmpeg source code and build
information should be provided together with that binary, using this directory
as the canonical reference location and linking to it from release notes or
download pages.
