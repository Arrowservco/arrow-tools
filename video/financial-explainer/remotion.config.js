import {Config} from '@remotion/cli/config';

// H.264 MP4, yuv420p for maximum compatibility with TikTok / Reels / Shorts.
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
// PNG frames keep the output in standard limited-range yuv420p (JPEG frames give yuvj420p).
Config.setVideoImageFormat('png');
Config.setCrf(18);
Config.setOverwriteOutput(true);
