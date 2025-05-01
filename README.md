# ShyText

ShyText is a proximity-based messaging app that allows users to connect with people nearby.

![ShyText](./assets/images/icon.png)

## UI Design

The ShyText app features a warm, inviting design with the following key elements:

- **Color Scheme**: Warm beige backgrounds (#f9f1e7) with white cards and dark text for high readability
- **Brand Identity**: Distinctive flame logo that symbolizes connection
- **Ghost Mode**: Optional privacy feature that allows users to browse without being visible to others
- **Consistent Components**: Clean card-based design with consistent shadows and rounded corners

## Key Features

- **Nearby Discovery**: Find and message users in your proximity
- **Private Messaging**: Secure, private conversations with people you meet
- **Profile Management**: Create and customize your profile
- **Ghost Mode**: Browse anonymously when needed

## Getting Started

### Prerequisites

- Node.js (>= 14.0.0)
- Yarn or npm
- Expo CLI

### Installation

1. Clone the repository

   ```bash
   git clone <repository-url>
   cd ShyText
   ```

2. Install dependencies

   ```bash
   yarn install
   # or
   npm install
   ```

3. Start the development server

   ```bash
   yarn start
   # or
   npm start
   ```

4. Run on your device or emulator
   - Scan the QR code with the Expo Go app
   - Press 'a' to run on Android emulator
   - Press 'i' to run on iOS simulator (macOS only)

## Tech Stack

- React Native
- Expo
- Firebase (Authentication, Realtime Database)
- Expo Nearby Connections API

## UI Component System

ShyText uses a consistent UI component system defined in `src/styles/theme.ts`. The theming system includes:

- **Colors**: Primary, secondary, accent colors and text variants
- **Typography**: Font sizes and weights
- **Spacing**: Consistent spacing units
- **Border Radius**: Standardized border radius values
- **Shadows**: Shadow styles for different elevation levels

## License

[MIT License](LICENSE)
