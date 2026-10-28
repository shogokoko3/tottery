import UIKit
import Capacitor
import AVFAudio

final class GameBridgeViewController: CAPBridgeViewController {
    private let gameAudio = NativeHomeMusicPlugin()
    override func capacitorDidLoad() { bridge?.registerPluginInstance(gameAudio) }
    func suspendNativeGameAudio() { gameAudio.suspendForLifecycle() }
    func resumeNativeGameAudio() { gameAudio.resumeForLifecycle() }
}

// The original plugin name stays stable; it now owns every game music/SE voice.
@objc(NativeHomeMusicPlugin)
public final class NativeHomeMusicPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeHomeMusicPlugin"
    public let jsName = "NativeHomeMusic"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "state", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMix", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "release", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "transition", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepareEffect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playEffect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopEffect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setEffectsVolume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resumeAudio", returnType: CAPPluginReturnPromise)
    ]
    private final class Music {
        let engine = NativeHomeMusicEngine()
        var revision = 0
        var position = 0.0
        var desiredGain: Float = 0
        var releaseWhenStopped = false
    }
    private struct Transition {
        let from: String
        let to: String
        let fromGain: Float
        let stop: DispatchWorkItem
    }
    private var music: [String: Music] = [:]
    private var wanted: String?
    private var lifecycle = NativeGameAudioLifecycle()
    private var transitionWork: Transition?
    private let effects = NativeEffectsEngine()
    private var effectAssets: [String: NativeEffectAsset] = [:]
    private var effectOrder: [String] = []
    private let reads: OperationQueue = {
        let value = OperationQueue()
        value.maxConcurrentOperationCount = 2
        value.qualityOfService = .userInitiated
        return value
    }()

    public override func load() {
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(inactive), name: UIApplication.willResignActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(inactive), name: UIApplication.didEnterBackgroundNotification, object: nil)
        center.addObserver(self, selector: #selector(active), name: UIApplication.didBecomeActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(interrupted(_:)), name: AVAudioSession.interruptionNotification, object: nil)
        center.addObserver(self, selector: #selector(configurationChanged(_:)), name: .AVAudioEngineConfigurationChange, object: nil)
        effects.onEnded = { [weak self] token in self?.notifyListeners("effectEnded", data: ["token": token]) }
    }

    @objc private func inactive() {
        if Thread.isMainThread { suspendForLifecycle() }
        else { DispatchQueue.main.async { self.suspendForLifecycle() } }
    }
    @objc private func active() {
        DispatchQueue.main.async { self.resumeForLifecycle() }
    }
    func suspendForLifecycle() {
        lifecycle.background()
        cancelTransition(restore: false)
        for value in music.values { pause(value) }
        effects.stopAll()
    }
    func resumeForLifecycle() {
        guard UIApplication.shared.applicationState == .active else { return }
        lifecycle.foreground()
        resumeWanted()
    }
    private func resumeWanted() {
        guard lifecycle.canPlay, UIApplication.shared.applicationState == .active,
              let id = wanted, let value = music[id], value.engine.asset != nil,
              !value.engine.isPlaying else { return }
        do {
            try activateSession()
            value.engine.setLevel("track", value: 0)
            try value.engine.play()
            value.engine.setLevel("track", value: value.desiredGain, milliseconds: 350)
        } catch { notifyListeners("nativeAudioState", data: ["status": "resume-failed"]) }
    }
    @objc private func interrupted(_ event: Notification) {
        let type = event.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
        let options = event.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
        DispatchQueue.main.async {
            if type == AVAudioSession.InterruptionType.began.rawValue {
                self.lifecycle.interruptionBegan()
                self.cancelTransition(restore: false)
                for value in self.music.values { self.pause(value) }
                self.effects.stopAll()
            } else if type == AVAudioSession.InterruptionType.ended.rawValue {
                self.lifecycle.interruptionEnded(shouldResume: AVAudioSession.InterruptionOptions(rawValue: options).contains(.shouldResume))
                self.resumeWanted()
            }
        }
    }
    @objc private func configurationChanged(_ event: Notification) {
        DispatchQueue.main.async {
            if event.object as? AVAudioEngine === self.effects.engine { self.effects.stopAll(); return }
            guard let value = self.music.values.first(where: { event.object as? AVAudioEngine === $0.engine.engine }) else { return }
            // A stopped engine may still have a player timeline. Save it before
            // clearing the schedules, then resume only the currently wanted song.
            self.pause(value)
            self.resumeWanted()
        }
    }
    private func activateSession() throws {
        let session = AVAudioSession.sharedInstance()
        if session.category != .ambient || session.mode != .default { try session.setCategory(.ambient, mode: .default) }
        try session.setActive(true)
    }
    private func id(_ call: CAPPluginCall) -> String { call.getString("id") ?? "homeDefault" }
    private func value(_ id: String) -> Music {
        if let value = music[id] { return value }
        let value = Music()
        music[id] = value
        return value
    }
    private func state(_ id: String) -> [String: Any] {
        guard let value = music[id] else { return ["position": 0, "paused": true] }
        return ["position": value.engine.asset != nil ? value.engine.position : value.position,
                "paused": !value.engine.isPlaying]
    }
    private func pause(_ value: Music) {
        if value.engine.asset != nil { value.position = value.engine.position }
        value.engine.pause()
        if value.releaseWhenStopped { value.engine.releaseAsset() }
    }
    private func cancelTransition(restore: Bool) {
        guard let transition = transitionWork else { return }
        transitionWork = nil
        transition.stop.cancel()
        if restore, let outgoing = music[transition.from] {
            outgoing.desiredGain = transition.fromGain
            outgoing.engine.setLevel("track", value: transition.fromGain, milliseconds: 100)
            wanted = transition.from
        }
    }
    private func bundledURL(_ relative: String) -> URL? {
        guard let root = Bundle.main.resourceURL?.appendingPathComponent("public"),
              !relative.contains(".."), !relative.contains("\\"), !relative.hasPrefix("/") else { return nil }
        let parts = relative.split(separator: "/")
        let audio = parts.count == 2 && parts[0] == "audio" && (relative.hasSuffix(".m4a") || relative.hasSuffix(".wav"))
        let movie = parts.count >= 3 && parts[0] == "skins" && relative.hasSuffix(".mp4")
        guard let last = parts.last, last.count <= 180, audio || movie else { return nil }
        let url = root.appendingPathComponent(relative)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    @objc func prepare(_ call: CAPPluginCall) {
        let id = id(call)
        let allowed = ["homeDefault", "title", "homePhase2", "homePhase3", "waiting", "setup", "battle", "endgame", "tutorial", "puzzle", "story", "collection", "shop", "summon", "rewards", "ranking", "resultWin", "resultLose", "resultDraw"]
        guard let name = call.getString("file"), name == (name as NSString).lastPathComponent,
              allowed.contains(String(name.split(separator: ".").first ?? "")),
              let url = bundledURL("audio/" + name), let start = call.getDouble("loopStart"), let end = call.getDouble("loopEnd"),
              id.count <= 32 else { call.reject("Invalid bundled music"); return }
        DispatchQueue.main.async {
            let value = self.value(id)
            value.releaseWhenStopped = false
            if value.engine.asset?.url == url { call.resolve(self.state(id)); return }
            value.revision += 1
            let revision = value.revision
            self.reads.addOperation {
                do {
                    let asset = try NativeHomeMusicAsset.load(url: url, loopStart: start, loopEnd: end)
                    DispatchQueue.main.async {
                        guard revision == value.revision else { call.reject("Music preparation cancelled"); return }
                        value.engine.prepare(asset)
                        value.engine.seek(value.position)
                        call.resolve(self.state(id))
                    }
                } catch { DispatchQueue.main.async { call.reject(error.localizedDescription) } }
            }
        }
    }
    @objc func play(_ call: CAPPluginCall) {
        let id = id(call)
        DispatchQueue.main.async {
            do {
                guard self.lifecycle.canPlay, UIApplication.shared.applicationState == .active else { throw NSError(domain: "NativeGameAudio", code: 5) }
                let value = self.value(id)
                value.releaseWhenStopped = false
                try self.activateSession()
                try value.engine.play(position: call.getDouble("position"))
                self.wanted = id
                call.resolve(self.state(id))
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func pause(_ call: CAPPluginCall) {
        let id = id(call)
        let keepingIntent = call.getBool("keepIntent") ?? false
        DispatchQueue.main.async {
            guard self.lifecycle.acceptsPause(keepingIntent: keepingIntent) else { call.resolve(self.state(id)); return }
            if self.transitionWork?.to == id { self.cancelTransition(restore: !keepingIntent) }
            if !keepingIntent, self.wanted == id { self.wanted = nil }
            if let value = self.music[id] { self.pause(value) }
            call.resolve(self.state(id))
        }
    }
    @objc func state(_ call: CAPPluginCall) { DispatchQueue.main.async { call.resolve(self.state(self.id(call))) } }
    @objc func setMix(_ call: CAPPluginCall) {
        let id = id(call)
        DispatchQueue.main.async {
            let value = self.value(id)
            let duration = call.getDouble("durationMs") ?? 0
            for key in ["track", "master", "duck"] {
                if let level = call.getDouble(key) {
                    if key == "track" { value.desiredGain = Float(level) }
                    value.engine.setLevel(key, value: Float(level), milliseconds: duration)
                }
            }
            call.resolve(self.state(id))
        }
    }
    @objc func release(_ call: CAPPluginCall) {
        let id = id(call)
        DispatchQueue.main.async {
            if let value = self.music[id], self.wanted != id {
                value.releaseWhenStopped = true
                if !value.engine.isPlaying { self.pause(value) }
            }
            call.resolve(self.state(id))
        }
    }
    @objc func transition(_ call: CAPPluginCall) {
        guard let from = call.getString("from"), let to = call.getString("to") else { call.reject("Invalid transition"); return }
        DispatchQueue.main.async {
            do {
                guard self.lifecycle.canPlay, UIApplication.shared.applicationState == .active,
                      let outgoing = self.music[from], let target = self.music[to],
                      let asset = outgoing.engine.asset, target.engine.asset != nil else { throw NSError(domain: "NativeGameAudio", code: 6) }
                self.cancelTransition(restore: false)
                let position = outgoing.engine.position
                let loopStart = Double(asset.range.start) / asset.range.sampleRate
                let loopEnd = Double(asset.range.end) / asset.range.sampleRate
                let exits = call.getArray("exits", [String: Any].self) ?? []
                let options = exits.compactMap { cue -> (Double, Double)? in
                    guard let at = cue["at"] as? Double, let fit = cue["fit"] as? Double,
                          at >= loopStart || (position < loopStart && at >= position + 0.1) else { return nil }
                    var delay = at - position
                    if delay < 0.1 { delay += loopEnd - loopStart }
                    guard delay >= 0.1, delay <= 2.8 else { return nil }
                    return (delay, fit - 0.13 * delay)
                }.sorted { $0.1 > $1.1 }
                let beat = call.getDouble("beatSeconds") ?? 0.7
                let delay = options.first?.0 ?? max(0.12, min(beat, 1))
                let fade = min(1200, max(650, beat * 1000))
                let gain = Float(call.getDouble("gain") ?? 0.65)
                let fromGain = outgoing.desiredGain
                target.releaseWhenStopped = false
                target.engine.setLevel("track", value: 0)
                try self.activateSession()
                let host = mach_absolute_time() + AVAudioTime.hostTime(forSeconds: delay)
                try target.engine.play(position: 0, at: host)
                target.desiredGain = gain
                target.engine.setLevel("track", value: gain, milliseconds: fade, delay: delay)
                outgoing.engine.setLevel("track", value: 0, milliseconds: fade, delay: delay)
                self.wanted = to
                let stop = DispatchWorkItem { [weak self, weak outgoing] in
                    guard let self, let outgoing, self.transitionWork?.to == to else { return }
                    self.pause(outgoing)
                    self.transitionWork = nil
                }
                self.transitionWork = Transition(from: from, to: to, fromGain: fromGain, stop: stop)
                DispatchQueue.main.asyncAfter(deadline: .now() + delay + fade / 1000 + 0.08, execute: stop)
                call.resolve(["delay": delay, "fadeMs": fade, "position": 0, "paused": false])
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func prepareEffect(_ call: CAPPluginCall) {
        guard let file = call.getString("file"), let key = call.getString("key"), key.count <= 220,
              let url = bundledURL(file) else { call.reject("Invalid bundled effect"); return }
        DispatchQueue.main.async {
            if let asset = self.effectAssets[key] { call.resolve(["duration": asset.duration, "cueGain": asset.cueGain]); return }
            self.reads.addOperation {
                do {
                    let asset = try NativeEffectAsset.load(url: url)
                    DispatchQueue.main.async {
                        self.effectAssets[key] = asset
                        self.effectOrder.removeAll { $0 == key }
                        self.effectOrder.append(key)
                        for prefix in ["bloom-", "movie:"] {
                            var keys = self.effectOrder.filter { $0.hasPrefix(prefix) }
                            let limit = prefix == "movie:" ? 2 : 24
                            while keys.count > limit {
                                let old = keys.removeFirst()
                                self.effectAssets.removeValue(forKey: old)
                                self.effectOrder.removeAll { $0 == old }
                            }
                        }
                        call.resolve(["duration": asset.duration, "cueGain": asset.cueGain])
                    }
                } catch { DispatchQueue.main.async { call.reject(error.localizedDescription) } }
            }
        }
    }
    @objc func playEffect(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let token = call.getString("token") else { call.reject("Invalid effect"); return }
        DispatchQueue.main.async {
            do {
                guard self.lifecycle.canPlay, UIApplication.shared.applicationState == .active,
                      let asset = self.effectAssets[key] else { call.resolve(["played": false]); return }
                if let deadline = call.getDouble("deadline"), Date().timeIntervalSince1970 * 1000 > deadline { call.resolve(["played": false]); return }
                try self.activateSession()
                let played = try self.effects.play(asset: asset, token: token,
                    gain: Float(call.getDouble("gain") ?? 0.7), rate: Float(call.getDouble("rate") ?? 1),
                    priority: call.getInt("priority") ?? 0, ui: call.getBool("ui") ?? false,
                    movie: call.getBool("movie") ?? false, offset: call.getDouble("offset") ?? 0)
                call.resolve(["played": played, "duration": asset.duration])
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func stopEffect(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let token = call.getString("token") { self.effects.stop(token: token) }
            else { self.effects.stopAll() }
            call.resolve()
        }
    }
    @objc func setEffectsVolume(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let level = Float(call.getDouble("volume") ?? 0)
            self.effects.setVolume(level)
            if level <= 0 { self.effects.stopAll() }
            call.resolve()
        }
    }
    @objc func resumeAudio(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if call.getBool("gesture") == true { self.lifecycle.gesture() }
            self.resumeForLifecycle()
            call.resolve()
        }
    }
    deinit { NotificationCenter.default.removeObserver(self) }
}
