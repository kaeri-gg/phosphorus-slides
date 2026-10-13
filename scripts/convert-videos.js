import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

const DEFAULT_DIR = 'public/assets/videos';
const DEFAULT_MAX_MB = 90;
const SAFETY_TARGET_MB = 85; // Target safety size to ensure output is strictly <= 90MB

// Supported input extensions to convert
const VIDEO_EXTENSIONS = new Set(['.webm', '.mov', '.avi', '.mkv', '.wmv', '.flv']);

function getFfmpeg() {
    if (ffmpegPath && fs.existsSync(ffmpegPath)) {
        return ffmpegPath;
    }
    // Fallback to system ffmpeg if available
    const check = spawnSync('which', ['ffmpeg'], { encoding: 'utf8' });
    if (check.status === 0 && check.stdout.trim()) {
        return check.stdout.trim();
    }
    throw new Error('FFmpeg binary not found. Please run "npm install" to install ffmpeg-static.');
}

function getVideoDuration(ffmpeg, filePath) {
    const result = spawnSync(ffmpeg, ['-i', filePath], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
    });
    const output = (result.stderr || '') + (result.stdout || '');
    const match = output.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
    if (!match) return 0;
    const hours = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    const secs = parseFloat(match[3]);
    return hours * 3600 + mins * 60 + secs;
}

function formatBytes(bytes) {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function convertVideo(ffmpeg, inputPath, outputPath, maxMb) {
    const duration = getVideoDuration(ffmpeg, inputPath);
    const targetMb = Math.min(SAFETY_TARGET_MB, maxMb - 2);

    // Compute max bitrate to guarantee <= targetMb
    let maxBitrateKbps = 0;
    if (duration > 0) {
        maxBitrateKbps = Math.floor((targetMb * 8 * 1024) / duration);
    }

    const args = [
        '-y',
        '-i', inputPath,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '22',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-c:a', 'aac',
        '-b:a', '128k'
    ];

    if (maxBitrateKbps > 0) {
        args.push('-maxrate', `${maxBitrateKbps}k`);
        args.push('-bufsize', `${maxBitrateKbps * 2}k`);
    }

    args.push(outputPath);

    const proc = spawnSync(ffmpeg, args, { stdio: 'inherit' });
    if (proc.status !== 0) {
        throw new Error(`FFmpeg failed with exit code ${proc.status} for ${inputPath}`);
    }

    // Verify output size
    let stats = fs.statSync(outputPath);
    const maxBytes = maxMb * 1024 * 1024;

    if (stats.size > maxBytes && duration > 0) {
        console.warn(`\n⚠️  File exceeded ${maxMb}MB (${formatBytes(stats.size)}). Re-encoding with strict 2-pass bitrate...`);
        const strictVideoBitrate = Math.max(300, Math.floor(((targetMb - 5) * 8 * 1024) / duration) - 128);

        // Pass 1
        spawnSync(ffmpeg, [
            '-y',
            '-i', inputPath,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-b:v', `${strictVideoBitrate}k`,
            '-pass', '1',
            '-an',
            '-f', 'null',
            '/dev/null'
        ], { stdio: 'inherit' });

        // Pass 2
        spawnSync(ffmpeg, [
            '-y',
            '-i', inputPath,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-b:v', `${strictVideoBitrate}k`,
            '-pass', '2',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            outputPath
        ], { stdio: 'inherit' });

        // Cleanup pass log files
        const passLog = path.join(process.cwd(), 'ffmpeg2pass-0.log');
        const passLogMbtree = path.join(process.cwd(), 'ffmpeg2pass-0.log.mbtree');
        if (fs.existsSync(passLog)) fs.unlinkSync(passLog);
        if (fs.existsSync(passLogMbtree)) fs.unlinkSync(passLogMbtree);

        stats = fs.statSync(outputPath);
    }

    return stats.size;
}

async function main() {
    const args = process.argv.slice(2);
    let targetDir = DEFAULT_DIR;
    let maxMb = DEFAULT_MAX_MB;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--dir' && args[i + 1]) {
            targetDir = args[++i];
        } else if (args[i] === '--max' && args[i + 1]) {
            maxMb = parseFloat(args[++i]) || DEFAULT_MAX_MB;
        }
    }

    const resolvedDir = path.resolve(process.cwd(), targetDir);
    if (!fs.existsSync(resolvedDir)) {
        console.error(`Directory not found: ${resolvedDir}`);
        process.exit(1);
    }

    const ffmpeg = getFfmpeg();
    console.log(`🎬 Video Batch Converter`);
    console.log(`📁 Directory: ${resolvedDir}`);
    console.log(`🎯 Max Size Limit: ${maxMb} MB`);
    console.log(`🔧 FFmpeg: ${ffmpeg}\n`);

    const files = fs.readdirSync(resolvedDir).filter(f => {
        const ext = path.extname(f).toLowerCase();
        return VIDEO_EXTENSIONS.has(ext);
    });

    if (files.length === 0) {
        console.log('✨ No matching non-MP4 videos found to convert.');
        return;
    }

    console.log(`Found ${files.length} video(s) to process:\n`);

    const summary = [];
    const startTime = Date.now();

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const inputPath = path.join(resolvedDir, file);
        const outName = `${path.basename(file, path.extname(file))}.mp4`;
        const outputPath = path.join(resolvedDir, outName);

        const inStats = fs.statSync(inputPath);
        console.log(`[${i + 1}/${files.length}] Converting: ${file} (${formatBytes(inStats.size)})...`);

        const fileStartTime = Date.now();
        const outSize = convertVideo(ffmpeg, inputPath, outputPath, maxMb);
        const elapsedSec = ((Date.now() - fileStartTime) / 1000).toFixed(1);

        const diff = inStats.size - outSize;
        const diffPercent = ((diff / inStats.size) * 100).toFixed(1);
        const savedText = diff >= 0 ? `Saved ${formatBytes(diff)} (${diffPercent}%)` : `+${formatBytes(-diff)}`;

        console.log(`   ✓ Done in ${elapsedSec}s -> ${outName} (${formatBytes(outSize)}) [${savedText}]\n`);

        summary.push({
            file,
            outName,
            inSize: inStats.size,
            outSize,
            passed: outSize <= maxMb * 1024 * 1024
        });
    }

    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('='.repeat(70));
    console.log(`🎉 Conversion finished in ${totalElapsed}s`);
    console.log('='.repeat(70));
    console.log('Summary:');
    let totalIn = 0;
    let totalOut = 0;
    let allPassed = true;

    for (const item of summary) {
        totalIn += item.inSize;
        totalOut += item.outSize;
        if (!item.passed) allPassed = false;
        const status = item.passed ? '✅ <= 90MB' : '❌ > 90MB';
        console.log(` - ${item.file.padEnd(35)} -> ${item.outName.padEnd(35)} ${formatBytes(item.outSize).padStart(10)} [${status}]`);
    }

    // Automatically update references in conference.md
    const conferenceMdPath = path.resolve(process.cwd(), 'public/conference.md');
    if (fs.existsSync(conferenceMdPath) && summary.length > 0) {
        let mdContent = fs.readFileSync(conferenceMdPath, 'utf8');
        let updated = false;
        for (const item of summary) {
            const regex = new RegExp(item.file.replace('.', '\\.'), 'g');
            if (regex.test(mdContent)) {
                mdContent = mdContent.replace(regex, item.outName);
                updated = true;
            }
        }
        if (updated) {
            fs.writeFileSync(conferenceMdPath, mdContent);
            console.log('📝 Automatically updated public/conference.md video references to .mp4');
        }
    }
}

main().catch(err => {
    console.error('Error during video batch conversion:', err);
    process.exit(1);
});
