import AppIntents
import UIKit

private let scheme = "com.rahimrady.myshytext"

@available(iOS 16.0, *)
struct CheckInNearbyIntent: AppIntent {
    static var title: LocalizedStringResource = "Shy In nearby"
    static var description = IntentDescription("Shy In at the closest place around you.")
    static var openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        await openShyText(queryItems: [URLQueryItem(name: "closest", value: "1")])
        return .result()
    }
}

@available(iOS 16.0, *)
struct CheckInAtVenueIntent: AppIntent {
    static var title: LocalizedStringResource = "Shy In at a venue"
    static var description = IntentDescription("Shy In at a named place around you.")
    static var openAppWhenRun = true

    @Parameter(title: "Venue")
    var venue: String

    static var parameterSummary: some ParameterSummary {
        Summary("Shy In at \(\.$venue)")
    }

    func perform() async throws -> some IntentResult {
        await openShyText(queryItems: [URLQueryItem(name: "name", value: venue)])
        return .result()
    }
}

@available(iOS 16.0, *)
struct ShyTextShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: CheckInNearbyIntent(),
            phrases: [
                "Shy In nearby in \(.applicationName)",
                "Shy In with \(.applicationName)",
                "I'm here in \(.applicationName)"
            ],
            shortTitle: "Shy In nearby",
            systemImageName: "mappin.and.ellipse"
        )
        AppShortcut(
            intent: CheckInAtVenueIntent(),
            phrases: [
                "Shy In at \(\.$venue) in \(.applicationName)",
                "I'm at \(\.$venue) in \(.applicationName)"
            ],
            shortTitle: "Shy In at a place",
            systemImageName: "mappin"
        )
    }
}

@available(iOS 16.0, *)
@MainActor
private func openShyText(queryItems: [URLQueryItem]) async {
    var components = URLComponents()
    components.scheme = scheme
    components.host = "shytext"
    components.path = "/create"
    components.queryItems = queryItems
    guard let url = components.url else { return }
    await withCheckedContinuation { continuation in
        UIApplication.shared.open(url, options: [:]) { _ in
            continuation.resume()
        }
    }
}
