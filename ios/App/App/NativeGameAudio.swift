import Foundation
import AVFoundation

#if os(iOS)
// iOS 15 can deliver this deactivation only after the app runs again. It is
// not an ongoing phone call and has no matching "interruption ended" event.
// https://developer.apple.com/documentation/avfaudio/avaudiosession/interruptionnotification
func gameAudioWasSuspended(_ notification: Notification) -> Bool {
    let reason = notification.userInfo?[AVAudioSessionInterruptionReasonKey] as? UInt
    let legacy = notification.userInfo?[AVAudioSessionInterruptionWasSuspendedKey] as? Bool ?? false
    return reason == AVAudioSession.InterruptionReason.appWasSuspended.rawValue || legacy
}
#endif

// Independent of WebKit's visibility events and media-suspension completion.
struct NativeGameAudioLifecycle {
    private(set) var active = true
    private(set) var interrupted = false
    private(set) var needsGesture = false
    var canPlay: Bool { active && !interrupted && !needsGesture }
    mutating func background() { active = false }
    mutating func foreground() { active = true }
    mutating func interruptionBegan(isSuspension: Bool = false) {
        if !isSuspension { interrupted = true }
    }
    mutating func interruptionEnded(shouldResume: Bool) {
        interrupted = false
        needsGesture = !shouldResume
    }
    mutating func gesture() { needsGesture = false }
    // A delayed JS background command must not pause an already resumed song.
    func acceptsPause(keepingIntent: Bool) -> Bool { !keepingIntent || !active }
}

struct NativeEffectAsset {
    let buffer: AVAudioPCMBuffer
    let cueGain: Float
    var duration: Double { Double(buffer.frameLength) / buffer.format.sampleRate }

    static func load(url: URL) throws -> Self {
        // AVAssetReader also handles the audio track of a bundled skin movie.
        let asset = AVURLAsset(url: url)
        guard let track = asset.tracks(withMediaType: .audio).first else {
            throw NSError(domain: "NativeGameAudio", code: 20,
                          userInfo: [NSLocalizedDescriptionKey: "No audio track"])
        }
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
            AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 44100,
            AVNumberOfChannelsKey: 2, AVLinearPCMBitDepthKey: 32,
            AVLinearPCMIsFloatKey: true, AVLinearPCMIsBigEndianKey: false,
            AVLinearPCMIsNonInterleaved: false
        ])
        output.alwaysCopiesSampleData = false
        reader.add(output)
        guard reader.startReading() else { throw reader.error ?? NSError(domain: "NativeGameAudio", code: 21) }
        var samples = Data()
        while let sample = output.copyNextSampleBuffer() {
            guard let block = CMSampleBufferGetDataBuffer(sample) else { continue }
            let size = CMBlockBufferGetDataLength(block)
            let old = samples.count
            // Keep malformed/unexpected movie files from exhausting memory.
            guard old + size <= 44100 * 2 * 4 * 30 else {
                reader.cancelReading()
                throw NSError(domain: "NativeGameAudio", code: 22)
            }
            samples.count += size
            let copied = samples.withUnsafeMutableBytes { data in
                CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: size,
                                          destination: data.baseAddress!.advanced(by: old))
            }
            guard copied == kCMBlockBufferNoErr else { throw NSError(domain: "NativeGameAudio", code: 23) }
        }
        guard reader.status == .completed, !samples.isEmpty,
              let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 2),
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(samples.count / 8)),
              let channels = buffer.floatChannelData else {
            throw reader.error ?? NSError(domain: "NativeGameAudio", code: 24)
        }
        buffer.frameLength = buffer.frameCapacity
        samples.withUnsafeBytes { raw in
            let data = raw.bindMemory(to: Float.self)
            for frame in 0..<Int(buffer.frameLength) {
                for channel in 0..<2 { channels[channel][frame] = data[frame * 2 + channel] }
            }
        }
        var peak: Float = 0, strongest: Double = 0
        let window = 2205
        for channel in 0..<2 {
            for start in stride(from: 0, to: Int(buffer.frameLength), by: window) {
                let end = min(start + window, Int(buffer.frameLength))
                var energy: Double = 0
                for frame in start..<end {
                    let value = channels[channel][frame]
                    peak = max(peak, abs(value))
                    energy += Double(value * value)
                }
                strongest = max(strongest, sqrt(energy / Double(end - start)))
            }
        }
        let gain: Float = peak > 0 ? min(12, 0.4 / peak, Float(max(1, 0.09 / max(strongest, 0.000001)))) : 1
        return Self(buffer: buffer, cueGain: gain)
    }
}

final class NativeEffectsEngine {
    final class Voice {
        let player = AVAudioPlayerNode()
        let speed = AVAudioUnitVarispeed()
        let stretch: AVAudioUnitTimePitch?
        var token: String?
        var priority = 0
        var ui = false
        var generation = 0
        init(movie: Bool) { stretch = movie ? AVAudioUnitTimePitch() : nil }
    }
    let engine = AVAudioEngine()
    let bus = AVAudioMixerNode()
    let soft = AVAudioUnitEQ(numberOfBands: 2)
    private(set) var voices: [Voice] = []
    var onEnded: ((String) -> Void)?

    init() {
        let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 2)!
        engine.attach(bus)
        engine.attach(soft)
        // Match the existing SE protection. Music never passes through it.
        soft.bands[0].filterType = .highShelf
        soft.bands[0].frequency = 1400
        soft.bands[0].gain = -6
        soft.bands[0].bypass = false
        soft.bands[1].filterType = .lowPass
        soft.bands[1].frequency = 3200
        soft.bands[1].bypass = false
        engine.connect(bus, to: soft, format: format)
        engine.connect(soft, to: engine.mainMixerNode, format: format)
        // Eight interactive cues and two separately bounded movie soundtracks.
        for index in 0..<10 {
            let voice = Voice(movie: index >= 8)
            engine.attach(voice.player)
            engine.attach(voice.speed)
            engine.connect(voice.player, to: voice.speed, format: format)
            if let stretch = voice.stretch {
                engine.attach(stretch)
                engine.connect(voice.speed, to: stretch, format: format)
                engine.connect(stretch, to: bus, format: format)
            } else { engine.connect(voice.speed, to: bus, format: format) }
            voices.append(voice)
        }
        bus.outputVolume = 0.75
    }

    func setVolume(_ value: Float) { bus.outputVolume = min(1, max(0, value.isFinite ? value : 0)) }

    func play(asset: NativeEffectAsset, token: String, gain: Float, rate: Float,
              priority: Int, ui: Bool, movie: Bool, offset: Double) throws -> Bool {
        let pool = voices.filter { ($0.stretch != nil) == movie }
        if priority > 0 {
            for voice in voices where voice.ui { stop(voice) }
        }
        if priority == 4 {
            for voice in pool where voice.token != nil && voice.priority < priority { stop(voice) }
        }
        guard let voice = pool.first(where: { $0.token == nil }) ?? pool.first(where: { $0.priority < priority }) else { return false }
        stop(voice)
        let safeOffset = offset.isFinite ? max(0, offset) : 0
        let first = min(Int(asset.buffer.frameLength), Int(min(safeOffset, 30) * 44100))
        guard first < Int(asset.buffer.frameLength) else { return false }
        let buffer: AVAudioPCMBuffer
        let amplitude = min(12, max(0, gain.isFinite ? gain : 0))
        if first == 0 && amplitude <= 1 { buffer = asset.buffer }
        else {
            let count = Int(asset.buffer.frameLength) - first
            guard let tail = AVAudioPCMBuffer(pcmFormat: asset.buffer.format, frameCapacity: AVAudioFrameCount(count)) else { return false }
            tail.frameLength = tail.frameCapacity
            for channel in 0..<2 {
                for frame in 0..<count {
                    tail.floatChannelData![channel][frame] = asset.buffer.floatChannelData![channel][first + frame] * (amplitude > 1 ? amplitude : 1)
                }
            }
            buffer = tail
        }
        voice.token = token
        voice.priority = priority
        voice.ui = ui
        voice.player.volume = min(1, amplitude)
        let speed = min(movie ? 3 : 2, max(0.5, rate.isFinite ? rate : 1))
        if let stretch = voice.stretch {
            voice.speed.rate = 1
            stretch.rate = speed
            stretch.pitch = 0
            stretch.bypass = abs(speed - 1) < 0.0001
        } else { voice.speed.rate = speed }
        let generation = voice.generation
        voice.player.scheduleBuffer(buffer, at: nil, options: [], completionCallbackType: .dataPlayedBack) { [weak self, weak voice] _ in
            DispatchQueue.main.async {
                guard let self, let voice, voice.generation == generation else { return }
                self.stop(voice)
            }
        }
        engine.prepare()
        if !engine.isRunning { try engine.start() }
        voice.player.play()
        return true
    }

    func stop(token: String) { for voice in voices where voice.token == token { stop(voice) } }
    private func stop(_ voice: Voice) {
        let token = voice.token
        voice.generation += 1
        voice.token = nil
        voice.ui = false
        voice.player.stop()
        if let token { onEnded?(token) }
    }
    func stopAll() {
        for voice in voices { stop(voice) }
        engine.pause()
    }
    deinit { engine.stop() }
}
