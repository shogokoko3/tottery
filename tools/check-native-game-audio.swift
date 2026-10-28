import Foundation
import AVFoundation

func require(_ value: Bool, _ message: String) { if !value { fatalError(message) } }
let root = URL(fileURLWithPath: CommandLine.arguments[1])
let manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[2]))) as! [String: Any]
var lifecycle = NativeGameAudioLifecycle()
for _ in 0..<100 {
    lifecycle.background(); lifecycle.background()
    require(!lifecycle.canPlay, "Background must be silent")
    require(lifecycle.acceptsPause(keepingIntent: true), "Background pause retains intent")
    lifecycle.foreground()
    require(lifecycle.canPlay, "Foreground can resume without a web event")
    require(!lifecycle.acceptsPause(keepingIntent: true), "Late JS pause cannot stop resumed audio")
    require(lifecycle.acceptsPause(keepingIntent: false), "Explicit stop still wins")
}
lifecycle.interruptionBegan(); lifecycle.foreground()
require(!lifecycle.canPlay, "Active app cannot override an ongoing call")
lifecycle.interruptionEnded(shouldResume: true)
require(lifecycle.canPlay, "Resume permitted after a call")
lifecycle.interruptionBegan(); lifecycle.interruptionEnded(shouldResume: false)
require(!lifecycle.canPlay, "Manual interruption requires a gesture")
lifecycle.gesture(); require(lifecycle.canPlay, "Gesture restores permitted playback")
lifecycle.interruptionBegan(isSuspension: true)
require(lifecycle.canPlay, "A delayed OS suspension has no ended event and must not block foreground playback")
lifecycle.interruptionBegan()
lifecycle.interruptionBegan(isSuspension: true)
require(!lifecycle.canPlay, "Delayed suspension cannot override a genuine ongoing call")
lifecycle.interruptionEnded(shouldResume: false)
lifecycle.interruptionBegan(isSuspension: true)
require(!lifecycle.canPlay, "Suspension does not remove the requirement for a post-call gesture")
lifecycle.gesture()
print("Native lifecycle: 100 background/foreground cycles, missing web events, late pause, call and gesture PASS")

func render(_ engine: AVAudioEngine, format: AVAudioFormat, frames: UInt32) throws -> [[Float]] {
    let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 2048)!
    var output = Array(repeating: [Float](), count: Int(format.channelCount))
    var left = frames, attempts = 0
    while left > 0 {
        attempts += 1; require(attempts < 10000, "Offline renderer must progress")
        switch try engine.renderOffline(min(2048, left), to: buffer) {
        case .success:
            for channel in output.indices { output[channel].append(contentsOf: UnsafeBufferPointer(start: buffer.floatChannelData![channel], count: Int(buffer.frameLength))) }
            left -= buffer.frameLength
        case .cannotDoInCurrentContext, .insufficientDataFromInputNode: continue
        case .error: fatalError("Offline rendering failed")
        @unknown default: fatalError("Unknown render status")
        }
    }
    return output
}
func read(_ url: URL, first: Int64, frames: UInt32) throws -> [[Float]] {
    let file = try AVAudioFile(forReading: url)
    file.framePosition = first
    let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: frames)!
    try file.read(into: buffer, frameCount: frames)
    require(buffer.frameLength == frames, "Reference frames available")
    return (0..<Int(file.processingFormat.channelCount)).map { Array(UnsafeBufferPointer(start: buffer.floatChannelData![$0],count:Int(frames))) }
}
var maximumMusicError = 0.0
func musicCheck(_ track: [String: Any]) throws {
    let url = root.appendingPathComponent("assets/audio/" + (track["file"] as! String))
    let asset = try NativeHomeMusicAsset.load(url: url, loopStart: track["loopStart"] as! Double, loopEnd: track["loopEnd"] as! Double)
    let music = NativeHomeMusicEngine()
    music.prepare(asset)
    for key in ["track", "master", "duck"] { music.setLevel(key,value:1) }
    let format = asset.file.processingFormat
    try music.engine.enableManualRenderingMode(.offline,format:format,maximumFrameCount:2048)
    // Cross the actual authored loop return; intro is never repeated.
    let first = asset.range.end - 4096
    try music.play(position: Double(first) / asset.range.sampleRate)
    let actual = try render(music.engine,format:format,frames:8192)
    let tail = try read(url,first:first,frames:4096)
    let body = try read(url,first:asset.range.start,frames:4096)
    for channel in actual.indices {
        let expected = tail[channel] + body[channel]
        for frame in expected.indices { maximumMusicError = max(maximumMusicError,abs(Double(expected[frame]-actual[channel][frame]))) }
    }
    require(maximumMusicError < 0.0001, "Music differs from original")
    let position = music.position; music.pause(); music.pause()
    require(abs(position-music.position) < 1/asset.range.sampleRate, "Native duplicate pause retains position")
    music.releaseAsset();require(music.asset == nil,"Inactive loop memory is released")
}
let tracks = manifest["tracks"] as! [[String: Any]]
for track in tracks { try musicCheck(track) }
print("All \(tracks.count) native BGM loop returns match original PCM; maximum error \(maximumMusicError)")
let files = manifest["effects"] as! [String]
for file in files {
    let asset = try NativeEffectAsset.load(url: root.appendingPathComponent("assets/audio/"+file))
    require(asset.duration > 0 && asset.duration <= 30,"Effect duration is bounded")
    require(asset.cueGain.isFinite && asset.cueGain > 0 && asset.cueGain <= 12,"Important cue gain is bounded")
}
print("All \(files.count) file, tonal and synthesized SE decode through the native reader")
let movies = FileManager.default.enumerator(at: root.appendingPathComponent("ios/App/App/public/skins"), includingPropertiesForKeys: nil)
var moviesDecoded = 0, silentMovies = 0
while let url = movies?.nextObject() as? URL {
    guard url.pathExtension == "mp4" else { continue }
    if AVURLAsset(url: url).tracks(withMediaType: .audio).isEmpty { silentMovies += 1; continue }
    let asset = try NativeEffectAsset.load(url: url)
    require(asset.duration > 0, "Bundled movie audio decodes natively")
    moviesDecoded += 1
}
print("Bundled movies: \(moviesDecoded) native audio tracks; \(silentMovies) silent movies")

let format = AVAudioFormat(standardFormatWithSampleRate:44100,channels:2)!
func tone(_ frequency: Double) -> NativeEffectAsset {
    let buffer = AVAudioPCMBuffer(pcmFormat:format,frameCapacity:44100)!
    buffer.frameLength=44100
    for channel in 0..<2 { for frame in 0..<44100 { buffer.floatChannelData![channel][frame] = Float(sin(Double(frame)*frequency*2*Double.pi/44100)*0.1) } }
    return NativeEffectAsset(buffer:buffer,cueGain:1)
}
func effectRMS(_ frequency: Double) throws -> Double {
    let effects=NativeEffectsEngine()
    effects.setVolume(1)
    try effects.engine.enableManualRenderingMode(.offline,format:format,maximumFrameCount:2048)
    require(try effects.play(asset:tone(frequency),token:"tone",gain:1,rate:1,priority:0,ui:false,movie:false,offset:0),"Tone starts")
    let samples=try render(effects.engine,format:format,frames:22050)[0]
    effects.stopAll()
    return sqrt(samples.dropFirst(4096).reduce(0){$0+Double($1*$1)}/Double(samples.count-4096))
}
let low=try effectRMS(500),high=try effectRMS(6000)
require(low>0.01 && high/low<0.3,"Native SE filter suppresses sharp treble without resonance")
let effects=NativeEffectsEngine()
try effects.engine.enableManualRenderingMode(.offline,format:format,maximumFrameCount:2048)
let asset=tone(500)
for index in 0..<8 { require(try effects.play(asset:asset,token:"tap\(index)",gain:0.3,rate:1,priority:0,ui:false,movie:false,offset:0),"Eight bounded effect voices") }
require(try !effects.play(asset:asset,token:"extra",gain:0.3,rate:1,priority:0,ui:false,movie:false,offset:0),"Ninth equal-priority effect is dropped")
require(try effects.play(asset:asset,token:"warning",gain:0.3,rate:1,priority:3,ui:false,movie:false,offset:0),"Time warning replaces a lower-priority cue")
require(try effects.play(asset:asset,token:"result",gain:0.3,rate:1,priority:4,ui:false,movie:false,offset:0),"Result remains audible")
require(effects.voices.filter{$0.token != nil}.count==1,"Result clears less important effects")
require(try effects.play(asset:asset,token:"movie",gain:0.3,rate:2.5,priority:1,ui:false,movie:true,offset:0.1),"Movie audio uses a separate native voice")
require(effects.voices.first{$0.token=="movie"}?.stretch?.pitch==0,"Short movies preserve pitch")
effects.stopAll();require(effects.voices.allSatisfy{$0.token==nil},"Background stops all one-shots")
print("Native effects: soft treble, bounded voices, important cue priority, movie pitch and background stop PASS")
let report:[String:Any] = ["musicCount":tracks.count,"effectCount":files.count,"movieAudioCount":moviesDecoded,"silentMovies":silentMovies,"maximumMusicPCMError":maximumMusicError,"highToLowFrequencyRMS":high/low,"nativeLifecyclePassed":true,"effectsPassed":true,"deviceListeningVerified":false]
try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]).write(to:root.appendingPathComponent("reports/native-game-audio-20261028/native-render.json"))
