import Foundation
import Capacitor
import MultipeerConnectivity

/// 近くの端末とのフレンド対戦。MultipeerConnectivity(Bluetooth / 近距離 Wi‑Fi)で 1 対 1 につなぐ。
/// 両端末が同時に名乗り(advertise)と探索(browse)をし、どちらかが invite すると接続する。
/// 招待した側が initiator=true(ゲスト)、された側が initiator=false(ホスト)。
@objc(NearbyPlugin)
public class NearbyPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NearbyPlugin"
    public let jsName = "Nearby"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "invite", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "peers", returnType: CAPPluginReturnPromise)
    ]

    // Bonjour の型名。15 文字以内・小文字英数字とハイフン。Info.plist の NSBonjourServices と一致させる
    private let serviceType = "tottery-near"
    private var myPeer: MCPeerID?
    private var session: MCSession?
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser: MCNearbyServiceBrowser?
    private var found: [String: MCPeerID] = [:]
    private var names: [String: String] = [:]
    private var connectedPeer: MCPeerID?
    private var invitedByMe = false
    private let queue = DispatchQueue(label: "tottery.nearby")

    @objc func start(_ call: CAPPluginCall) {
        let name = call.getString("name") ?? "名無し"
        queue.async {
            self.teardown()
            // displayName は 63 バイトまで。同じ名前の端末が並んでも見分けられるよう短い印を足す
            let tag = String(UUID().uuidString.prefix(4))
            let shown = String(name.utf8.prefix(40)) ?? name
            let display = "\(shown)#\(tag)"
            let peer = MCPeerID(displayName: display)
            self.myPeer = peer
            let session = MCSession(peer: peer, securityIdentity: nil, encryptionPreference: .required)
            session.delegate = self
            self.session = session
            let advertiser = MCNearbyServiceAdvertiser(peer: peer, discoveryInfo: ["n": shown], serviceType: self.serviceType)
            advertiser.delegate = self
            advertiser.startAdvertisingPeer()
            self.advertiser = advertiser
            let browser = MCNearbyServiceBrowser(peer: peer, serviceType: self.serviceType)
            browser.delegate = self
            browser.startBrowsingForPeers()
            self.browser = browser
            self.invitedByMe = false
            self.found = [:]
            self.names = [:]
            call.resolve(["id": display])
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        queue.async {
            self.teardown()
            call.resolve()
        }
    }

    @objc func invite(_ call: CAPPluginCall) {
        guard let id = call.getString("peerId") else {
            call.reject("peerId が要ります")
            return
        }
        queue.async {
            guard let session = self.session, let browser = self.browser, let peer = self.found[id] else {
                call.reject("その端末はもう見つかりません")
                return
            }
            if self.connectedPeer != nil {
                call.reject("すでに接続しています")
                return
            }
            self.invitedByMe = true
            browser.invitePeer(peer, to: session, withContext: nil, timeout: 20)
            call.resolve()
        }
    }

    @objc func send(_ call: CAPPluginCall) {
        guard let text = call.getString("data") else {
            call.reject("data が要ります")
            return
        }
        queue.async {
            guard let session = self.session, let peer = self.connectedPeer, let data = text.data(using: .utf8) else {
                call.reject("接続していません")
                return
            }
            do {
                try session.send(data, toPeers: [peer], with: .reliable)
                call.resolve()
            } catch {
                call.reject("送れませんでした: \(error.localizedDescription)")
            }
        }
    }

    @objc func peers(_ call: CAPPluginCall) {
        queue.async {
            call.resolve(["peers": self.peerList()])
        }
    }

    private func peerList() -> [[String: String]] {
        return found.keys.sorted().map { ["id": $0, "name": names[$0] ?? $0] }
    }

    private func notifyPeers() {
        notifyListeners("peers", data: ["peers": peerList()])
    }

    private func teardown() {
        advertiser?.stopAdvertisingPeer()
        advertiser?.delegate = nil
        advertiser = nil
        browser?.stopBrowsingForPeers()
        browser?.delegate = nil
        browser = nil
        session?.disconnect()
        session?.delegate = nil
        session = nil
        connectedPeer = nil
        invitedByMe = false
        found = [:]
        names = [:]
        myPeer = nil
    }

    private func stopDiscovery() {
        advertiser?.stopAdvertisingPeer()
        browser?.stopBrowsingForPeers()
    }
}

extension NearbyPlugin: MCSessionDelegate {
    public func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        queue.async {
            switch state {
            case .connected:
                if self.connectedPeer == nil {
                    self.connectedPeer = peerID
                    // 1 対 1。つながったら名乗りも探索もやめる
                    self.stopDiscovery()
                    let name = self.names[peerID.displayName] ?? peerID.displayName
                    self.notifyListeners("connected", data: [
                        "peerId": peerID.displayName,
                        "name": name,
                        "initiator": self.invitedByMe
                    ])
                }
            case .notConnected:
                if self.connectedPeer == peerID {
                    self.connectedPeer = nil
                    self.notifyListeners("disconnected", data: ["peerId": peerID.displayName])
                } else if self.invitedByMe && self.connectedPeer == nil {
                    // 招待が断られた・届かなかった
                    self.invitedByMe = false
                    self.notifyListeners("disconnected", data: ["peerId": peerID.displayName, "invite": true])
                }
            default:
                break
            }
        }
    }

    public func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        guard let text = String(data: data, encoding: .utf8) else { return }
        notifyListeners("message", data: ["data": text, "peerId": peerID.displayName])
    }

    public func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}
    public func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {}
    public func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}
}

extension NearbyPlugin: MCNearbyServiceAdvertiserDelegate {
    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        queue.async {
            // この画面を開いている＝対戦する気があるので、まだ誰ともつながっていなければ受ける
            guard let session = self.session, self.connectedPeer == nil else {
                invitationHandler(false, nil)
                return
            }
            self.invitedByMe = false
            invitationHandler(true, session)
        }
    }

    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
        notifyListeners("error", data: ["message": "名乗りを始められませんでした: \(error.localizedDescription)"])
    }
}

extension NearbyPlugin: MCNearbyServiceBrowserDelegate {
    public func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        queue.async {
            self.found[peerID.displayName] = peerID
            self.names[peerID.displayName] = info?["n"] ?? peerID.displayName
            self.notifyPeers()
        }
    }

    public func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        queue.async {
            self.found.removeValue(forKey: peerID.displayName)
            self.names.removeValue(forKey: peerID.displayName)
            self.notifyPeers()
        }
    }

    public func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
        notifyListeners("error", data: ["message": "探索を始められませんでした: \(error.localizedDescription)"])
    }
}
