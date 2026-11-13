'use strict';

/**
 * Video transcoding queue using Bull + FFmpeg.
 * Converts uploaded videos to HLS (adaptive bitrate) for streaming.
 */

const Bull = require('bull');
const Queue = Bull;
const Worker = require('bull').Worker;
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { getMinioClient, getBucket, presignGet, putObject, listObjects, removeObject } = require('./minio-client');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const hlsBasePath = process.env.HLS_BASE_PATH || '/var/www/hls';
const hlsPublicUrl = process.env.HLS_PUBLIC_URL || '/hls';

// Ensure HLS directory exists
if (!fs.existsSync(hlsBasePath)) {
  fs.mkdirSync(hlsBasePath, { recursive: true });
}

// Bull queue for transcoding jobs
const transcodeQueue = new Queue('video-transcode', redisUrl, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

/**
 * Video quality profiles for adaptive streaming.
 * Each profile: { name, width, height, videoBitrate, audioBitrate }
 */
const QUALITY_PROFILES = [
  { name: '1080p', width: 1920, height: 1080, videoBitrate: '5000k', audioBitrate: '192k' },
  { name: '720p', width: 1280, height: 720, videoBitrate: '2800k', audioBitrate: '128k' },
  { name: '480p', width: 854, height: 480, videoBitrate: '1400k', audioBitrate: '96k' },
  { name: '360p', width: 640, height: 360, videoBitrate: '800k', audioBitrate: '64k' },
];

/**
 * Run FFmpeg command with progress tracking.
 */
function runFFmpeg(args, onProgress) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      if (onProgress) {
        // Parse progress from stderr (time=, speed=, etc)
        const timeMatch = stderr.match(/time=(\d+:\d+:\d+\.\d+)/);
        if (timeMatch) onProgress({ time: timeMatch[1] });
      }
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });

    ffmpeg.on('error', (err) => reject(new Error(`FFmpeg spawn error: ${err.message}`)));
  });
}

/**
 * Probe video metadata (duration, dimensions, codecs).
 */
async function probeVideo(inputPath) {
  const { stdout } = await promisify(spawn)('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,duration,codec_name',
    '-of', 'json',
    inputPath,
  ]);
  const data = JSON.parse(stdout);
  const stream = data.streams?.[0];
  return {
    width: stream?.width || 0,
    height: stream?.height || 0,
    duration: parseFloat(stream?.duration || '0'),
    codec: stream?.codec_name || 'unknown',
  };
}

/**
 * Transcode video to HLS with multiple qualities.
 * @param {string} videoId - Unique video ID
 * @param {string} sourcePath - Local path or MinIO object key
 * @param {object} opts - Options (isMinioSource, etc)
 * @returns {Promise<{masterPlaylistUrl: string, qualities: string[]}>}
 */
async function transcodeToHLS(videoId, sourcePath, opts = {}) {
  const { isMinioSource = false } = opts;
  const outputDir = path.join(hlsBasePath, videoId);
  const hlsDir = path.join(outputDir, 'streams');
  const segmentsDir = path.join(hlsDir, 'segments');

  // Create directories
  fs.mkdirSync(hlsDir, { recursive: true });
  fs.mkdirSync(segmentsDir, { recursive: true });

  // Determine input: local file or MinIO object
  let inputFile = sourcePath;
  if (isMinioSource) {
    // Download from MinIO to temp file
    inputFile = path.join('/tmp', `${videoId}_source${path.extname(sourcePath) || '.mp4'}`);
    const client = getMinioClient();
    const bucket = getBucket();
    const stream = await client.getObject(bucket, sourcePath);
    await new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(inputFile);
      stream.pipe(fileStream);
      stream.on('end', resolve);
      stream.on('error', reject);
      fileStream.on('error', reject);
    });
  }

  // Probe source
  const meta = await probeVideo(inputFile);
  console.log(`[Transcode] Video ${videoId}: ${meta.width}x${meta.height}, ${meta.duration}s, ${meta.codec}`);

  // Filter profiles to not upscale
  const profiles = QUALITY_PROFILES.filter(p => p.width <= meta.width && p.height <= meta.height);
  if (profiles.length === 0) profiles.push(QUALITY_PROFILES[QUALITY_PROFILES.length - 1]); // At least lowest

  // Transcode each quality
  const variantPlaylists = [];
  for (const profile of profiles) {
    const variantDir = path.join(segmentsDir, profile.name);
    fs.mkdirSync(variantDir, { recursive: true });

    const playlistPath = path.join(variantDir, 'index.m3u8');
    const segmentPattern = path.join(variantDir, 'seg_%03d.ts');

    const args = [
      '-y',
      '-i', inputFile,
      '-vf', `scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2`,
      '-c:v', 'libx264',
      '-b:v', profile.videoBitrate,
      '-maxrate', profile.videoBitrate,
      '-bufsize', `${parseInt(profile.videoBitrate) * 2}k`,
      '-c:a', 'aac',
      '-b:a', profile.audioBitrate,
      '-ac', '2',
      '-ar', '48000',
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', segmentPattern,
      '-hls_flags', 'independent_segments',
      '-master_pl_name', 'master.m3u8',
      '-hls_list_size', '0',
      playlistPath,
    ];

    console.log(`[Transcode] ${videoId} → ${profile.name} (${profile.videoBitrate})`);
    await runFFmpeg(args, (progress) => {
      // Could emit progress to queue job
    });

    variantPlaylists.push({
      name: profile.name,
      bandwidth: parseInt(profile.videoBitrate) * 1000 + parseInt(profile.audioBitrate) * 1000,
      resolution: `${profile.width}x${profile.height}`,
      playlist: `streams/${profile.name}/index.m3u8`,
    });
  }

  // Generate master playlist
  const masterPath = path.join(hlsDir, 'master.m3u8');
  let masterContent = '#EXTM3U\n#EXT-X-VERSION:6\n\n';
  for (const v of variantPlaylists) {
    masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=${v.bandwidth},RESOLUTION=${v.resolution},CODECS="avc1.4d401f,mp4a.40.2"\n`;
    masterContent += `${v.playlist}\n`;
  }
  fs.writeFileSync(masterPath, masterContent);

  // Clean up temp source file if downloaded from MinIO
  if (isMinioSource && inputFile.startsWith('/tmp/')) {
    fs.unlinkSync(inputFile);
  }

  // Upload HLS files to MinIO for CDN distribution (optional)
  // For now, serve directly from filesystem via Nginx
  // But also upload to MinIO as backup
  try {
    await uploadHLSToMinIO(videoId, hlsDir);
  } catch (err) {
    console.warn('[Transcode] MinIO upload failed, serving from local:', err.message);
  }

  const publicUrl = `${hlsPublicUrl}/${videoId}/streams/master.m3u8`;
  return {
    masterPlaylistUrl: publicUrl,
    qualities: variantPlaylists.map(v => v.name),
    duration: meta.duration,
    width: meta.width,
    height: meta.height,
  };
}

/**
 * Upload HLS directory to MinIO for redundancy/CDN.
 */
async function uploadHLSToMinIO(videoId, hlsDir) {
  const client = getMinioClient();
  const bucket = getBucket();

  for (const file of fs.readdirSync(hlsDir, { recursive: true })) {
    const filePath = path.join(hlsDir, file);
    if (!fs.statSync(filePath).isFile()) continue;
    const relativePath = path.relative(hlsDir, filePath);
    const objectKey = `hls/${videoId}/${relativePath}`;
    const contentType = getContentType(filePath);
    await putObject(objectKey, fs.createReadStream(filePath), { 'Content-Type': contentType });
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.m3u8') return 'application/vnd.apple.mpegurl';
  if (ext === '.ts') return 'video/mp2t';
  if (ext === '.mp4') return 'video/mp4';
  return 'application/octet-stream';
}

/**
 * Generate HLS manifest URL for frontend.
 */
function getHLSManifestUrl(videoId) {
  return `${hlsPublicUrl}/${videoId}/streams/master.m3u8`;
}

/**
 * Delete HLS files (local + MinIO).
 */
async function deleteHLS(videoId) {
  const localDir = path.join(hlsBasePath, videoId);
  if (fs.existsSync(localDir)) {
    fs.rmSync(localDir, { recursive: true, force: true });
  }
  // Delete from MinIO
  try {
    const client = getMinioClient();
    const bucket = getBucket();
    for await (const obj of listObjects(`hls/${videoId}/`)) {
      await removeObject(obj.name);
    }
  } catch (err) {
    console.warn('[Transcode] MinIO cleanup failed:', err.message);
  }
}

/**
 * Add transcode job to queue.
 */
async function enqueueTranscode(videoId, sourcePath, opts = {}) {
  return transcodeQueue.add('transcode', { videoId, sourcePath, ...opts });
}

/**
 * Get job status.
 */
async function getJobStatus(jobId) {
  const job = await transcodeQueue.getJob(jobId);
  if (!job) return null;
  const state = await job.getState();
  const progress = job.progress();
  return { id: job.id, state, progress, data: job.data, result: job.returnvalue, failedReason: job.failedReason };
}

/**
 * Initialize worker (call once on server start).
 */
function startTranscodeWorker(concurrency = 2) {
  const worker = new Worker('video-transcode', async (job) => {
    const { videoId, sourcePath, isMinioSource } = job.data;
    console.log(`[Worker] Starting transcode for ${videoId}`);
    job.updateProgress(10);

    try {
      const result = await transcodeToHLS(videoId, sourcePath, { isMinioSource });
      job.updateProgress(100);
      console.log(`[Worker] Transcode complete for ${videoId}: ${result.qualities.join(', ')}`);
      return result;
    } catch (err) {
      console.error(`[Worker] Transcode failed for ${videoId}:`, err.message);
      throw err;
    }
  }, { redisUrl, concurrency });

  worker.on('completed', (job) => console.log(`[Worker] Job ${job.id} completed`));
  worker.on('failed', (job, err) => console.error(`[Worker] Job ${job.id} failed:`, err.message));

  return worker;
}

module.exports = {
  transcodeQueue,
  transcodeToHLS,
  getHLSManifestUrl,
  deleteHLS,
  enqueueTranscode,
  getJobStatus,
  startTranscodeWorker,
  QUALITY_PROFILES,
};