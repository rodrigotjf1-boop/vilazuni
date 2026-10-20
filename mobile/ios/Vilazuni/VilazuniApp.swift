import SwiftUI
import SafariServices

@main
struct VilazuniApp: App {
    private var origin: URL? {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "VilazuniOrigin") as? String,
              let url = URL(string: raw), url.scheme == "https", url.host != nil,
              url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
              ["", "/"].contains(url.path), url.host != "example.invalid" else { return nil }
        return url
    }
    var body: some Scene {
        WindowGroup {
            if let origin { CondominiumBrowser(url: origin).ignoresSafeArea() }
            else { VStack(spacing: 16) { Text("Vilazuni").font(.largeTitle); Text("O endereço do seu condomínio será configurado na versão de distribuição.").multilineTextAlignment(.center) }.padding() }
        }
    }
}
struct CondominiumBrowser: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> SFSafariViewController {
        let config = SFSafariViewController.Configuration()
        config.entersReaderIfAvailable = false
        return SFSafariViewController(url: url, configuration: config)
    }
    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}
