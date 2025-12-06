# Third-Party Licenses

This document lists third-party components and libraries used by dmosh.

## Project License

dmosh is licensed under the MIT License. See the [LICENSE](./LICENSE) file for full details.

## FFmpeg

dmosh uses code of [FFmpeg](https://ffmpeg.org) via the
[@ffmpeg/ffmpeg](https://www.npmjs.com/package/@ffmpeg/ffmpeg) WebAssembly build
for in-browser encoding and decoding.

FFmpeg is licensed under the [LGPLv2.1 or later](https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html)
(and GPL for optional components). dmosh is configured to avoid GPL-only or
nonfree components so that the application can remain under the MIT License.

FFmpeg is a trademark of Fabrice Bellard, originator of the FFmpeg project.

For corresponding FFmpeg source code and build information, see
[`third_party/ffmpeg-core/`](./third_party/ffmpeg-core/).

## Other Dependencies

dmosh also uses open-source libraries such as:

- [React](https://react.dev/)
- [React Router](https://reactrouter.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Lucide Icons](https://lucide.dev/)

Please refer to each project’s repository for their respective licenses.
