import UIKit
import Capacitor
import AVFAudio

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var mediaStateRevision = 0

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()
        NotificationCenter.default.addObserver(self,
            selector: #selector(audioInterruption(_:)),
            name: AVAudioSession.interruptionNotification, object: nil)

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    // Notify Web Audio even when a phone/Siri interruption never hides the page.
    private func audioState(_ status: String) {
        let controller = window?.rootViewController as? CAPBridgeViewController
        controller?.bridge?.triggerJSEvent(eventName: "tottery-audio-state",
            target: "window", data: "{\"status\":\"\(status)\"}")
    }

    @objc private func audioInterruption(_ notification: Notification) {
        guard let value = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: value) else { return }
        let options = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
        DispatchQueue.main.async { [weak self] in
            if type == .began {
                self?.audioState("interrupted")
            } else if type == .ended {
                let canResume = AVAudioSession.InterruptionOptions(rawValue: options).contains(.shouldResume)
                self?.audioState(canResume ? "ended" : "manual")
            }
        }
    }

    private func suspendGameMedia() {
        mediaStateRevision += 1
        audioState("inactive")
        // Native suspension also covers transitions where web visibility arrives late.
        let controller = window?.rootViewController as? CAPBridgeViewController
        controller?.webView?.setAllMediaPlaybackSuspended(true, completionHandler: nil)
    }

    func sceneWillResignActive(_ scene: UIScene) { suspendGameMedia() }
    func sceneDidEnterBackground(_ scene: UIScene) { suspendGameMedia() }
    func sceneDidBecomeActive(_ scene: UIScene) {
        mediaStateRevision += 1
        let revision = mediaStateRevision
        guard let webView = (window?.rootViewController as? CAPBridgeViewController)?.webView else {
            audioState("active")
            return
        }
        webView.setAllMediaPlaybackSuspended(false) { [weak self, weak scene] in
            guard let self = self, self.mediaStateRevision == revision,
                  scene?.activationState == .foregroundActive else { return }
            self.audioState("active")
        }
    }

    deinit { NotificationCenter.default.removeObserver(self) }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
