// Compile with ios/App/App/NativeGameAudio.swift. Adds authored foley without
// re-encoding video. Outputs remain in the report directory until reviewed.
import Foundation
import AVFoundation
import CryptoKit

func require(_ value: Bool, _ message: String) throws {
    if !value { throw NSError(domain: "WonderlandFilmAudio", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
}
func videoDigest(_ asset: AVAsset) throws -> (String, Int) {
    let track = asset.tracks(withMediaType: .video).first!
    let reader = try AVAssetReader(asset: asset)
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: nil)
    reader.add(output)
    try require(reader.startReading(), "Video reader failed")
    var hash = SHA256(), frames = 0
    while let sample = output.copyNextSampleBuffer() {
        if let block = CMSampleBufferGetDataBuffer(sample) {
            let size = CMBlockBufferGetDataLength(block)
            var bytes = Data(count: size)
            let status = bytes.withUnsafeMutableBytes { CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: size, destination: $0.baseAddress!) }
            try require(status == noErr, "Cannot read video packet")
            hash.update(data: bytes)
        }
        frames += CMSampleBufferGetNumSamples(sample)
    }
    try require(reader.status == .completed, "Video read incomplete")
    return (hash.finalize().map { String(format: "%02x", $0) }.joined(), frames)
}
func levels(_ buffer: AVAudioPCMBuffer) -> (peak: Float, rms: Double) {
    var peak: Float = 0, strongest = 0.0
    for c in 0..<Int(buffer.format.channelCount) {
        let data = buffer.floatChannelData![c]
        for first in stride(from: 0, to: Int(buffer.frameLength), by: 2205) {
            let end = min(first + 2205, Int(buffer.frameLength))
            var sum = 0.0
            for i in first..<end { peak = max(peak, abs(data[i])); sum += Double(data[i] * data[i]) }
            strongest = max(strongest, sqrt(sum / Double(end - first)))
        }
    }
    return (peak, strongest)
}
func writeSoundtrack(source: URL, target: URL, duration: Double) throws -> Double {
    let decoded = try NativeEffectAsset.load(url: source).buffer
    let rate = decoded.format.sampleRate, count = Int((duration * rate).rounded())
    let buffer = AVAudioPCMBuffer(pcmFormat: decoded.format, frameCapacity: AVAudioFrameCount(count))!
    buffer.frameLength = AVAudioFrameCount(count)
    // A light low-pass smooths source hiss; the app's existing SE bus applies
    // its own final timbre and the user's saved effects volume.
    let alpha = Float(1 - exp(-2 * Double.pi * 6000 / rate))
    for c in 0..<2 {
        var previous: Float = 0
        for i in 0..<count {
            let input = i < Int(decoded.frameLength) ? decoded.floatChannelData![c][i] : 0
            previous += alpha * (input - previous)
            buffer.floatChannelData![c][i] = previous
        }
    }
    let before = levels(buffer)
    try require(before.peak > 0.001 && before.rms > 0.001, "Generated soundtrack is silent")
    let gain = min(8, min(0.6 / Double(before.peak), 0.12 / before.rms))
    for c in 0..<2 {
        for i in 0..<count {
            let fade = min(1, min(Double(i) / (rate * 0.025), Double(count - 1 - i) / (rate * 0.22)))
            buffer.floatChannelData![c][i] *= Float(gain * max(0, fade))
        }
    }
    let file = try AVAudioFile(forWriting: target, settings: [AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: rate, AVNumberOfChannelsKey: 2, AVEncoderBitRateKey: 192000])
    try file.write(from: buffer)
    return gain
}

let root = URL(fileURLWithPath: CommandLine.arguments[1])
let report = root.appendingPathComponent("reports/wonderland-film-audio-20261028")
let prepared = report.appendingPathComponent("prepared"), masters = report.appendingPathComponent("masters")
try FileManager.default.createDirectory(at: prepared, withIntermediateDirectories: true)
try FileManager.default.createDirectory(at: masters, withIntermediateDirectories: true)
let jobs = try JSONSerialization.jsonObject(with: Data(contentsOf: report.appendingPathComponent("generation.json"))) as! [[String:Any]]
var results = [[String:Any]]()
for job in jobs {
    let name = job["file"] as! String, stem = String(name.dropLast(4))
    let backup = report.appendingPathComponent("before/" + name)
    let original = AVURLAsset(url: FileManager.default.fileExists(atPath: backup.path) ? backup : root.appendingPathComponent("assets/skins/alice-films-v1/" + name))
    try require(original.tracks(withMediaType: .audio).isEmpty, "Refusing to overwrite existing audio: " + name)
    let duration = original.duration
    let audioURL = masters.appendingPathComponent(stem + ".m4a")
    if FileManager.default.fileExists(atPath: audioURL.path) { try FileManager.default.removeItem(at: audioURL) }
    let gain = try writeSoundtrack(source: report.appendingPathComponent("sources/" + stem + ".mp3"), target: audioURL, duration: duration.seconds)
    let audio = AVURLAsset(url: audioURL)
    let composition = AVMutableComposition()
    let picture = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
    let originalTrack = original.tracks(withMediaType: .video).first!
    try picture.insertTimeRange(originalTrack.timeRange, of: originalTrack, at: .zero)
    picture.preferredTransform = originalTrack.preferredTransform
    let sound = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
    try sound.insertTimeRange(CMTimeRange(start: .zero, duration: duration), of: audio.tracks(withMediaType: .audio).first!, at: .zero)
    let target = prepared.appendingPathComponent(name)
    if FileManager.default.fileExists(atPath: target.path) { try FileManager.default.removeItem(at: target) }
    let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)!
    exporter.outputURL = target; exporter.outputFileType = .mp4
    exporter.timeRange = CMTimeRange(start: .zero, duration: duration)
    exporter.shouldOptimizeForNetworkUse = true
    let done = DispatchSemaphore(value: 0)
    exporter.exportAsynchronously { done.signal() }; done.wait()
    try require(exporter.status == .completed, "Mux failed: \(name) \(String(describing: exporter.error))")
    let movie = AVURLAsset(url: target)
    let before = try videoDigest(original), after = try videoDigest(movie)
    try require(before == after, "Compressed video packets changed: " + name)
    try require(abs(movie.duration.seconds - duration.seconds) < 0.002, "Movie length changed: " + name)
    let level = levels(try NativeEffectAsset.load(url: target).buffer)
    try require(level.peak < 0.75 && level.rms > 0.005, "Audio level invalid: " + name)
    results.append(["file": name, "duration": movie.duration.seconds, "videoSHA256": after.0, "videoFrames": after.1, "videoBitExact": true, "audioPeak": level.peak, "audioStrongestRMS": level.rms, "sourceGain": gain, "audioTracks": movie.tracks(withMediaType: .audio).count])
    print("Prepared and verified \(name): video unchanged, peak \(level.peak)")
}
try JSONSerialization.data(withJSONObject: results, options: [.prettyPrinted,.sortedKeys]).write(to: report.appendingPathComponent("verification.json"))
