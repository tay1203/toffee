# Toffee

A Windows desktop drink widget for tasks, notes, and reminders. Choose espresso, iced latte, or matcha and keep your to-dos close at hand.

## Tech stack

Electron, React, TypeScript, Vite, and local JSON storage.

## Features

- Manage tasks with optional deadlines and reminders, including snooze and completion controls.
- Write notes with autosave and keep your data locally without an account.
- Move and resize your drink widget, switch drinks, and enable keep-on-top.
- Export backups and optionally launch at Windows sign-in in packaged builds.

## Clone and run

Requires Windows x64, Git, Node.js 22.12 or newer, and npm.

```sh
git clone https://github.com/tay1203/toffee.git
cd toffee
npm ci
npm start
```

Click the drink to open the panel. Drag it to move, or drag the bottom-right handle to resize. Use the system tray menu to quit. Keep the app running to receive reminders.

To build a portable Windows executable:

```sh
npm run package
```

Open `release-v0.2/Toffee-0.2.0.exe` to use the packaged app.

## License

No project-wide license has been specified. Bundled font licenses are included in `public/licenses/`.
