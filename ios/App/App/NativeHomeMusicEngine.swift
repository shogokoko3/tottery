import Foundation
import AVFAudio

/// All positions are source frames. Playback has no varispeed/time-pitch unit.
struct NativeHomeMusicRange {
    let sampleRate: Double
    let start: AVAudioFramePosition
    let end: AVAudioFramePosition

    init(sampleRate: Double, length: AVAudioFramePosition, start: Double, end: Double) throws {
        guard sampleRate.isFinite, sampleRate > 0, start.isFinite, end.isFinite,
              start >= 0, end > start, end * sampleRate <= Double(length) + 1 else {
            throw NSError(domain: "NativeHomeMusic", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Invalid music loop range"])
        }
        let first = AVAudioFramePosition((start * sampleRate).rounded())
        let last = min(length, AVAudioFramePosition((end * sampleRate).rounded()))
        guard last > first else {
            throw NSError(domain: "NativeHomeMusic", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Music loop is shorter than one frame"])
        }
        self.sampleRate = sampleRate
        self.start = first
        self.end = last
    }

    func frame(at seconds: Double) -> AVAudioFramePosition {
        guard seconds.isFinite else { return 0 }
        let safe = max(0, seconds)
        let endSeconds = Double(end) / sampleRate
        if safe >= endSeconds {
            let startSeconds = Double(start) / sampleRate
            let length = Double(end - start) / sampleRate
            return wrap(start + AVAudioFramePosition(((safe - startSeconds).truncatingRemainder(dividingBy: length) * sampleRate).rounded()))
        }
        let frame = AVAudioFramePosition((safe * sampleRate).rounded())
        return wrap(frame)
    }

    func wrap(_ frame: AVAudioFramePosition) -> AVAudioFramePosition {
        if frame < end { return max(0, frame) }
        return start + (frame - start) % (end - start)
    }
}

struct NativeHomeMusicAsset {
    let url: URL
    let file: AVAudioFile
    let loop: AVAudioPCMBuffer
    let range: NativeHomeMusicRange

    static func load(url: URL, loopStart: Double, loopEnd: Double) throws -> Self {
        let file = try AVAudioFile(forReading: url)
        let range = try NativeHomeMusicRange(sampleRate: file.processingFormat.sampleRate,
                                            length: file.length, start: loopStart, end: loopEnd)
        let frames = range.end - range.start
        guard frames > 0, frames <= AVAudioFramePosition(UInt32.max),
              let loop = AVAudioPCMBuffer(pcmFormat: file.processingFormat,
                                         frameCapacity: AVAudioFrameCount(frames)) else {
            throw NSError(domain: "NativeHomeMusic", code: 2,
                          userInfo: [NSLocalizedDescriptionKey: "Cannot allocate music loop"])
        }
        file.framePosition = range.start
        try file.read(into: loop, frameCount: AVAudioFrameCount(frames))
        guard loop.frameLength == AVAudioFrameCount(frames) else {
            throw NSError(domain: "NativeHomeMusic", code: 3,
                          userInfo: [NSLocalizedDescriptionKey: "Incomplete music loop"])
        }
        return Self(url: url, file: file, loop: loop, range: range)
    }
}

/// The same class is exercised in macOS offline-rendering tests.
final class NativeHomeMusicEngine {
    let engine = AVAudioEngine()
    let player = AVAudioPlayerNode()
    private let master = AVAudioMixerNode()
    private let duck = AVAudioMixerNode()
    private(set) var asset: NativeHomeMusicAsset?
    private(set) var isPlaying = false
    private var offset: AVAudioFramePosition = 0
    private var startedAt = 0.0
    private var levels: [String: Float] = ["track": 0, "master": 0.6, "duck": 1]
    private var ramps: [String: DispatchSourceTimer] = [:]

    init() {
        engine.attach(player)
        engine.attach(master)
        engine.attach(duck)
        applyLevels()
    }

    func prepare(_ value: NativeHomeMusicAsset) {
        pause()
        asset = value
        offset = 0
        engine.connect(player, to: master, format: value.file.processingFormat)
        engine.connect(master, to: duck, format: value.file.processingFormat)
        engine.connect(duck, to: engine.mainMixerNode, format: value.file.processingFormat)
        applyLevels()
    }

    func seek(_ seconds: Double) {
        guard let asset else { return }
        pause()
        offset = asset.range.frame(at: seconds)
    }

    func releaseAsset() {
        guard !isPlaying else { return }
        asset = nil
        engine.stop()
    }

    func level(_ name: String) -> Float { levels[name] ?? 0 }

    var position: Double {
        guard let asset else { return 0 }
        var frame = offset
        if isPlaying {
            if let time = player.lastRenderTime, let played = player.playerTime(forNodeTime: time),
               played.isSampleTimeValid, played.sampleTime >= 0, played.sampleRate > 0 {
                frame += AVAudioFramePosition((Double(played.sampleTime) / played.sampleRate * asset.range.sampleRate).rounded())
            } else {
                // Used only before the first render quantum / during a route reset.
                frame += AVAudioFramePosition((max(0, ProcessInfo.processInfo.systemUptime - startedAt) * asset.range.sampleRate).rounded())
            }
        }
        return Double(asset.range.wrap(frame)) / asset.range.sampleRate
    }

    func play(position: Double? = nil, at hostTime: UInt64? = nil) throws {
        guard let asset else {
            throw NSError(domain: "NativeHomeMusic", code: 4,
                          userInfo: [NSLocalizedDescriptionKey: "Music is not prepared"])
        }
        if isPlaying && position == nil { return }
        let start = position.map { asset.range.frame(at: $0) } ?? offset
        player.stop()
        offset = asset.range.wrap(start)
        // Queue the initial tail and the repeating PCM body in advance. There
        // is no JavaScript timer or completion callback at the repeat boundary.
        player.scheduleSegment(asset.file, startingFrame: offset,
                               frameCount: AVAudioFrameCount(asset.range.end - offset),
                               at: nil, completionHandler: nil)
        player.scheduleBuffer(asset.loop, at: nil, options: .loops, completionHandler: nil)
        engine.prepare()
        if !engine.isRunning { try engine.start() }
        startedAt = hostTime.map { AVAudioTime.seconds(forHostTime: $0) } ?? ProcessInfo.processInfo.systemUptime
        if let hostTime { player.play(at: AVAudioTime(hostTime: hostTime)) }
        else { player.play() }
        isPlaying = true
    }

    func pause() {
        if isPlaying, let asset { offset = asset.range.frame(at: position) }
        isPlaying = false
        player.stop()
        engine.pause()
    }

    func setLevel(_ name: String, value: Float, milliseconds: Double = 0, delay: Double = 0) {
        guard levels[name] != nil else { return }
        ramps.removeValue(forKey: name)?.cancel()
        let target = min(1, max(0, value.isFinite ? value : 0))
        let duration = max(0, min(10, milliseconds / 1000))
        let from = levels[name]!
        guard (duration > 0 || delay > 0), abs(from - target) > 0.00001 else {
            levels[name] = target
            applyLevels()
            return
        }
        let began = ProcessInfo.processInfo.systemUptime + max(0, delay)
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now(), repeating: .milliseconds(8))
        timer.setEventHandler { [weak self] in
            guard let self else { return }
            let elapsed = ProcessInfo.processInfo.systemUptime - began
            guard elapsed >= 0 else { return }
            let progress = duration > 0 ? min(1, elapsed / duration) : 1
            self.levels[name] = from + (target - from) * Float(progress)
            self.applyLevels()
            if progress >= 1 { self.ramps.removeValue(forKey: name)?.cancel() }
        }
        ramps[name] = timer
        timer.resume()
    }

    private func applyLevels() {
        player.volume = levels["track"]!
        master.outputVolume = levels["master"]!
        duck.outputVolume = levels["duck"]!
    }

    deinit {
        for timer in ramps.values { timer.cancel() }
        player.stop()
        engine.stop()
    }
}
