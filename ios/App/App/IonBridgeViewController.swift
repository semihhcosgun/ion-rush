import Capacitor

class IonBridgeViewController: CAPBridgeViewController {
    override var prefersStatusBarHidden: Bool { true }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(IonThermalPlugin())
        bridge?.registerPluginInstance(IonMusicAudioPlugin())
        bridge?.registerPluginInstance(IonTelemetryPlugin())
        bridge?.registerPluginInstance(IonRemindersPlugin())
        bridge?.registerPluginInstance(IonBillingPlugin())
        bridge?.registerPluginInstance(IonRewardedAdsPlugin())
    }
}
