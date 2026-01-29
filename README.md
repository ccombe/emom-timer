# EMOM Timer

A simple, lightweight, and portable EMOM (Every Minute on the Minute) timer built as a single HTML file.

## Features

* **Single File Portability**: Runs entirely in the browser with no external dependencies or internet connection required.
* **Visual Feedback**:
  * **Interval Ring**: Fills up as the minute progresses.
  * **Total Progress Ring**: Tracks the overall session completion.
  * **Victory Animation**: Visual pulsing and trophy celebration upon completion.
* **Audio Cues**:
  * **3-2-1 Countdown**: Increasing pitch beeps (low, mid, high) to signal the end of an interval.
  * **Bell Sound**: Marks the start of each new round.
  * **Victory Fanfare**: A celebratory audio sequence at the end of the workout.
* **Configurable**: Settings menu to adjust Total Duration and Interval Duration.
* **Mobile Friendly**: Responsive design that works great on phones and desktops.
* **Pre-Start Sequence**: "Ready... Set..." countdown when starting a fresh session.

## Usage

Simply open `index.html` in any modern web browser.

1. Click **Tap to Start** to initialize the audio engine.
2. Use the **Hamburger Menu (☰)** to configure your workout duration.
3. Hit **Start** to begin!

## Future Ideas / Roadmap

We have big plans to expand this tool while keeping it simple and effective:

* **Session Tracking**:
  * History of completed workouts.
  * Stats visualization (total time, rounds completed).
* **Theming**:
  * Light/Dark mode toggle (adapting to system preferences).
  * Custom color themes.
* **Workout Planning**:
  * Define different categories (e.g., Kettlebell, Bodyweight).
  * Assign specific exercises to intervals (e.g., "10 Swings" for Round 1, "5 Burpees" for Round 2).
  * Create and save reusable workout plans.
* **Data & Integration**:
  * **Local Storage**: Save settings and history directly in the browser.
  * **Cloud Sync**: Optional account to sync workouts across devices.
  * **Google Fit / Apple Health**: Integration to log workouts automatically.

## License

MIT
