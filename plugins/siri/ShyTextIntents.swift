import AppIntents
import UIKit

private let scheme = "com.rahimrady.myshytext"

@available(iOS 16.0, *)
struct CheckInNearbyIntent: AppIntent {
    static var title: LocalizedStringResource = "Shyne nearby"
    static var description = IntentDescription("Shyne at the closest place around you.")
    static var openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        await openShyText(queryItems: [URLQueryItem(name: "closest", value: "1")])
        return .result()
    }
}

@available(iOS 16.0, *)
struct CheckInAtVenueIntent: AppIntent {
    static var title: LocalizedStringResource = "Shyne at a venue"
    static var description = IntentDescription("Shyne at a named place around you.")
    static var openAppWhenRun = true

    @Parameter(
        title: "Venue",
        requestValueDialog: IntentDialog("Which place are you at?")
    )
    var venue: String

    static var parameterSummary: some ParameterSummary {
        Summary("Shyne at a place")
    }

    func perform() async throws -> some IntentResult {
        let place = venue.trimmingCharacters(in: .whitespacesAndNewlines)
        let name = place.isEmpty
            ? try await $venue.requestValue("Which place are you at?")
            : place
        await openShyText(queryItems: [URLQueryItem(name: "name", value: name)])
        return .result()
    }
}

@available(iOS 16.0, *)
struct ShyTextShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: CheckInNearbyIntent(),
            phrases: [
                "Shyne nearby in \(.applicationName)",
                "Shyne with \(.applicationName)",
                "I'm here in \(.applicationName)",
            ],
            shortTitle: "Shyne nearby",
            systemImageName: "mappin.and.ellipse"
        )
        AppShortcut(
            intent: CheckInAtVenueIntent(),
            phrases: [
                "Shyne at a place in \(.applicationName)",
                "I'm at a place in \(.applicationName)",
            ],
            shortTitle: "Shyne at a place",
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
