import Foundation
import AVFAudio

func require(_ value: Bool, _ message: String) {
    if !value { fatalError(message) }
}
let root = URL(fileURLWithPath: CommandLine.arguments[1])
let source = root.appendingPathComponent("assets/audio/homeDefault.m4a")
let asset = try NativeHomeMusicAsset.load(url: source, loopStart: 4.12, loopEnd: 96.03401360544218)
let rate = asset.range.sampleRate
let format = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 2)!
let end = asset.range.end
let start = asset.range.start
require(asset.range.frame(at: .infinity) == 0, "Invalid seek must not crash")
require(asset.range.frame(at: Double.greatestFiniteMagnitude) < end, "Large seek must wrap safely")
require(asset.range.wrap(end) == start, "Authored return frame")

func readFrames(_ first: AVAudioFramePosition, _ length: AVAudioFrameCount) throws -> [[Float]] {
    let file = try AVAudioFile(forReading: source)
    file.framePosition = first
    let pcm = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: length)!
    try file.read(into: pcm, frameCount: length)
    require(pcm.frameLength == length, "Complete reference frame range")
    return (0..<2).map { Array(UnsafeBufferPointer(start: pcm.floatChannelData![$0], count: Int(length))) }
}

func render(_ music: NativeHomeMusicEngine, count: AVAudioFrameCount) throws -> [[Float]] {
    var result = [[Float](),[Float]()]
    var remaining = count
    var attempts = 0
    let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 2048)!
    while remaining > 0 {
        attempts += 1
        require(attempts < 20000, "Native render must make progress")
        let n = min(2048,remaining)
        let status = try music.engine.renderOffline(n, to: buffer)
        switch status {
        case .success:
            for c in 0..<2 { result[c].append(contentsOf: UnsafeBufferPointer(start: buffer.floatChannelData![c], count: Int(buffer.frameLength))) }
            remaining -= buffer.frameLength
        case .insufficientDataFromInputNode, .cannotDoInCurrentContext:
            Thread.sleep(forTimeInterval: 0.001)
        case .error: fatalError("Native offline render failed")
        @unknown default: fatalError("Unknown native render state")
        }
    }
    return result
}

func configured() throws -> NativeHomeMusicEngine {
    let music = NativeHomeMusicEngine()
    music.prepare(asset)
    music.setLevel("track",value:1)
    music.setLevel("master",value:1)
    music.setLevel("duck",value:1)
    try music.engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 2048)
    return music
}

func compare(_ actual: [[Float]], _ expected: [[Float]], _ label: String, gain: Float = 1) -> Double {
    var maxError = 0.0
    for c in 0..<2 {
        require(actual[c].count == expected[c].count, "\(label) frame count")
        for i in actual[c].indices { maxError = max(maxError, abs(Double(actual[c][i] - expected[c][i] * gain))) }
    }
    require(maxError < 0.0001, "\(label) differs from source: \(maxError)")
    print("\(label): \(actual[0].count) frames, max error \(maxError)")
    return maxError
}

let music = try configured()
try music.play(position: 50)
let frames = AVAudioFrameCount(21 * rate)
let output = try render(music,count:frames)
let original = try readFrames(AVAudioFramePosition(50*rate),frames)
let fullError = compare(output,original,"Native 50–71 seconds including reported 56/64 second passages")
let pausedAt = music.position
music.pause()
let retained = music.position
music.pause()
require(abs(retained-music.position)<1/rate, "Duplicate pause retains native position")
require(abs(pausedAt-retained)<1/rate, "Pause retains render-clock position")
try music.play()
require(abs(music.position-retained)<0.05, "Immediate resume state must retain the previous position")
let resumed = try render(music,count:AVAudioFrameCount(rate))
_ = compare(resumed,try readFrames(asset.range.frame(at:retained),AVAudioFrameCount(rate)),"Resume from native position")
music.pause()

let looping = try configured()
try looping.play(position: Double(end)/rate-1)
let looped = try render(looping,count:AVAudioFrameCount(3*rate))
let tail = try readFrames(end-AVAudioFramePosition(rate),AVAudioFrameCount(rate))
let body = try readFrames(start,AVAudioFrameCount(2*rate))
let expectedLoop = (0..<2).map { tail[$0]+body[$0] }
let loopError = compare(looped,expectedLoop,"Native sample-clock loop return")
looping.pause()

let quiet = try configured()
quiet.setLevel("track",value:0.75)
quiet.setLevel("master",value:0.6)
quiet.setLevel("duck",value:0.35)
try quiet.play(position:56)
let lowered = try render(quiet,count:AVAudioFrameCount(rate))
let mixError = compare(lowered,try readFrames(AVAudioFramePosition(56*rate),AVAudioFrameCount(rate)),"Independent track/master/duck levels",gain:0.75*0.6*0.35)
quiet.pause()
let result:[String:Any] = ["sampleRate":rate,"reportedPassageMaximumError":fullError,"loopMaximumError":loopError,"mixMaximumError":mixError,"pauseResumePassed":true,"deviceListeningVerified":false]
let data = try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys])
try data.write(to:root.appendingPathComponent("reports/native-home-bgm-20261028/native-render.json"))
print("Native home BGM render PASS")
